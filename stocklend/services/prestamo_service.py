"""Préstamos: alta atómica, consulta y anulación (Etapa 4).

Un préstamo descuenta la disponibilidad y aumenta lo prestado en **una** sola
transacción (RN-21, RN-48). Si cualquier línea falla, no se registra ninguna
(RN-17, RN-19). Los artículos con control individual se prestan eligiendo unidades
concretas, que quedan vinculadas al renglón y marcadas como ``prestada``
(RN-50, RN-53).
"""

from __future__ import annotations

import sqlite3
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, replace

from ..data.database import transaction
from ..data.repositories import (
    ArticuloRepo,
    ArticuloUnidadRepo,
    ConfiguracionRepo,
    DevolucionRepo,
    EstudianteRepo,
    MovimientoRepo,
    PrestamoRepo,
)
from ..domain.entidades import Articulo, Prestamo, PrestamoDetalle
from ..domain.enums import (
    EstadoDetalle,
    EstadoPrestamo,
    EstadoUnidad,
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
    estado_detalle,
    registrar_movimiento,
    validar_motivo,
)

_MOTIVO_PRESTAMO = "Préstamo registrado"
_MOTIVO_ANULACION = "Anulación de préstamo"


@dataclass(frozen=True, slots=True)
class LineaPrestamo:
    """Un artículo del préstamo: por cantidad o por unidades concretas.

    Para artículos sin control individual se indica ``cantidad``. Para artículos
    con control individual se indican las ``unidad_ids`` que se entregan (RN-50).
    """

    articulo_id: int
    cantidad: int | None = None
    unidad_ids: tuple[int, ...] | None = None


class PrestamoService:
    """Casos de uso de préstamos sobre una conexión ya abierta."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._prestamos = PrestamoRepo(conn)
        self._articulos = ArticuloRepo(conn)
        self._unidades = ArticuloUnidadRepo(conn)
        self._estudiantes = EstudianteRepo(conn)
        self._devoluciones = DevolucionRepo(conn)
        self._movimientos = MovimientoRepo(conn)
        self._configuracion = ConfiguracionRepo(conn)

    # ------------------------------------------------------------------ alta

    def registrar_prestamo(
        self,
        estudiante_id: int,
        lineas: Iterable[LineaPrestamo | Mapping[str, object] | tuple[int, int]],
        *,
        fecha: str | None = None,
        fecha_limite: str | None = None,
        comentario: str | None = None,
    ) -> Prestamo:
        """Registra la entrega de uno o varios artículos (RN-16 a RN-25).

        Devuelve el préstamo con su folio. Todo o nada: si una línea no cabe en la
        disponibilidad, ninguna se descuenta.
        """
        momento = fecha or ahora()
        if momento > ahora():
            raise ReglaNegocioError("La fecha del préstamo no puede ser futura (RN-24)")
        normalizadas = _agrupar_lineas(_normalizar_lineas(lineas))
        if not normalizadas:
            raise ReglaNegocioError(
                "El préstamo debe incluir al menos un artículo con cantidad mayor que cero (RN-17)"
            )
        with transaction(self._conn):
            self._obtener_estudiante_activo(estudiante_id)
            preparadas: list[tuple[LineaPrestamo, Articulo]] = []
            for linea in normalizadas:
                articulo = self._obtener_articulo_prestable(linea.articulo_id)
                self._validar_linea(linea, articulo)
                preparadas.append((linea, articulo))

            folio = self._siguiente_folio(momento)
            prestamo = self._prestamos.crear(
                Prestamo(
                    id=None,
                    folio=folio,
                    estudiante_id=estudiante_id,
                    fecha_prestamo=momento,
                    fecha_limite=fecha_limite,
                    estado=EstadoPrestamo.ACTIVO,
                    comentario=comentario,
                    creado_en=momento,
                    cerrado_en=None,
                )
            )
            assert prestamo.id is not None
            for linea, articulo in preparadas:
                self._entregar(prestamo, linea, articulo, momento)
            return prestamo

    def _entregar(
        self,
        prestamo: Prestamo,
        linea: LineaPrestamo,
        articulo: Articulo,
        momento: str,
    ) -> None:
        if articulo.control_individual:
            unidades_ids = list(linea.unidad_ids or ())
        else:
            unidades_ids = []
        cantidad = len(unidades_ids) if articulo.control_individual else int(linea.cantidad or 0)
        detalle = self._prestamos.crear_detalle(
            PrestamoDetalle(
                id=None,
                prestamo_id=prestamo.id,
                articulo_id=articulo.id,
                cantidad_prestada=cantidad,
                cantidad_devuelta=0,
                cantidad_daniada=0,
                cantidad_perdida=0,
                estado=EstadoDetalle.PENDIENTE,
                notas=None,
            )
        )
        assert detalle.id is not None
        if articulo.control_individual:
            for unidad_id in unidades_ids:
                unidad = self._obtener_unidad(unidad_id)
                _, _ = aplicar_movimiento_unidad(
                    self._articulos,
                    self._unidades,
                    self._movimientos,
                    articulo,
                    unidad,
                    TipoMovimiento.PRESTAMO,
                    nuevo_estado=EstadoUnidad.PRESTADA,
                    motivo=_MOTIVO_PRESTAMO,
                    fecha=momento,
                    prestamo_detalle_id=detalle.id,
                    referencia_tipo="prestamo",
                    referencia_id=prestamo.id,
                )
                articulo = self._obtener_articulo(articulo.id)
        else:
            registrar_movimiento(
                self._articulos,
                self._movimientos,
                articulo,
                TipoMovimiento.PRESTAMO,
                cantidad,
                _MOTIVO_PRESTAMO,
                fecha=momento,
                referencia_tipo="prestamo",
                referencia_id=prestamo.id,
            )

    # -------------------------------------------------------------- anulación

    def anular_prestamo(
        self,
        prestamo_id: int,
        *,
        motivo: str = _MOTIVO_ANULACION,
        fecha: str | None = None,
    ) -> Prestamo:
        """Anula un préstamo sin devoluciones y libera sus unidades (RN-22, RN-23).

        Las unidades pendientes vuelven a ``disponible`` con un movimiento de
        ``devolucion`` cuya referencia es la anulación: el asiento distingue la
        anulación de una devolución real. Un préstamo anulado no se puede volver a
        modificar ni devolver.
        """
        motivo = validar_motivo(motivo)
        momento = fecha or ahora()
        with transaction(self._conn):
            prestamo = self._obtener_prestamo(prestamo_id)
            if prestamo.estado is not EstadoPrestamo.ACTIVO:
                raise ReglaNegocioError(
                    "Solo se puede anular un préstamo activo (RN-22, RN-23)"
                )
            if self._devoluciones.contar(prestamo_id=prestamo_id) > 0:
                raise ReglaNegocioError(
                    "Este préstamo tiene devoluciones registradas y no se puede anular"
                    " (RN-22)"
                )
            detalles = self._prestamos.listar_detalles_con_pendiente(prestamo_id)
            for detalle in detalles:
                self._liberar_detalle(prestamo, detalle, motivo, momento)
            anulado = replace(
                prestamo, estado=EstadoPrestamo.ANULADO, cerrado_en=momento
            )
            self._prestamos.actualizar_estado(anulado)
            return self._obtener_prestamo(prestamo_id)

    def _liberar_detalle(
        self,
        prestamo: Prestamo,
        detalle: PrestamoDetalle,
        motivo: str,
        momento: str,
    ) -> None:
        pendiente = detalle.cantidad_pendiente or 0
        if pendiente <= 0:
            return
        articulo = self._obtener_articulo(detalle.articulo_id)
        assert detalle.id is not None
        if articulo.control_individual:
            liberadas = 0
            for unidad in self._unidades.listar_por_prestamo_detalle(detalle.id):
                if unidad.estado is not EstadoUnidad.PRESTADA:
                    continue
                _, _ = aplicar_movimiento_unidad(
                    self._articulos,
                    self._unidades,
                    self._movimientos,
                    articulo,
                    unidad,
                    TipoMovimiento.DEVOLUCION,
                    nuevo_estado=EstadoUnidad.DISPONIBLE,
                    motivo=motivo,
                    fecha=momento,
                    prestamo_detalle_id=None,
                    referencia_tipo="anulacion",
                    referencia_id=prestamo.id,
                )
                articulo = self._obtener_articulo(articulo.id)
                liberadas += 1
            if liberadas != pendiente:
                raise ReglaNegocioError(
                    "Las unidades del control individual no coinciden con el"
                    " pendiente del renglón"
                )
        else:
            registrar_movimiento(
                self._articulos,
                self._movimientos,
                articulo,
                TipoMovimiento.DEVOLUCION,
                pendiente,
                motivo,
                fecha=momento,
                referencia_tipo="anulacion",
                referencia_id=prestamo.id,
            )
        actualizado = replace(
            detalle,
            cantidad_devuelta=detalle.cantidad_devuelta + pendiente,
        )
        self._prestamos.actualizar_detalle(
            replace(actualizado, estado=estado_detalle(actualizado))
        )

    # --------------------------------------------------------------- consultas

    def obtener_prestamo(self, prestamo_id: int) -> Prestamo:
        with transaction(self._conn):
            return self._obtener_prestamo(prestamo_id)

    def obtener_por_folio(self, folio: str) -> Prestamo:
        with transaction(self._conn):
            prestamo = self._prestamos.obtener_por_folio(folio)
            if prestamo is None:
                raise NoEncontradoError(f"No existe el préstamo '{folio}'")
            return prestamo

    def detalles(self, prestamo_id: int) -> list[PrestamoDetalle]:
        """Renglones con su ``cantidad_pendiente`` calculada por la vista (§6.1)."""
        with transaction(self._conn):
            self._obtener_prestamo(prestamo_id)
            return self._prestamos.listar_detalles_con_pendiente(prestamo_id)

    def listar_prestamos(
        self,
        *,
        estado: EstadoPrestamo | None = None,
        estudiante_id: int | None = None,
        desde: str | None = None,
        hasta: str | None = None,
        limite: int = 50,
        desplazamiento: int = 0,
    ) -> list[Prestamo]:
        with transaction(self._conn):
            return self._prestamos.listar(
                estado=estado,
                estudiante_id=estudiante_id,
                desde=desde,
                hasta=hasta,
                limite=limite,
                desplazamiento=desplazamiento,
            )

    def listar_activos(
        self,
        *,
        estudiante_id: int | None = None,
        limite: int = 50,
        desplazamiento: int = 0,
    ) -> list[Prestamo]:
        """Préstamos activos con algo pendiente (DATABASE_DESIGN §8.2)."""
        with transaction(self._conn):
            return self._prestamos.listar_activos_pendientes(
                estudiante_id=estudiante_id,
                limite=limite,
                desplazamiento=desplazamiento,
            )

    # ------------------------------------------------------------- auxiliares

    def _validar_linea(self, linea: LineaPrestamo, articulo: Articulo) -> None:
        if articulo.control_individual:
            unidades_ids = list(linea.unidad_ids or ())
            if not unidades_ids:
                raise ValidacionError(
                    "Un artículo con control individual se presta eligiendo sus"
                    " unidades (RN-50)"
                )
            if len(set(unidades_ids)) != len(unidades_ids):
                raise ReglaNegocioError("No se puede prestar la misma unidad dos veces")
            for unidad_id in unidades_ids:
                unidad = self._obtener_unidad(unidad_id)
                if unidad.articulo_id != articulo.id:
                    raise ReglaNegocioError(
                        f"La unidad {unidad.codigo} no pertenece al artículo '{articulo.nombre}'"
                    )
                if unidad.estado is not EstadoUnidad.DISPONIBLE:
                    raise ReglaNegocioError(
                        f"La unidad {unidad.codigo} no está disponible"
                        f" (estado '{unidad.estado.value}')"
                    )
            if len(unidades_ids) > articulo.cantidad_disponible:
                raise CantidadInsuficienteError(
                    f"Solo hay {articulo.cantidad_disponible} unidades disponibles"
                    f" de {articulo.nombre}",
                    disponible=articulo.cantidad_disponible,
                )
        else:
            cantidad = linea.cantidad
            if cantidad is None or not isinstance(cantidad, int) or isinstance(cantidad, bool):
                raise ValidacionError("La cantidad tiene que ser al menos 1 (RN-17)")
            if cantidad <= 0:
                raise ValidacionError("La cantidad tiene que ser al menos 1 (RN-17)")
            if cantidad > articulo.cantidad_disponible:
                raise CantidadInsuficienteError(
                    f"Solo hay {articulo.cantidad_disponible} unidades disponibles"
                    f" de {articulo.nombre}",
                    disponible=articulo.cantidad_disponible,
                )

    def _siguiente_folio(self, momento: str) -> str:
        anio = momento[:4]
        clave = f"folio_prestamo_{anio}"
        actual = self._configuracion.obtener(clave)
        siguiente = (int(actual) if actual is not None else 0) + 1
        self._configuracion.establecer(clave, str(siguiente), momento)
        return f"PRE-{anio}-{siguiente:06d}"

    def _obtener_estudiante_activo(self, estudiante_id: int) -> None:
        estudiante = self._estudiantes.obtener_por_id(estudiante_id)
        if estudiante is None:
            raise NoEncontradoError(f"No existe el estudiante {estudiante_id}")
        if not estudiante.activo:
            raise ReglaNegocioError(
                "Este estudiante está inactivo y no puede recibir préstamos nuevos"
                " (RF-EST-06)"
            )

    def _obtener_articulo_prestable(self, articulo_id: int) -> Articulo:
        articulo = self._obtener_articulo(articulo_id)
        if not articulo.activo:
            raise ReglaNegocioError(f"El artículo '{articulo.nombre}' está inactivo")
        if not articulo.prestable:
            raise ReglaNegocioError(
                f"El artículo '{articulo.nombre}' no puede prestarse (RF-INV-09)"
            )
        return articulo

    def _obtener_articulo(self, articulo_id: int) -> Articulo:
        articulo = self._articulos.obtener_por_id(articulo_id)
        if articulo is None:
            raise NoEncontradoError(f"No existe el artículo {articulo_id}")
        return articulo

    def _obtener_unidad(self, unidad_id: int):
        unidad = self._unidades.obtener_por_id(unidad_id)
        if unidad is None:
            raise NoEncontradoError(f"No existe la unidad {unidad_id}")
        return unidad

    def _obtener_prestamo(self, prestamo_id: int) -> Prestamo:
        prestamo = self._prestamos.obtener_por_id(prestamo_id)
        if prestamo is None:
            raise NoEncontradoError(f"No existe el préstamo {prestamo_id}")
        return prestamo


def _normalizar_lineas(
    lineas: Iterable[LineaPrestamo | Mapping[str, object] | tuple[int, int]],
) -> list[LineaPrestamo]:
    resultado: list[LineaPrestamo] = []
    for linea in lineas:
        if isinstance(linea, LineaPrestamo):
            resultado.append(linea)
        elif isinstance(linea, Mapping):
            unidad_ids = linea.get("unidad_ids")
            resultado.append(
                LineaPrestamo(
                    articulo_id=int(linea["articulo_id"]),  # type: ignore[arg-type]
                    cantidad=linea.get("cantidad"),  # type: ignore[arg-type]
                    unidad_ids=tuple(unidad_ids) if unidad_ids is not None else None,  # type: ignore[arg-type]
                )
            )
        elif isinstance(linea, (tuple, list)) and len(linea) == 2:
            resultado.append(LineaPrestamo(articulo_id=linea[0], cantidad=linea[1]))
        else:
            raise ValidacionError(
                "Cada línea debe ser (articulo_id, cantidad), un diccionario o"
                " una LineaPrestamo"
            )
    return resultado


def _agrupar_lineas(lineas: list[LineaPrestamo]) -> list[LineaPrestamo]:
    """Suma las cantidades de un artículo repetido (RN-18)."""
    agrupadas: dict[int, LineaPrestamo] = {}
    for linea in lineas:
        previa = agrupadas.get(linea.articulo_id)
        if previa is None:
            agrupadas[linea.articulo_id] = linea
            continue
        if previa.unidad_ids is not None or linea.unidad_ids is not None:
            unidades = list(previa.unidad_ids or ()) + list(linea.unidad_ids or ())
            agrupadas[linea.articulo_id] = LineaPrestamo(
                linea.articulo_id, unidad_ids=tuple(unidades)
            )
        else:
            agrupadas[linea.articulo_id] = LineaPrestamo(
                linea.articulo_id, cantidad=(previa.cantidad or 0) + (linea.cantidad or 0)
            )
    return list(agrupadas.values())
