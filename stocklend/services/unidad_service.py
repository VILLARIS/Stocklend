"""Unidades individuales de los artículos con control individual (Etapa 3).

Solo los artículos con ``control_individual = 1`` tienen filas en
``articulo_unidad`` (RN-50). Cada alta o cambio de estado de una unidad actualiza
**en la misma transacción** su fila, los contadores del artículo y el libro de
movimientos (RN-53, RN-61).
"""

from __future__ import annotations

import sqlite3
from dataclasses import replace

from ..data.database import transaction
from ..data.repositories import ArticuloRepo, ArticuloUnidadRepo, MovimientoRepo
from ..domain.entidades import Articulo, ArticuloUnidad
from ..domain.enums import EstadoUnidad, TipoMovimiento
from ..domain.excepciones import NoEncontradoError, ReglaNegocioError
from ..domain.value_objects import CodigoUnidad
from ._comun import (
    SIN_CAMBIO,
    ahora,
    calcular_contadores,
    construir_movimiento,
    registrar_movimiento,
    validar_motivo,
)

# Transiciones de stock permitidas en esta etapa. Todo lo que toca ``prestada``
# pertenece al flujo de préstamos y devoluciones (Etapa 4).
_TRANSICIONES: dict[tuple[EstadoUnidad, EstadoUnidad], TipoMovimiento] = {
    (EstadoUnidad.DISPONIBLE, EstadoUnidad.DANADA): TipoMovimiento.DANIO_DISPONIBLE,
    (EstadoUnidad.DISPONIBLE, EstadoUnidad.FALTANTE): TipoMovimiento.PERDIDA_DISPONIBLE,
    (EstadoUnidad.DANADA, EstadoUnidad.DISPONIBLE): TipoMovimiento.REINGRESO_REPARACION,
    (EstadoUnidad.DANADA, EstadoUnidad.BAJA): TipoMovimiento.BAJA_DANIADA,
    (EstadoUnidad.FALTANTE, EstadoUnidad.BAJA): TipoMovimiento.BAJA_FALTANTE,
}

_ESTADOS_ALTA = (
    EstadoUnidad.DISPONIBLE,
    EstadoUnidad.DANADA,
    EstadoUnidad.FALTANTE,
)


class UnidadService:
    """Alta y cambio de estado de las unidades de un artículo."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._articulos = ArticuloRepo(conn)
        self._unidades = ArticuloUnidadRepo(conn)
        self._movimientos = MovimientoRepo(conn)

    def registrar_unidad(
        self,
        articulo_id: int,
        codigo: str,
        *,
        descripcion: str | None = None,
        notas: str | None = None,
        estado: EstadoUnidad = EstadoUnidad.DISPONIBLE,
        fecha: str | None = None,
    ) -> ArticuloUnidad:
        """Da de alta una unidad con su código y estado inicial (RN-50, RN-51).

        El estado inicial solo puede ser ``disponible``, ``danada`` o ``faltante``:
        ``prestada`` y ``baja`` se alcanzan mediante ``cambiar_estado``.
        """
        estado = self._normalizar_estado(estado)
        if estado not in _ESTADOS_ALTA:
            raise ReglaNegocioError(
                "Una unidad nueva solo puede registrarse como disponible, dañada o faltante"
            )
        with transaction(self._conn):
            articulo = self._obtener_articulo_individual(articulo_id)
            unidad, _ = self._crear_unidad(
                articulo,
                self._preparar_codigo(codigo),
                descripcion=descripcion,
                notas=notas,
                estado=estado,
                fecha=fecha or ahora(),
            )
            return unidad

    def registrar_unidades(
        self,
        articulo_id: int,
        codigos: list[str],
        *,
        descripcion: str | None = None,
        notas: str | None = None,
        fecha: str | None = None,
    ) -> list[ArticuloUnidad]:
        """Alta en bloque de unidades disponibles, todo o nada (RN-48)."""
        codigos = list(codigos)
        if not codigos:
            raise ReglaNegocioError("Debe indicar al menos un código de unidad")
        with transaction(self._conn):
            articulo = self._obtener_articulo_individual(articulo_id)
            momento = fecha or ahora()
            creadas: list[ArticuloUnidad] = []
            for codigo in codigos:
                unidad, articulo = self._crear_unidad(
                    articulo,
                    self._preparar_codigo(codigo),
                    descripcion=descripcion,
                    notas=notas,
                    estado=EstadoUnidad.DISPONIBLE,
                    fecha=momento,
                )
                creadas.append(unidad)
            return creadas

    def cambiar_estado(
        self,
        unidad_id: int,
        nuevo_estado: EstadoUnidad,
        motivo: str,
        *,
        fecha: str | None = None,
    ) -> ArticuloUnidad:
        """Mueve una unidad entre los estados de stock permitidos (RN-52, RN-53)."""
        nuevo_estado = self._normalizar_estado(nuevo_estado)
        motivo = validar_motivo(motivo)
        with transaction(self._conn):
            unidad = self._obtener_unidad(unidad_id)
            if nuevo_estado == unidad.estado:
                raise ReglaNegocioError(
                    f"La unidad ya está en estado '{nuevo_estado.value}'"
                )
            tipo = _TRANSICIONES.get((unidad.estado, nuevo_estado))
            if tipo is None:
                if EstadoUnidad.PRESTADA in (unidad.estado, nuevo_estado):
                    raise ReglaNegocioError(
                        "Las transiciones hacia o desde 'prestada' se realizan con"
                        " préstamos y devoluciones (Etapa 4)"
                    )
                raise ReglaNegocioError(
                    f"Transición de unidad no permitida:"
                    f" '{unidad.estado.value}' -> '{nuevo_estado.value}'"
                )
            articulo = self._obtener_articulo(unidad.articulo_id)
            _, unidad_nueva = self._transicionar(
                articulo, unidad, tipo, nuevo_estado, motivo, fecha or ahora()
            )
            return unidad_nueva

    def editar_unidad(
        self,
        unidad_id: int,
        *,
        codigo: str | None = None,
        descripcion: str | object = SIN_CAMBIO,
        notas: str | object = SIN_CAMBIO,
        fecha: str | None = None,
    ) -> ArticuloUnidad:
        """Corrige código, descripción o notas; nunca cambia el estado (RN-51)."""
        with transaction(self._conn):
            unidad = self._obtener_unidad(unidad_id)
            nuevo_codigo = unidad.codigo
            if codigo is not None:
                nuevo_codigo = self._preparar_codigo(codigo, excluir_id=unidad.id)
            actualizada = replace(
                unidad,
                codigo=nuevo_codigo,
                descripcion=(
                    unidad.descripcion if descripcion is SIN_CAMBIO else descripcion
                ),
                notas=unidad.notas if notas is SIN_CAMBIO else notas,
                actualizado_en=fecha or ahora(),
            )
            self._unidades.actualizar(actualizada)
            return actualizada

    def obtener_unidad(self, unidad_id: int) -> ArticuloUnidad:
        with transaction(self._conn):
            return self._obtener_unidad(unidad_id)

    def listar_por_articulo(
        self,
        articulo_id: int,
        *,
        estado: EstadoUnidad | None = None,
        limite: int = 50,
        desplazamiento: int = 0,
    ) -> list[ArticuloUnidad]:
        with transaction(self._conn):
            if estado is not None:
                estado = self._normalizar_estado(estado)
            return self._unidades.listar_por_articulo(
                articulo_id,
                estado=estado,
                limite=limite,
                desplazamiento=desplazamiento,
            )

    def contar_por_estado(
        self, articulo_id: int, *, estado: EstadoUnidad | None = None
    ) -> int:
        """Cuenta unidades de un artículo, opcionalmente en un estado (RN-61)."""
        with transaction(self._conn):
            if estado is not None:
                estado = self._normalizar_estado(estado)
            return self._unidades.contar_por_articulo(articulo_id, estado=estado)

    # ------------------------------------------------------------- auxiliares

    @staticmethod
    def _normalizar_estado(estado: EstadoUnidad) -> EstadoUnidad:
        return estado if isinstance(estado, EstadoUnidad) else EstadoUnidad(estado)

    def _preparar_codigo(self, codigo: str, *, excluir_id: int | None = None) -> str:
        normalizado = str(CodigoUnidad(codigo))
        existente = self._unidades.obtener_por_codigo(normalizado)
        if existente is not None and existente.id != excluir_id:
            raise ReglaNegocioError(
                f"Ya existe una unidad con el código '{normalizado}' (RN-51)"
            )
        return normalizado

    def _crear_unidad(
        self,
        articulo: Articulo,
        codigo: str,
        *,
        descripcion: str | None,
        notas: str | None,
        estado: EstadoUnidad,
        fecha: str,
    ) -> tuple[ArticuloUnidad, Articulo]:
        unidad = self._unidades.crear(
            ArticuloUnidad(
                id=None,
                articulo_id=articulo.id,
                codigo=codigo,
                descripcion=descripcion,
                estado=estado,
                prestamo_detalle_id=None,
                verificado_en=None,
                notas=notas,
                creado_en=fecha,
                actualizado_en=fecha,
            )
        )
        nuevo = registrar_movimiento(
            self._articulos,
            self._movimientos,
            articulo,
            TipoMovimiento.ALTA,
            1,
            "Alta de unidad",
            fecha=fecha,
            unidad_id=unidad.id,
        )
        if estado == EstadoUnidad.DISPONIBLE:
            return unidad, nuevo
        tipo = _TRANSICIONES[(EstadoUnidad.DISPONIBLE, estado)]
        nuevo = calcular_contadores(nuevo, tipo, 1)
        self._articulos.actualizar_contadores(nuevo)
        self._movimientos.crear(
            construir_movimiento(
                nuevo,
                tipo,
                1,
                "Estado inicial de la unidad",
                fecha=fecha,
                unidad_id=unidad.id,
            )
        )
        return unidad, nuevo

    def _transicionar(
        self,
        articulo: Articulo,
        unidad: ArticuloUnidad,
        tipo: TipoMovimiento,
        estado_destino: EstadoUnidad,
        motivo: str,
        fecha: str,
    ) -> tuple[Articulo, ArticuloUnidad]:
        nuevo = calcular_contadores(articulo, tipo, 1)
        self._articulos.actualizar_contadores(nuevo)
        unidad_nueva = replace(unidad, estado=estado_destino, actualizado_en=fecha)
        self._unidades.actualizar(unidad_nueva)
        self._movimientos.crear(
            construir_movimiento(
                nuevo, tipo, 1, motivo, fecha=fecha, unidad_id=unidad.id
            )
        )
        return nuevo, unidad_nueva

    def _obtener_articulo(self, articulo_id: int) -> Articulo:
        articulo = self._articulos.obtener_por_id(articulo_id)
        if articulo is None:
            raise NoEncontradoError(f"No existe el artículo {articulo_id}")
        return articulo

    def _obtener_articulo_individual(self, articulo_id: int) -> Articulo:
        articulo = self._obtener_articulo(articulo_id)
        if not articulo.control_individual:
            raise ReglaNegocioError(
                "El artículo no tiene control individual: solo se maneja con cantidades (RN-50)"
            )
        return articulo

    def _obtener_unidad(self, unidad_id: int) -> ArticuloUnidad:
        unidad = self._unidades.obtener_por_id(unidad_id)
        if unidad is None:
            raise NoEncontradoError(f"No existe la unidad {unidad_id}")
        return unidad
