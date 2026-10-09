"""Repositorio de unidades individuales (RN-51, RN-52, RN-53)."""

from __future__ import annotations

import sqlite3
from dataclasses import replace

from ...domain.entidades import ArticuloUnidad
from ...domain.enums import EstadoUnidad
from ...domain.excepciones import NoEncontradoError
from ._comun import LIMITE_POR_DEFECTO, validar_pagina

_COLUMNAS = (
    "id, articulo_id, codigo, descripcion, estado, prestamo_detalle_id,"
    " verificado_en, notas, creado_en, actualizado_en"
)


def _a_entidad(fila: sqlite3.Row) -> ArticuloUnidad:
    return ArticuloUnidad(
        id=fila["id"],
        articulo_id=fila["articulo_id"],
        codigo=fila["codigo"],
        descripcion=fila["descripcion"],
        estado=EstadoUnidad(fila["estado"]),
        prestamo_detalle_id=fila["prestamo_detalle_id"],
        verificado_en=fila["verificado_en"],
        notas=fila["notas"],
        creado_en=fila["creado_en"],
        actualizado_en=fila["actualizado_en"],
    )


class ArticuloUnidadRepo:
    """Acceso a ``articulo_unidad`` (identificación individual opcional)."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def crear(self, unidad: ArticuloUnidad) -> ArticuloUnidad:
        cursor = self._conn.execute(
            "INSERT INTO articulo_unidad (articulo_id, codigo, descripcion, estado,"
            " prestamo_detalle_id, verificado_en, notas, creado_en, actualizado_en)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                unidad.articulo_id,
                unidad.codigo,
                unidad.descripcion,
                unidad.estado.value,
                unidad.prestamo_detalle_id,
                unidad.verificado_en,
                unidad.notas,
                unidad.creado_en,
                unidad.actualizado_en,
            ),
        )
        return replace(unidad, id=cursor.lastrowid)

    def obtener_por_id(self, unidad_id: int) -> ArticuloUnidad | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM articulo_unidad WHERE id = ?", (unidad_id,)
        ).fetchone()
        return _a_entidad(fila) if fila is not None else None

    def obtener_por_codigo(self, codigo: str) -> ArticuloUnidad | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM articulo_unidad WHERE codigo = ?", (codigo,)
        ).fetchone()
        return _a_entidad(fila) if fila is not None else None

    def listar_por_articulo(
        self,
        articulo_id: int,
        *,
        estado: EstadoUnidad | None = None,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[ArticuloUnidad]:
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        sql = f"SELECT {_COLUMNAS} FROM articulo_unidad WHERE articulo_id = ?"
        parametros: list[object] = [articulo_id]
        if estado is not None:
            sql += " AND estado = ?"
            parametros.append(estado.value)
        sql += " ORDER BY codigo COLLATE NOCASE LIMIT ? OFFSET ?"
        parametros += [limite, desplazamiento]
        return [_a_entidad(fila) for fila in self._conn.execute(sql, parametros)]

    def listar_por_estado(
        self,
        estado: EstadoUnidad,
        *,
        articulo_id: int | None = None,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[ArticuloUnidad]:
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        sql = f"SELECT {_COLUMNAS} FROM articulo_unidad WHERE estado = ?"
        parametros: list[object] = [estado.value]
        if articulo_id is not None:
            sql += " AND articulo_id = ?"
            parametros.append(articulo_id)
        sql += " ORDER BY articulo_id, codigo COLLATE NOCASE LIMIT ? OFFSET ?"
        parametros += [limite, desplazamiento]
        return [_a_entidad(fila) for fila in self._conn.execute(sql, parametros)]

    def listar_por_prestamo_detalle(self, prestamo_detalle_id: int) -> list[ArticuloUnidad]:
        filas = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM articulo_unidad WHERE prestamo_detalle_id = ?"
            " ORDER BY codigo COLLATE NOCASE",
            (prestamo_detalle_id,),
        )
        return [_a_entidad(fila) for fila in filas]

    def contar_por_articulo(
        self, articulo_id: int, *, estado: EstadoUnidad | None = None
    ) -> int:
        sql = "SELECT COUNT(*) FROM articulo_unidad WHERE articulo_id = ?"
        parametros: list[object] = [articulo_id]
        if estado is not None:
            sql += " AND estado = ?"
            parametros.append(estado.value)
        return int(self._conn.execute(sql, parametros).fetchone()[0])

    def actualizar(self, unidad: ArticuloUnidad) -> None:
        """Actualiza estado, préstamo asociado y metadatos de una unidad (RN-53)."""
        if unidad.id is None:
            raise ValueError("No se puede actualizar una unidad sin id")
        cursor = self._conn.execute(
            "UPDATE articulo_unidad SET descripcion = ?, estado = ?,"
            " prestamo_detalle_id = ?, verificado_en = ?, notas = ?,"
            " actualizado_en = ? WHERE id = ?",
            (
                unidad.descripcion,
                unidad.estado.value,
                unidad.prestamo_detalle_id,
                unidad.verificado_en,
                unidad.notas,
                unidad.actualizado_en,
                unidad.id,
            ),
        )
        if cursor.rowcount == 0:
            raise NoEncontradoError(f"No existe la unidad {unidad.id}")
