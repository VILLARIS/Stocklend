"""Devoluciones completas y parciales (Etapa 4).

Una devolución solo toca el inventario por lo que realmente vuelve: lo devuelto en
buenas condiciones sube a disponible (RN-30), lo dañado a dañado (RN-31) y lo
perdido a faltante (RN-32). El préstamo sigue ``activo`` si queda pendiente
(RN-36) y se cierra solo cuando no queda nada (RN-35). Registrar daño o pérdida
crea el incidente asociado en la misma transacción (RN-33) con origen
``devolucion`` (RN-54). Las devoluciones son inmutables (RN-38).
"""

from __future__ import annotations

import sqlite3
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, replace

from ..data.database import transaction
from ..data.repositories import (
    ArticuloRepo,
    ArticuloUnidadRepo,
    DevolucionRepo,
    IncidenteRepo,
    MovimientoRepo,
    PrestamoRepo,
)
from ..domain.entidades import (
    Articulo,
    Devolucion,
    DevolucionDetalle,
    Incidente,
    Prestamo,
    PrestamoDetalle,
)
from ..domain.enums import (
    EstadoIncidente,
    EstadoPrestamo,
    EstadoUnidad,
    OrigenIncidente,
    ResponsabilidadIncidente,
    TipoIncidente,
    TipoMovimiento,
)
from ..domain.excepciones import (
    CantidadInsuficienteError,
    NoEncontradoError,
    ReglaNegocioError,
    ValidacionError,
)
from ._comun import (
    ahora,
    aplicar_movimiento_unidad,
    cerrar_prestamo_si_corresponde,
    entero_no_negativo,
    estado_detalle,
    registrar_movimiento,
)

_MOTIVO_DEVOLUCION = "Devolución registrada"


@dataclass(frozen=True, slots=True)
class LineaDevolucion:
    """Lo que vuelve de un renglón, separado por condición (RN-27)."""

    prestamo_detalle_id: int
    cantidad_devuelta: int = 0
    cantidad_daniada: int = 0
    cantidad_perdida: int = 0
    descripcion: str | None = None
    notas: str | None = None
    estudiante_id: int | None = None


class DevolucionService:
    """Casos de uso de devoluciones sobre una conexión ya abierta."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._prestamos = PrestamoRepo(conn)
        self._devoluciones = DevolucionRepo(conn)
        self._articulos = ArticuloRepo(conn)
        self._unidades = ArticuloUnidadRepo(conn)
        self._movimientos = MovimientoRepo(conn)
        self._incidentes = IncidenteRepo(conn)

    def registrar_devolucion(
        self,
        prestamo_id: int,
        lineas: Iterable[LineaDevolucion | Mapping[str, object] | tuple[int, int, int, int]],
        *,
        fecha: str | None = None,
        observaciones: str | None = None,
    ) -> Devolucion:
        """Registra una o varias vueltas en una sola transacción (RN-26 a RN-38)."""
        momento = fecha or ahora()
        normalizadas = [
            linea for linea in _agrupar(_normalizar(lineas)) if _total(linea) > 0
        ]
        if not normalizadas:
            raise ReglaNegocioError("La devolución no cambia nada")
        with transaction(self._conn):
            prestamo = self._obtener_prestamo(prestamo_id)
            if prestamo.estado is not EstadoPrestamo.ACTIVO:
                raise ReglaNegocioError(
                    "Solo se puede devolver a un préstamo activo (RN-26)"
                )
            pendientes = {
                detalle.id: detalle
                for detalle in self._prestamos.listar_detalles_con_pendiente(prestamo_id)
            }
            for linea in normalizadas:
                self._validar_linea(linea, pendientes)
            devolucion = self._devoluciones.crear(
                Devolucion(
                    id=None,
                    prestamo_id=prestamo_id,
                    fecha_devolucion=momento,
                    observaciones=observaciones,
                    creado_en=momento,
                )
            )
            assert devolucion.id is not None
            for linea in normalizadas:
                detalle = pendientes[linea.prestamo_detalle_id]
                self._procesar_linea(prestamo, devolucion, detalle, linea, momento)
            cerrar_prestamo_si_corresponde(self._prestamos, prestamo, momento)
            return devolucion

    # --------------------------------------------------------------- consultas

    def obtener_devolucion(self, devolucion_id: int) -> Devolucion:
        with transaction(self._conn):
            devolucion = self._devoluciones.obtener_por_id(devolucion_id)
            if devolucion is None:
                raise NoEncontradoError(f"No existe la devolución {devolucion_id}")
            return devolucion

    def detalles_devolucion(self, devolucion_id: int) -> list[DevolucionDetalle]:
        with transaction(self._conn):
            return self._devoluciones.listar_detalles(devolucion_id)

    def listar_devoluciones(
        self,
        *,
        prestamo_id: int | None = None,
        desde: str | None = None,
        hasta: str | None = None,
        limite: int = 50,
        desplazamiento: int = 0,
    ) -> list[Devolucion]:
        with transaction(self._conn):
            if prestamo_id is not None:
                return self._devoluciones.listar_por_prestamo(prestamo_id)
            return self._devoluciones.listar(
                desde=desde, hasta=hasta, limite=limite, desplazamiento=desplazamiento
            )

    # ------------------------------------------------------------- auxiliares

    def _validar_linea(
        self, linea: LineaDevolucion, pendientes: dict[int | None, PrestamoDetalle]
    ) -> None:
        detalle = pendientes.get(linea.prestamo_detalle_id)
        if detalle is None:
            raise ReglaNegocioError(
                f"El renglón {linea.prestamo_detalle_id} no pertenece a este préstamo"
            )
        devuelta = entero_no_negativo(linea.cantidad_devuelta, "La cantidad devuelta")
        danada = entero_no_negativo(linea.cantidad_daniada, "La cantidad dañada")
        perdida = entero_no_negativo(linea.cantidad_perdida, "La cantidad perdida")
        pendiente = detalle.cantidad_pendiente or 0
        if devuelta + danada + perdida > pendiente:
            raise CantidadInsuficienteError(
                f"Quedan {pendiente} unidades pendientes como máximo",
                disponible=pendiente,
            )
        if (danada > 0 or perdida > 0) and not (
            isinstance(linea.descripcion, str) and linea.descripcion.strip()
        ):
            raise ValidacionError(
                "Registrar un daño o una pérdida exige una descripción (RN-33)"
            )

    def _procesar_linea(
        self,
        prestamo: Prestamo,
        devolucion: Devolucion,
        detalle: PrestamoDetalle,
        linea: LineaDevolucion,
        momento: str,
    ) -> None:
        assert detalle.id is not None
        devuelta = linea.cantidad_devuelta
        danada = linea.cantidad_daniada
        perdida = linea.cantidad_perdida
        self._devoluciones.crear_detalle(
            DevolucionDetalle(
                id=None,
                devolucion_id=devolucion.id,
                prestamo_detalle_id=detalle.id,
                cantidad_devuelta=devuelta,
                cantidad_daniada=danada,
                cantidad_perdida=perdida,
                notas=linea.notas,
            )
        )
        articulo = self._obtener_articulo(detalle.articulo_id)
        if articulo.control_individual:
            self._procesar_unidades(
                prestamo, devolucion, detalle, linea, articulo, momento
            )
        else:
            self._procesar_cantidades(
                prestamo, devolucion, detalle, linea, articulo, momento
            )
        actualizado = replace(
            detalle,
            cantidad_devuelta=detalle.cantidad_devuelta + devuelta,
            cantidad_daniada=detalle.cantidad_daniada + danada,
            cantidad_perdida=detalle.cantidad_perdida + perdida,
        )
        self._prestamos.actualizar_detalle(
            replace(actualizado, estado=estado_detalle(actualizado))
        )

    def _procesar_cantidades(
        self,
        prestamo: Prestamo,
        devolucion: Devolucion,
        detalle: PrestamoDetalle,
        linea: LineaDevolucion,
        articulo: Articulo,
        momento: str,
    ) -> None:
        if linea.cantidad_devuelta > 0:
            articulo = registrar_movimiento(
                self._articulos,
                self._movimientos,
                articulo,
                TipoMovimiento.DEVOLUCION,
                linea.cantidad_devuelta,
                _MOTIVO_DEVOLUCION,
                fecha=momento,
                referencia_tipo="devolucion",
                referencia_id=devolucion.id,
            )
        if linea.cantidad_daniada > 0:
            articulo = registrar_movimiento(
                self._articulos,
                self._movimientos,
                articulo,
                TipoMovimiento.DANIO_PRESTADO,
                linea.cantidad_daniada,
                _MOTIVO_DEVOLUCION,
                fecha=momento,
                referencia_tipo="devolucion",
                referencia_id=devolucion.id,
            )
            self._crear_incidente(
                prestamo, devolucion, detalle, linea, TipoIncidente.DANIO,
                linea.cantidad_daniada, momento,
            )
        if linea.cantidad_perdida > 0:
            articulo = registrar_movimiento(
                self._articulos,
                self._movimientos,
                articulo,
                TipoMovimiento.PERDIDA_PRESTADO,
                linea.cantidad_perdida,
                _MOTIVO_DEVOLUCION,
                fecha=momento,
                referencia_tipo="devolucion",
                referencia_id=devolucion.id,
            )
            self._crear_incidente(
                prestamo, devolucion, detalle, linea, TipoIncidente.PERDIDA,
                linea.cantidad_perdida, momento,
            )

    def _procesar_unidades(
        self,
        prestamo: Prestamo,
        devolucion: Devolucion,
        detalle: PrestamoDetalle,
        linea: LineaDevolucion,
        articulo: Articulo,
        momento: str,
    ) -> None:
        unidades = [
            unidad
            for unidad in self._unidades.listar_por_prestamo_detalle(detalle.id)
            if unidad.estado is EstadoUnidad.PRESTADA
        ]
        necesarias = (
            linea.cantidad_devuelta + linea.cantidad_daniada + linea.cantidad_perdida
        )
        if len(unidades) < necesarias:
            raise ReglaNegocioError(
                "Las unidades del control individual no coinciden con el"
                " pendiente del renglón"
            )
        indice = 0
        for _ in range(linea.cantidad_devuelta):
            articulo, _ = aplicar_movimiento_unidad(
                self._articulos,
                self._unidades,
                self._movimientos,
                articulo,
                unidades[indice],
                TipoMovimiento.DEVOLUCION,
                nuevo_estado=EstadoUnidad.DISPONIBLE,
                motivo=_MOTIVO_DEVOLUCION,
                fecha=momento,
                prestamo_detalle_id=None,
                referencia_tipo="devolucion",
                referencia_id=devolucion.id,
            )
            indice += 1
        for _ in range(linea.cantidad_daniada):
            articulo, _ = aplicar_movimiento_unidad(
                self._articulos,
                self._unidades,
                self._movimientos,
                articulo,
                unidades[indice],
                TipoMovimiento.DANIO_PRESTADO,
                nuevo_estado=EstadoUnidad.DANADA,
                motivo=_MOTIVO_DEVOLUCION,
                fecha=momento,
                prestamo_detalle_id=None,
                referencia_tipo="devolucion",
                referencia_id=devolucion.id,
            )
            self._crear_incidente(
                prestamo, devolucion, detalle, linea, TipoIncidente.DANIO, 1,
                momento, unidad_id=unidades[indice].id,
            )
            indice += 1
        for _ in range(linea.cantidad_perdida):
            articulo, _ = aplicar_movimiento_unidad(
                self._articulos,
                self._unidades,
                self._movimientos,
                articulo,
                unidades[indice],
                TipoMovimiento.PERDIDA_PRESTADO,
                nuevo_estado=EstadoUnidad.FALTANTE,
                motivo=_MOTIVO_DEVOLUCION,
                fecha=momento,
                prestamo_detalle_id=None,
                referencia_tipo="devolucion",
                referencia_id=devolucion.id,
            )
            self._crear_incidente(
                prestamo, devolucion, detalle, linea, TipoIncidente.PERDIDA, 1,
                momento, unidad_id=unidades[indice].id,
            )
            indice += 1

    def _crear_incidente(
        self,
        prestamo: Prestamo,
        devolucion: Devolucion,
        detalle: PrestamoDetalle,
        linea: LineaDevolucion,
        tipo: TipoIncidente,
        cantidad: int,
        momento: str,
        *,
        unidad_id: int | None = None,
    ) -> Incidente:
        estudiante_id = linea.estudiante_id
        return self._incidentes.crear(
            Incidente(
                id=None,
                tipo=tipo,
                estado=EstadoIncidente.ABIERTO,
                origen=OrigenIncidente.DEVOLUCION,
                prestamo_id=prestamo.id,
                prestamo_detalle_id=detalle.id,
                devolucion_id=devolucion.id,
                articulo_id=detalle.articulo_id,
                articulo_unidad_id=unidad_id,
                estudiante_id=estudiante_id,
                responsabilidad=(
                    ResponsabilidadIncidente.ESTUDIANTE
                    if estudiante_id is not None
                    else ResponsabilidadIncidente.SIN_DETERMINAR
                ),
                cantidad=cantidad,
                descripcion=linea.descripcion or "Daño o pérdida registrados",
                resolucion=None,
                resuelto_en=None,
                creado_en=momento,
            )
        )

    def _obtener_articulo(self, articulo_id: int) -> Articulo:
        articulo = self._articulos.obtener_por_id(articulo_id)
        if articulo is None:
            raise NoEncontradoError(f"No existe el artículo {articulo_id}")
        return articulo

    def _obtener_prestamo(self, prestamo_id: int) -> Prestamo:
        prestamo = self._prestamos.obtener_por_id(prestamo_id)
        if prestamo is None:
            raise NoEncontradoError(f"No existe el préstamo {prestamo_id}")
        return prestamo


def _total(linea: LineaDevolucion) -> int:
    return linea.cantidad_devuelta + linea.cantidad_daniada + linea.cantidad_perdida


def _normalizar(
    lineas: Iterable[LineaDevolucion | Mapping[str, object] | tuple[int, int, int, int]],
) -> list[LineaDevolucion]:
    resultado: list[LineaDevolucion] = []
    for linea in lineas:
        if isinstance(linea, LineaDevolucion):
            resultado.append(linea)
        elif isinstance(linea, Mapping):
            resultado.append(
                LineaDevolucion(
                    prestamo_detalle_id=int(linea["prestamo_detalle_id"]),  # type: ignore[arg-type]
                    cantidad_devuelta=int(linea.get("cantidad_devuelta", 0)),  # type: ignore[arg-type]
                    cantidad_daniada=int(linea.get("cantidad_daniada", 0)),  # type: ignore[arg-type]
                    cantidad_perdida=int(linea.get("cantidad_perdida", 0)),  # type: ignore[arg-type]
                    descripcion=linea.get("descripcion"),  # type: ignore[arg-type]
                    notas=linea.get("notas"),  # type: ignore[arg-type]
                    estudiante_id=linea.get("estudiante_id"),  # type: ignore[arg-type]
                )
            )
        elif isinstance(linea, (tuple, list)) and len(linea) == 4:
            resultado.append(
                LineaDevolucion(
                    prestamo_detalle_id=linea[0],
                    cantidad_devuelta=linea[1],
                    cantidad_daniada=linea[2],
                    cantidad_perdida=linea[3],
                )
            )
        else:
            raise ValidacionError(
                "Cada línea debe ser (detalle, devuelta, dañada, perdida), un"
                " diccionario o una LineaDevolucion"
            )
    return resultado


def _agrupar(lineas: list[LineaDevolucion]) -> list[LineaDevolucion]:
    agrupadas: dict[int, LineaDevolucion] = {}
    for linea in lineas:
        previa = agrupadas.get(linea.prestamo_detalle_id)
        if previa is None:
            agrupadas[linea.prestamo_detalle_id] = linea
            continue
        agrupadas[linea.prestamo_detalle_id] = replace(
            previa,
            cantidad_devuelta=previa.cantidad_devuelta + linea.cantidad_devuelta,
            cantidad_daniada=previa.cantidad_daniada + linea.cantidad_daniada,
            cantidad_perdida=previa.cantidad_perdida + linea.cantidad_perdida,
            descripcion=previa.descripcion or linea.descripcion,
            estudiante_id=previa.estudiante_id or linea.estudiante_id,
        )
    return list(agrupadas.values())
