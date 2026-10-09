"""Inventario de artículos y categorías (Etapa 3).

`InventarioService` es la puerta de entrada para dar de alta categorías y
artículos, buscar, corregir existencias con motivo y consultar el historial de
movimientos. Los artículos con control individual no se ajustan por cantidad:
sus existencias se derivan de sus unidades (RN-61) y se gestionan con
`UnidadService`.
"""

from __future__ import annotations

import sqlite3
from dataclasses import replace

from ..data.database import transaction
from ..data.repositories import ArticuloRepo, CategoriaRepo, MovimientoRepo
from ..domain.entidades import Articulo, Categoria, MovimientoInventario
from ..domain.enums import TipoMovimiento
from ..domain.excepciones import NoEncontradoError, ReglaNegocioError
from ._comun import (
    SIN_CAMBIO,
    ahora,
    entero_no_negativo,
    registrar_movimiento,
    texto_obligatorio,
    validar_motivo,
)

_MOTIVO_ALTA = "Alta inicial"


class InventarioService:
    """Casos de uso de inventario sobre una conexión ya abierta."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._categorias = CategoriaRepo(conn)
        self._articulos = ArticuloRepo(conn)
        self._movimientos = MovimientoRepo(conn)

    # ------------------------------------------------------------- categorías

    def registrar_categoria(
        self, nombre: str, descripcion: str | None = None, *, fecha: str | None = None
    ) -> Categoria:
        """Crea una categoría con nombre obligatorio y único (RN-10, RN-46)."""
        nombre = texto_obligatorio(nombre, "El nombre de la categoría")
        with transaction(self._conn):
            if self._categorias.obtener_por_nombre(nombre) is not None:
                raise ReglaNegocioError(
                    f"Ya existe una categoría con el nombre '{nombre}'"
                )
            return self._categorias.crear(
                Categoria(
                    id=None,
                    nombre=nombre,
                    descripcion=descripcion,
                    activo=True,
                    creado_en=fecha or ahora(),
                )
            )

    def obtener_categoria(self, categoria_id: int) -> Categoria:
        with transaction(self._conn):
            return self._obtener_categoria(categoria_id)

    def listar_categorias(
        self,
        *,
        solo_activas: bool = False,
        limite: int = 50,
        desplazamiento: int = 0,
    ) -> list[Categoria]:
        with transaction(self._conn):
            return self._categorias.listar(
                solo_activas=solo_activas,
                limite=limite,
                desplazamiento=desplazamiento,
            )

    def editar_categoria(
        self,
        categoria_id: int,
        *,
        nombre: str | None = None,
        descripcion: str | object = SIN_CAMBIO,
        activo: bool | None = None,
        fecha: str | None = None,
    ) -> Categoria:
        with transaction(self._conn):
            categoria = self._obtener_categoria(categoria_id)
            nuevo_nombre = categoria.nombre
            if nombre is not None:
                nuevo_nombre = texto_obligatorio(nombre, "El nombre de la categoría")
                if nuevo_nombre != categoria.nombre:
                    existente = self._categorias.obtener_por_nombre(nuevo_nombre)
                    if existente is not None and existente.id != categoria.id:
                        raise ReglaNegocioError(
                            f"Ya existe una categoría con el nombre '{nuevo_nombre}'"
                        )
            actualizada = replace(
                categoria,
                nombre=nuevo_nombre,
                descripcion=(
                    categoria.descripcion if descripcion is SIN_CAMBIO else descripcion
                ),
                activo=categoria.activo if activo is None else bool(activo),
            )
            self._categorias.actualizar(actualizada)
            return actualizada

    # --------------------------------------------------------------- artículos

    def registrar_articulo(
        self,
        nombre: str,
        categoria_id: int,
        *,
        codigo: str | None = None,
        unidad_medida: str = "unidad",
        notas: str | None = None,
        control_individual: bool = False,
        prestable: bool = True,
        cantidad_inicial: int = 0,
        motivo: str | None = None,
        fecha: str | None = None,
    ) -> Articulo:
        """Crea un artículo y, si trae cantidad inicial, su movimiento ``alta``.

        Un artículo con ``control_individual`` se registra sin cantidad: sus
        unidades se dan de alta una a una con `UnidadService` (RN-50, RN-51).
        """
        nombre = texto_obligatorio(nombre, "El nombre del artículo")
        cantidad = entero_no_negativo(cantidad_inicial, "La cantidad inicial")
        if motivo is not None:
            motivo = validar_motivo(motivo)
        codigo_limpio = codigo.strip() if isinstance(codigo, str) and codigo.strip() else None
        with transaction(self._conn):
            if self._categorias.obtener_por_id(categoria_id) is None:
                raise NoEncontradoError(f"No existe la categoría {categoria_id}")
            if (
                self._articulos.obtener_por_nombre_y_categoria(categoria_id, nombre)
                is not None
            ):
                raise ReglaNegocioError(
                    f"Ya existe un artículo '{nombre}' en esa categoría (RN-09)"
                )
            if codigo_limpio is not None and (
                self._articulos.obtener_por_codigo(codigo_limpio) is not None
            ):
                raise ReglaNegocioError(f"Ya existe un artículo con el código '{codigo_limpio}'")
            if control_individual and cantidad:
                raise ReglaNegocioError(
                    "Un artículo con control individual se registra sin cantidad;"
                    " dé de alta sus unidades con su código (RN-50)"
                )
            creado_en = fecha or ahora()
            articulo = self._articulos.crear(
                Articulo(
                    id=None,
                    codigo=codigo_limpio,
                    nombre=nombre,
                    categoria_id=categoria_id,
                    unidad_medida=unidad_medida or "unidad",
                    notas=notas,
                    control_individual=bool(control_individual),
                    prestable=bool(prestable),
                    activo=True,
                    cantidad_total=0,
                    cantidad_disponible=0,
                    cantidad_prestada=0,
                    cantidad_daniada=0,
                    cantidad_faltante=0,
                    creado_en=creado_en,
                    actualizado_en=creado_en,
                )
            )
            if cantidad == 0:
                return articulo
            return registrar_movimiento(
                self._articulos,
                self._movimientos,
                articulo,
                TipoMovimiento.ALTA,
                cantidad,
                motivo or _MOTIVO_ALTA,
                fecha=creado_en,
            )

    def obtener_articulo(self, articulo_id: int) -> Articulo:
        with transaction(self._conn):
            return self._obtener_articulo(articulo_id)

    def listar_articulos(
        self,
        *,
        solo_activos: bool = False,
        categoria_id: int | None = None,
        limite: int = 50,
        desplazamiento: int = 0,
    ) -> list[Articulo]:
        with transaction(self._conn):
            return self._articulos.listar(
                solo_activos=solo_activos,
                categoria_id=categoria_id,
                limite=limite,
                desplazamiento=desplazamiento,
            )

    def buscar_articulos(
        self, termino: str, *, limite: int = 50, desplazamiento: int = 0
    ) -> list[Articulo]:
        with transaction(self._conn):
            return self._articulos.buscar(
                termino, limite=limite, desplazamiento=desplazamiento
            )

    def editar_articulo(
        self,
        articulo_id: int,
        *,
        nombre: str | None = None,
        codigo: str | object = SIN_CAMBIO,
        categoria_id: int | None = None,
        unidad_medida: str | None = None,
        notas: str | object = SIN_CAMBIO,
        prestable: bool | None = None,
        activo: bool | None = None,
        fecha: str | None = None,
    ) -> Articulo:
        """Actualiza los datos descriptivos; nunca toca los contadores (RN-15)."""
        with transaction(self._conn):
            articulo = self._obtener_articulo(articulo_id)
            nuevo_nombre = articulo.nombre
            if nombre is not None:
                nuevo_nombre = texto_obligatorio(nombre, "El nombre del artículo")
            nueva_categoria = articulo.categoria_id
            if categoria_id is not None:
                if self._categorias.obtener_por_id(categoria_id) is None:
                    raise NoEncontradoError(f"No existe la categoría {categoria_id}")
                nueva_categoria = categoria_id
            if (nuevo_nombre, nueva_categoria) != (
                articulo.nombre,
                articulo.categoria_id,
            ):
                existente = self._articulos.obtener_por_nombre_y_categoria(
                    nueva_categoria, nuevo_nombre
                )
                if existente is not None and existente.id != articulo.id:
                    raise ReglaNegocioError(
                        f"Ya existe un artículo '{nuevo_nombre}' en esa categoría (RN-09)"
                    )
            nuevo_codigo = articulo.codigo
            if codigo is not SIN_CAMBIO:
                nuevo_codigo = (
                    codigo.strip()
                    if isinstance(codigo, str) and codigo.strip()
                    else None
                )
                if nuevo_codigo is not None:
                    existente = self._articulos.obtener_por_codigo(nuevo_codigo)
                    if existente is not None and existente.id != articulo.id:
                        raise ReglaNegocioError(
                            f"Ya existe un artículo con el código '{nuevo_codigo}'"
                        )
            actualizado = replace(
                articulo,
                nombre=nuevo_nombre,
                codigo=nuevo_codigo,
                categoria_id=nueva_categoria,
                unidad_medida=(
                    articulo.unidad_medida
                    if unidad_medida is None
                    else (unidad_medida or "unidad")
                ),
                notas=articulo.notas if notas is SIN_CAMBIO else notas,
                prestable=articulo.prestable if prestable is None else bool(prestable),
                activo=articulo.activo if activo is None else bool(activo),
                actualizado_en=fecha or ahora(),
            )
            self._articulos.actualizar_datos(actualizado)
            return actualizado

    def ajustar_cantidad(
        self,
        articulo_id: int,
        nueva_cantidad: int,
        motivo: str,
        *,
        fecha: str | None = None,
        referencia_id: int | None = None,
    ) -> Articulo:
        """Fija la cantidad total con un movimiento de ajuste y motivo (RN-05, RN-06).

        Si el ajuste es negativo, la diferencia se descuenta de lo disponible; si
        no alcanza, se rechaza sin modificar nada.
        """
        motivo = validar_motivo(motivo)
        nueva = entero_no_negativo(nueva_cantidad, "La cantidad")
        with transaction(self._conn):
            articulo = self._obtener_articulo(articulo_id)
            if articulo.control_individual:
                raise ReglaNegocioError(
                    "Un artículo con control individual no se ajusta por cantidad;"
                    " cambie el estado de sus unidades (RN-61)"
                )
            diferencia = nueva - articulo.cantidad_total
            if diferencia == 0:
                return articulo
            tipo = (
                TipoMovimiento.AJUSTE_POSITIVO
                if diferencia > 0
                else TipoMovimiento.AJUSTE_NEGATIVO
            )
            return registrar_movimiento(
                self._articulos,
                self._movimientos,
                articulo,
                tipo,
                abs(diferencia),
                motivo,
                fecha=fecha or ahora(),
                referencia_tipo="ajuste",
                referencia_id=referencia_id,
            )

    def aplicar_movimiento(
        self,
        articulo_id: int,
        tipo: TipoMovimiento,
        cantidad: int,
        motivo: str,
        *,
        fecha: str | None = None,
        unidad_id: int | None = None,
        referencia_tipo: str | None = None,
        referencia_id: int | None = None,
    ) -> Articulo:
        """Aplica uno de los 12 tipos de movimiento al artículo (RN-58, RN-59).

        Es la primitiva que reutilizan las etapas siguientes para préstamos,
        devoluciones e incidentes; actualiza los contadores de forma determinista
        según el cubo de origen que declara el tipo.
        """
        motivo = validar_motivo(motivo)
        tipo = tipo if isinstance(tipo, TipoMovimiento) else TipoMovimiento(tipo)
        with transaction(self._conn):
            articulo = self._obtener_articulo(articulo_id)
            return registrar_movimiento(
                self._articulos,
                self._movimientos,
                articulo,
                tipo,
                cantidad,
                motivo,
                fecha=fecha or ahora(),
                unidad_id=unidad_id,
                referencia_tipo=referencia_tipo,
                referencia_id=referencia_id,
            )

    def listar_movimientos(
        self,
        articulo_id: int,
        *,
        desde: str | None = None,
        hasta: str | None = None,
        limite: int = 50,
        desplazamiento: int = 0,
    ) -> list[MovimientoInventario]:
        with transaction(self._conn):
            self._obtener_articulo(articulo_id)
            return self._movimientos.listar_por_articulo(
                articulo_id,
                desde=desde,
                hasta=hasta,
                limite=limite,
                desplazamiento=desplazamiento,
            )

    # ------------------------------------------------------------- auxiliares

    def _obtener_categoria(self, categoria_id: int) -> Categoria:
        categoria = self._categorias.obtener_por_id(categoria_id)
        if categoria is None:
            raise NoEncontradoError(f"No existe la categoría {categoria_id}")
        return categoria

    def _obtener_articulo(self, articulo_id: int) -> Articulo:
        articulo = self._articulos.obtener_por_id(articulo_id)
        if articulo is None:
            raise NoEncontradoError(f"No existe el artículo {articulo_id}")
        return articulo
