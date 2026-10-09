"""Repositorio de categorías (RN-10, RN-46)."""

from __future__ import annotations

import sqlite3
from dataclasses import replace

from ...domain.entidades import Categoria
from ...domain.excepciones import NoEncontradoError
from ._comun import LIMITE_POR_DEFECTO, validar_pagina

_COLUMNAS = "id, nombre, descripcion, activo, creado_en"


def _a_entidad(fila: sqlite3.Row) -> Categoria:
    return Categoria(
        id=fila["id"],
        nombre=fila["nombre"],
        descripcion=fila["descripcion"],
        activo=bool(fila["activo"]),
        creado_en=fila["creado_en"],
    )


class CategoriaRepo:
    """Acceso a ``categoria``. No expone ``DELETE`` (RN-46)."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def crear(self, categoria: Categoria) -> Categoria:
        cursor = self._conn.execute(
            "INSERT INTO categoria (nombre, descripcion, activo, creado_en)"
            " VALUES (?, ?, ?, ?)",
            (
                categoria.nombre,
                categoria.descripcion,
                int(categoria.activo),
                categoria.creado_en,
            ),
        )
        return replace(categoria, id=cursor.lastrowid)

    def obtener_por_id(self, categoria_id: int) -> Categoria | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM categoria WHERE id = ?", (categoria_id,)
        ).fetchone()
        return _a_entidad(fila) if fila is not None else None

    def obtener_por_nombre(self, nombre: str) -> Categoria | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM categoria WHERE nombre = ?", (nombre,)
        ).fetchone()
        return _a_entidad(fila) if fila is not None else None

    def listar(
        self,
        *,
        solo_activas: bool = False,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[Categoria]:
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        sql = f"SELECT {_COLUMNAS} FROM categoria"
        if solo_activas:
            sql += " WHERE activo = 1"
        sql += " ORDER BY nombre COLLATE NOCASE LIMIT ? OFFSET ?"
        filas = self._conn.execute(sql, (limite, desplazamiento))
        return [_a_entidad(fila) for fila in filas]

    def contar(self, *, solo_activas: bool = False) -> int:
        sql = "SELECT COUNT(*) FROM categoria"
        if solo_activas:
            sql += " WHERE activo = 1"
        return int(self._conn.execute(sql).fetchone()[0])

    def actualizar(self, categoria: Categoria) -> None:
        if categoria.id is None:
            raise ValueError("No se puede actualizar una categoría sin id")
        cursor = self._conn.execute(
            "UPDATE categoria SET nombre = ?, descripcion = ?, activo = ? WHERE id = ?",
            (
                categoria.nombre,
                categoria.descripcion,
                int(categoria.activo),
                categoria.id,
            ),
        )
        if cursor.rowcount == 0:
            raise NoEncontradoError(f"No existe la categoría {categoria.id}")
