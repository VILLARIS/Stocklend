"""Incidentes de daño y pérdida (Etapa 4).

Un incidente declara su origen (RN-40, RN-54). Los de ``stock`` se detectan en el
depósito y descuentan de ``disponible``; los de ``prestamo`` se detectan con el
material fuera y descuentan de ``prestada`` (RN-59). Los de ``devolucion`` los crea
`DevolucionService` junto con la devolución, para no contabilizar dos veces el mismo
daño o la misma pérdida. La responsabilidad es ``sin_determinar`` por defecto y solo
se atribuye a un estudiante de forma explícita (RN-55, RN-56).
"""

from __future__ import annotations

import sqlite3
from dataclasses import replace

from ..data.database import transaction
from ..data.repositories import (
    ArticuloRepo,
    ArticuloUnidadRepo,
    EstudianteRepo,
    IncidenteRepo,
    MovimientoRepo,
    PrestamoRepo,
)
from ..domain.entidades import Articulo, Incidente, PrestamoDetalle
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
    texto_obligatorio,
)

_TIPO_MOV_STOCK = {
    TipoIncidente.DANIO: TipoMovimiento.DANIO_DISPONIBLE,
    TipoIncidente.PERDIDA: TipoMovimiento.PERDIDA_DISPONIBLE,
}
_TIPO_MOV_PRESTAMO = {
    TipoIncidente.DANIO: TipoMovimiento.DANIO_PRESTADO,
    TipoIncidente.PERDIDA: TipoMovimiento.PERDIDA_PRESTADO,
}
_ESTADO_DESTINO = {
    TipoIncidente.DANIO: EstadoUnidad.DANADA,
    TipoIncidente.PERDIDA: EstadoUnidad.FALTANTE,
}


class IncidenteService:
    """Casos de uso de incidentes sobre una conexión ya abierta."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._incidentes = IncidenteRepo(conn)
        self._articulos = ArticuloRepo(conn)
        self._unidades = ArticuloUnidadRepo(conn)
        self._prestamos = PrestamoRepo(conn)
        self._estudiantes = EstudianteRepo(conn)
        self._movimientos = MovimientoRepo(conn)

    def registrar_incidente(
        self,
        articulo_id: int,
        tipo: TipoIncidente | str,
        origen: OrigenIncidente | str,
        cantidad: int,
        descripcion: str,
        *,
        prestamo_id: int | None = None,
        prestamo_detalle_id: int | None = None,
        unidad_id: int | None = None,
        estudiante_id: int | None = None,
        responsabilidad: ResponsabilidadIncidente | str = (
            ResponsabilidadIncidente.SIN_DETERMINAR
        ),
        fecha: str | None = None,
    ) -> Incidente:
        """Registra un incidente de stock o de préstamo y aplica su movimiento.

        Los incidentes de origen ``devolucion`` se crean desde `DevolucionService`;
        intentar crearlos aquí sería contabilizar el daño o la pérdida dos veces.
        """
        tipo = tipo if isinstance(tipo, TipoIncidente) else TipoIncidente(tipo)
        origen = origen if isinstance(origen, OrigenIncidente) else OrigenIncidente(origen)
        responsabilidad = (
            responsabilidad
            if isinstance(responsabilidad, ResponsabilidadIncidente)
            else ResponsabilidadIncidente(responsabilidad)
        )
        cantidad = entero_no_negativo(cantidad, "La cantidad")
        if cantidad <= 0:
            raise ReglaNegocioError("La cantidad del incidente debe ser mayor que cero")
        descripcion = texto_obligatorio(descripcion, "La descripción")
        if estudiante_id is not None:
            responsabilidad = ResponsabilidadIncidente.ESTUDIANTE
        if responsabilidad is ResponsabilidadIncidente.ESTUDIANTE and estudiante_id is None:
            raise ValidacionError(
                "Para atribuir la responsabilidad a un estudiante hay que elegirlo"
                " (RN-56)"
            )
        if origen is OrigenIncidente.DEVOLUCION:
            raise ReglaNegocioError(
                "Los incidentes de devolución se registran con la devolución (RN-54)"
            )
        momento = fecha or ahora()
        detalle: PrestamoDetalle | None = None
        with transaction(self._conn):
            if estudiante_id is not None:
                self._obtener_estudiante(estudiante_id)
            if origen is OrigenIncidente.STOCK:
                if prestamo_id is not None:
                    raise ValidacionError(
                        "Un incidente de depósito no tiene préstamo (RN-54)"
                    )
                unidad = self._procesar_stock(
                    articulo_id, tipo, cantidad, unidad_id, momento
                )
            else:
                if prestamo_id is None:
                    raise ReglaNegocioError(
                        "Un incidente de préstamo necesita su préstamo (RN-54)"
                    )
                detalle = self._resolver_detalle(
                    prestamo_id, articulo_id, prestamo_detalle_id
                )
                unidad = self._procesar_prestamo(
                    prestamo_id, detalle, tipo, cantidad, unidad_id, momento
                )
            return self._incidentes.crear(
                Incidente(
                    id=None,
                    tipo=tipo,
                    estado=EstadoIncidente.ABIERTO,
                    origen=origen,
                    prestamo_id=prestamo_id,
                    prestamo_detalle_id=prestamo_detalle_id
                    or (detalle.id if detalle is not None else None),
                    devolucion_id=None,
                    articulo_id=articulo_id,
                    articulo_unidad_id=unidad.id if unidad is not None else None,
                    estudiante_id=estudiante_id,
                    responsabilidad=responsabilidad,
                    cantidad=cantidad,
                    descripcion=descripcion,
                    resolucion=None,
                    resuelto_en=None,
                    creado_en=momento,
                )
            )

    # ------------------------------------------------------- seguimiento

    def resolver_incidente(
        self, incidente_id: int, resolucion: str, *, fecha: str | None = None
    ) -> Incidente:
        """Marca resuelto con su texto; el registro no se elimina (RN-42, RN-43)."""
        resolucion = texto_obligatorio(resolucion, "La resolución")
        with transaction(self._conn):
            incidente = self._obtener(incidente_id)
            if incidente.estado is EstadoIncidente.RESUELTO:
                raise ReglaNegocioError("El incidente ya está resuelto")
            actualizado = replace(
                incidente,
                estado=EstadoIncidente.RESUELTO,
                resolucion=resolucion,
                resuelto_en=fecha or ahora(),
            )
            self._incidentes.actualizar(actualizado)
            return self._obtener(incidente_id)

    def asignar_responsabilidad(
        self,
        incidente_id: int,
        estudiante_id: int,
        *,
        descripcion: str,
        fecha: str | None = None,
    ) -> Incidente:
        """Atribuye el incidente a un estudiante de forma explícita (RN-55, RN-56)."""
        nota = texto_obligatorio(descripcion, "El motivo de la responsabilidad")
        with transaction(self._conn):
            incidente = self._obtener(incidente_id)
            estudiante = self._obtener_estudiante(estudiante_id)
            actualizado = replace(
                incidente,
                responsabilidad=ResponsabilidadIncidente.ESTUDIANTE,
                estudiante_id=estudiante.id,
                descripcion=f"{incidente.descripcion}\nResponsabilidad asignada: {nota}",
            )
            self._incidentes.actualizar(actualizado)
            return self._obtener(incidente_id)

    def obtener_incidente(self, incidente_id: int) -> Incidente:
        with transaction(self._conn):
            return self._obtener(incidente_id)

    def listar_incidentes(
        self,
        *,
        estado: EstadoIncidente | None = None,
        tipo: TipoIncidente | None = None,
        origen: OrigenIncidente | None = None,
        articulo_id: int | None = None,
        estudiante_id: int | None = None,
        desde: str | None = None,
        hasta: str | None = None,
        limite: int = 50,
        desplazamiento: int = 0,
    ) -> list[Incidente]:
        with transaction(self._conn):
            return self._incidentes.listar(
                estado=estado,
                tipo=tipo,
                origen=origen,
                articulo_id=articulo_id,
                estudiante_id=estudiante_id,
                desde=desde,
                hasta=hasta,
                limite=limite,
                desplazamiento=desplazamiento,
            )

    def listar_pendientes(
        self, *, limite: int = 50, desplazamiento: int = 0
    ) -> list[Incidente]:
        with transaction(self._conn):
            return self._incidentes.listar_pendientes(
                limite=limite, desplazamiento=desplazamiento
            )

    def listar_por_articulo(
        self, articulo_id: int, *, limite: int = 50, desplazamiento: int = 0
    ) -> list[Incidente]:
        with transaction(self._conn):
            return self._incidentes.listar_por_articulo(
                articulo_id, limite=limite, desplazamiento=desplazamiento
            )

    def listar_por_prestamo(self, prestamo_id: int) -> list[Incidente]:
        with transaction(self._conn):
            return self._incidentes.listar_por_prestamo(prestamo_id)

    # ------------------------------------------------------------- auxiliares

    def _procesar_stock(
        self,
        articulo_id: int,
        tipo: TipoIncidente,
        cantidad: int,
        unidad_id: int | None,
        momento: str,
    ):
        articulo = self._obtener_articulo(articulo_id)
        if cantidad > articulo.cantidad_disponible:
            raise CantidadInsuficienteError(
                f"Solo hay {articulo.cantidad_disponible} unidades disponibles"
                f" de {articulo.nombre}",
                disponible=articulo.cantidad_disponible,
            )
        tipo_mov = _TIPO_MOV_STOCK.get(tipo)
        if tipo_mov is None:
            return None
        if articulo.control_individual:
            unidad = self._unidad_disponible(unidad_id, articulo_id, cantidad)
            aplicar_movimiento_unidad(
                self._articulos,
                self._unidades,
                self._movimientos,
                articulo,
                unidad,
                tipo_mov,
                nuevo_estado=_ESTADO_DESTINO[tipo],
                motivo="Incidente en depósito",
                fecha=momento,
                referencia_tipo="incidente",
            )
            return unidad
        registrar_movimiento(
            self._articulos,
            self._movimientos,
            articulo,
            tipo_mov,
            cantidad,
            "Incidente en depósito",
            fecha=momento,
            referencia_tipo="incidente",
        )
        return None

    def _procesar_prestamo(
        self,
        prestamo_id: int,
        detalle: PrestamoDetalle,
        tipo: TipoIncidente,
        cantidad: int,
        unidad_id: int | None,
        momento: str,
    ):
        pendiente = _pendiente(detalle)
        if cantidad > pendiente:
            raise CantidadInsuficienteError(
                f"Quedan {pendiente} unidades pendientes como máximo",
                disponible=pendiente,
            )
        tipo_mov = _TIPO_MOV_PRESTAMO.get(tipo)
        if tipo_mov is None:
            return None
        prestamo = self._prestamos.obtener_por_id(prestamo_id)
        if prestamo is None:
            raise NoEncontradoError(f"No existe el préstamo {prestamo_id}")
        if prestamo.estado is not EstadoPrestamo.ACTIVO:
            raise ReglaNegocioError("Solo se registran incidentes en préstamos activos")
        articulo = self._obtener_articulo(detalle.articulo_id)
        unidad = None
        if articulo.control_individual:
            unidad = self._unidad_prestada(unidad_id, detalle, cantidad)
            aplicar_movimiento_unidad(
                self._articulos,
                self._unidades,
                self._movimientos,
                articulo,
                unidad,
                tipo_mov,
                nuevo_estado=_ESTADO_DESTINO[tipo],
                motivo="Incidente en préstamo",
                fecha=momento,
                prestamo_detalle_id=None,
                referencia_tipo="incidente",
            )
        else:
            registrar_movimiento(
                self._articulos,
                self._movimientos,
                articulo,
                tipo_mov,
                cantidad,
                "Incidente en préstamo",
                fecha=momento,
                referencia_tipo="incidente",
            )
        actualizado = replace(
            detalle,
            cantidad_daniada=detalle.cantidad_daniada
            + (cantidad if tipo is TipoIncidente.DANIO else 0),
            cantidad_perdida=detalle.cantidad_perdida
            + (cantidad if tipo is TipoIncidente.PERDIDA else 0),
        )
        self._prestamos.actualizar_detalle(
            replace(actualizado, estado=estado_detalle(actualizado))
        )
        cerrar_prestamo_si_corresponde(self._prestamos, prestamo, momento)
        return unidad

    def _unidad_disponible(self, unidad_id: int | None, articulo_id: int, cantidad: int):
        if unidad_id is None:
            raise ReglaNegocioError(
                "El artículo tiene control individual: hay que elegir la unidad"
            )
        if cantidad != 1:
            raise ValidacionError(
                "Un incidente sobre una unidad individual afecta de a una unidad"
            )
        unidad = self._unidades.obtener_por_id(unidad_id)
        if unidad is None or unidad.articulo_id != articulo_id:
            raise NoEncontradoError(f"No existe la unidad {unidad_id} en ese artículo")
        if unidad.estado is not EstadoUnidad.DISPONIBLE:
            raise ReglaNegocioError(
                f"La unidad {unidad.codigo} no está disponible"
                f" (estado '{unidad.estado.value}')"
            )
        return unidad

    def _unidad_prestada(
        self, unidad_id: int | None, detalle: PrestamoDetalle, cantidad: int
    ):
        if unidad_id is None:
            raise ReglaNegocioError(
                "El artículo tiene control individual: hay que elegir la unidad"
            )
        if cantidad != 1:
            raise ValidacionError(
                "Un incidente sobre una unidad individual afecta de a una unidad"
            )
        unidad = self._unidades.obtener_por_id(unidad_id)
        if unidad is None or unidad.prestamo_detalle_id != detalle.id:
            raise ReglaNegocioError(
                "La unidad no pertenece a este préstamo o ya no está prestada"
            )
        return unidad

    def _resolver_detalle(
        self, prestamo_id: int, articulo_id: int, prestamo_detalle_id: int | None
    ) -> PrestamoDetalle:
        if prestamo_detalle_id is not None:
            detalle = self._prestamos.obtener_detalle(prestamo_detalle_id)
            if (
                detalle is None
                or detalle.prestamo_id != prestamo_id
                or detalle.articulo_id != articulo_id
            ):
                raise ReglaNegocioError(
                    "El renglón no corresponde a ese préstamo y artículo"
                )
            return detalle
        detalle = self._prestamos.obtener_detalle_por_articulo(prestamo_id, articulo_id)
        if detalle is None:
            raise ReglaNegocioError("El préstamo no tiene ese artículo")
        return detalle

    def _obtener(self, incidente_id: int) -> Incidente:
        incidente = self._incidentes.obtener_por_id(incidente_id)
        if incidente is None:
            raise NoEncontradoError(f"No existe el incidente {incidente_id}")
        return incidente

    def _obtener_articulo(self, articulo_id: int) -> Articulo:
        articulo = self._articulos.obtener_por_id(articulo_id)
        if articulo is None:
            raise NoEncontradoError(f"No existe el artículo {articulo_id}")
        return articulo

    def _obtener_estudiante(self, estudiante_id: int):
        estudiante = self._estudiantes.obtener_por_id(estudiante_id)
        if estudiante is None:
            raise NoEncontradoError(f"No existe el estudiante {estudiante_id}")
        return estudiante


def _pendiente(detalle: PrestamoDetalle) -> int:
    return (
        detalle.cantidad_prestada
        - detalle.cantidad_devuelta
        - detalle.cantidad_daniada
        - detalle.cantidad_perdida
    )
