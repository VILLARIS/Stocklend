"""Repositorio de artículos (RN-01, RN-02, RN-09; DATABASE_DESIGN §4.2)."""

from __future__ import annotations

import sqlite3
from dataclasses import replace

from ...domain.entidades import Articulo, ResumenInventario
from ...domain.excepciones import NoEncontradoError
from ._comun import LIMITE_POR_DEFECTO, validar_pagina

_COLUMNAS = (
    "id, codigo, nombre, categoria_id, unidad_medida, notas, control_individual,"
    " prestable, activo, cantidad_total, cantidad_disponible, cantidad_prestada,"
    " cantidad_daniada, cantidad_faltante, creado_en, actualizado_en"
)


def _a_entidad(fila: sqlite3.Row) -> Articulo:
    return Articulo(
        id=fila["id"],
        codigo=fila["codigo"],
        nombre=fila["nombre"],
        categoria_id=fila["categoria_id"],
        unidad_medida=fila["unidad_medida"],
        notas=fila["notas"],
        control_individual=bool(fila["control_individual"]),
        prestable=bool(fila["prestable"]),
        activo=bool(fila["activo"]),
        cantidad_total=fila["cantidad_total"],
        cantidad_disponible=fila["cantidad_disponible"],
        cantidad_prestada=fila["cantidad_prestada"],
        cantidad_daniada=fila["cantidad_daniada"],
        cantidad_faltante=fila["cantidad_faltante"],
        creado_en=fila["creado_en"],
        actualizado_en=fila["actualizado_en"],
    )


class ArticuloRepo:
    """Acceso a ``articulo``. Los contadores se escriben siempre en bloque (RN-02)."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def crear(self, articulo: Articulo) -> Articulo:
        cursor = self._conn.execute(
            "INSERT INTO articulo (codigo, nombre, categoria_id, unidad_medida,"
            " notas, control_individual, prestable, activo, cantidad_total,"
            " cantidad_disponible, cantidad_prestada, cantidad_daniada,"
            " cantidad_faltante, creado_en, actualizado_en)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                articulo.codigo,
                articulo.nombre,
                articulo.categoria_id,
                articulo.unidad_medida,
                articulo.notas,
                int(articulo.control_individual),
                int(articulo.prestable),
                int(articulo.activo),
                articulo.cantidad_total,
                articulo.cantidad_disponible,
                articulo.cantidad_prestada,
                articulo.cantidad_daniada,
                articulo.cantidad_faltante,
                articulo.creado_en,
                articulo.actualizado_en,
            ),
        )
        return replace(articulo, id=cursor.lastrowid)

    def obtener_por_id(self, articulo_id: int) -> Articulo | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM articulo WHERE id = ?", (articulo_id,)
        ).fetchone()
        return _a_entidad(fila) if fila is not None else None

    def obtener_por_codigo(self, codigo: str | None) -> Articulo | None:
        if codigo is None:
            return None
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM articulo WHERE codigo = ?", (codigo,)
        ).fetchone()
        return _a_entidad(fila) if fila is not None else None

    def obtener_por_nombre_y_categoria(
        self, categoria_id: int, nombre: str
    ) -> Articulo | None:
        """Busca por la clave lógica ``(categoria_id, nombre)`` (RN-09)."""
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM articulo WHERE categoria_id = ? AND nombre = ?",
            (categoria_id, nombre),
        ).fetchone()
        return _a_entidad(fila) if fila is not None else None

    def listar(
        self,
        *,
        solo_activos: bool = False,
        categoria_id: int | None = None,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[Articulo]:
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        condiciones: list[str] = []
        parametros: list[object] = []
        if solo_activos:
            condiciones.append("activo = 1")
        if categoria_id is not None:
            condiciones.append("categoria_id = ?")
            parametros.append(categoria_id)
        sql = f"SELECT {_COLUMNAS} FROM articulo"
        if condiciones:
            sql += " WHERE " + " AND ".join(condiciones)
        sql += " ORDER BY nombre COLLATE NOCASE LIMIT ? OFFSET ?"
        parametros += [limite, desplazamiento]
        filas = self._conn.execute(sql, parametros)
        return [_a_entidad(fila) for fila in filas]

    def listar_por_categoria(
        self,
        categoria_id: int,
        *,
        solo_activos: bool = False,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[Articulo]:
        return self.listar(
            solo_activos=solo_activos,
            categoria_id=categoria_id,
            limite=limite,
            desplazamiento=desplazamiento,
        )

    def buscar(
        self,
        termino: str,
        *,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[Articulo]:
        """Búsqueda por nombre, código o categoría (DATABASE_DESIGN §8.4)."""
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        patron = f"%{termino}%"
        filas = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM articulo a"
            " WHERE a.nombre LIKE ? OR a.codigo LIKE ?"
            " OR EXISTS (SELECT 1 FROM categoria c"
            "            WHERE c.id = a.categoria_id AND c.nombre LIKE ?)"
            " ORDER BY a.nombre COLLATE NOCASE LIMIT ? OFFSET ?",
            (patron, patron, patron, limite, desplazamiento),
        )
        return [_a_entidad(fila) for fila in filas]

    def contar(
        self,
        *,
        solo_activos: bool = False,
        categoria_id: int | None = None,
    ) -> int:
        condiciones: list[str] = []
        parametros: list[object] = []
        if solo_activos:
            condiciones.append("activo = 1")
        if categoria_id is not None:
            condiciones.append("categoria_id = ?")
            parametros.append(categoria_id)
        sql = "SELECT COUNT(*) FROM articulo"
        if condiciones:
            sql += " WHERE " + " AND ".join(condiciones)
        return int(self._conn.execute(sql, parametros).fetchone()[0])

    def resumen(self) -> ResumenInventario:
        """Agrega el inventario en una sola consulta (RF-INV-05).

        Cuenta los artículos y suma sus contadores con SQL, sin traer las filas a
        memoria ni modificar el esquema.
        """
        fila = self._conn.execute(
            "SELECT COUNT(*) AS articulos,"
            " COALESCE(SUM(cantidad_total), 0) AS total,"
            " COALESCE(SUM(cantidad_disponible), 0) AS disponible,"
            " COALESCE(SUM(cantidad_prestada), 0) AS prestada"
            " FROM articulo"
        ).fetchone()
        return ResumenInventario(
            articulos=int(fila["articulos"]),
            unidades_total=int(fila["total"]),
            disponibles=int(fila["disponible"]),
            prestadas=int(fila["prestada"]),
        )

    def actualizar_datos(self, articulo: Articulo) -> None:
        """Actualiza los campos descriptivos, sin tocar los contadores."""
        if articulo.id is None:
            raise ValueError("No se puede actualizar un artículo sin id")
        cursor = self._conn.execute(
            "UPDATE articulo SET codigo = ?, nombre = ?, categoria_id = ?,"
            " unidad_medida = ?, notas = ?, control_individual = ?, prestable = ?,"
            " activo = ?, actualizado_en = ? WHERE id = ?",
            (
                articulo.codigo,
                articulo.nombre,
                articulo.categoria_id,
                articulo.unidad_medida,
                articulo.notas,
                int(articulo.control_individual),
                int(articulo.prestable),
                int(articulo.activo),
                articulo.actualizado_en,
                articulo.id,
            ),
        )
        if cursor.rowcount == 0:
            raise NoEncontradoError(f"No existe el artículo {articulo.id}")

    def actualizar_contadores(self, articulo: Articulo) -> None:
        """Escribe los cinco contadores a la vez, respetando la invariante RN-02."""
        if articulo.id is None:
            raise ValueError("No se puede actualizar un artículo sin id")
        cursor = self._conn.execute(
            "UPDATE articulo SET cantidad_total = ?, cantidad_disponible = ?,"
            " cantidad_prestada = ?, cantidad_daniada = ?, cantidad_faltante = ?,"
            " actualizado_en = ? WHERE id = ?",
            (
                articulo.cantidad_total,
                articulo.cantidad_disponible,
                articulo.cantidad_prestada,
                articulo.cantidad_daniada,
                articulo.cantidad_faltante,
                articulo.actualizado_en,
                articulo.id,
            ),
        )
        if cursor.rowcount == 0:
            raise NoEncontradoError(f"No existe el artículo {articulo.id}")
