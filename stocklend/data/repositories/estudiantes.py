"""Repositorio de estudiantes (RN-11 a RN-15)."""

from __future__ import annotations

import sqlite3
from dataclasses import replace

from ...domain.entidades import Estudiante
from ...domain.excepciones import NoEncontradoError
from ._comun import LIMITE_POR_DEFECTO, validar_pagina

_COLUMNAS = (
    "id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en"
)


def _a_entidad(fila: sqlite3.Row) -> Estudiante:
    return Estudiante(
        id=fila["id"],
        codigo_universitario=fila["codigo_universitario"],
        nombres=fila["nombres"],
        apellidos=fila["apellidos"],
        activo=bool(fila["activo"]),
        creado_en=fila["creado_en"],
        actualizado_en=fila["actualizado_en"],
    )


class EstudianteRepo:
    """Acceso a ``estudiante``. No expone ``DELETE`` (RN-14, RN-46)."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def crear(self, estudiante: Estudiante) -> Estudiante:
        cursor = self._conn.execute(
            "INSERT INTO estudiante (codigo_universitario, nombres, apellidos,"
            " activo, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?)",
            (
                estudiante.codigo_universitario,
                estudiante.nombres,
                estudiante.apellidos,
                int(estudiante.activo),
                estudiante.creado_en,
                estudiante.actualizado_en,
            ),
        )
        return replace(estudiante, id=cursor.lastrowid)

    def obtener_por_id(self, estudiante_id: int) -> Estudiante | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM estudiante WHERE id = ?", (estudiante_id,)
        ).fetchone()
        return _a_entidad(fila) if fila is not None else None

    def obtener_por_codigo(self, codigo: str) -> Estudiante | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM estudiante WHERE codigo_universitario = ?",
            (codigo,),
        ).fetchone()
        return _a_entidad(fila) if fila is not None else None

    def listar(
        self,
        *,
        solo_activos: bool = False,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[Estudiante]:
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        sql = f"SELECT {_COLUMNAS} FROM estudiante"
        if solo_activos:
            sql += " WHERE activo = 1"
        sql += " ORDER BY apellidos COLLATE NOCASE, nombres COLLATE NOCASE"
        sql += " LIMIT ? OFFSET ?"
        filas = self._conn.execute(sql, (limite, desplazamiento))
        return [_a_entidad(fila) for fila in filas]

    def buscar(
        self,
        termino: str,
        *,
        solo_activos: bool = False,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[Estudiante]:
        """Búsqueda por código, nombres o apellidos (DATABASE_DESIGN §8.5)."""
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        patron = f"%{termino}%"
        sql = (
            f"SELECT {_COLUMNAS} FROM estudiante"
            " WHERE (codigo_universitario LIKE ? OR nombres LIKE ? OR apellidos LIKE ?)"
        )
        parametros: list[object] = [patron, patron, patron]
        if solo_activos:
            sql += " AND activo = 1"
        sql += " ORDER BY apellidos COLLATE NOCASE, nombres COLLATE NOCASE"
        sql += " LIMIT ? OFFSET ?"
        parametros += [limite, desplazamiento]
        return [_a_entidad(fila) for fila in self._conn.execute(sql, parametros)]

    def contar(self, *, solo_activos: bool = False) -> int:
        sql = "SELECT COUNT(*) FROM estudiante"
        if solo_activos:
            sql += " WHERE activo = 1"
        return int(self._conn.execute(sql).fetchone()[0])

    def tiene_prestamos(self, estudiante_id: int) -> bool:
        """Indica si el estudiante tiene algún préstamo registrado (RN-14)."""
        fila = self._conn.execute(
            "SELECT 1 FROM prestamo WHERE estudiante_id = ? LIMIT 1", (estudiante_id,)
        ).fetchone()
        return fila is not None

    def actualizar(self, estudiante: Estudiante) -> None:
        if estudiante.id is None:
            raise ValueError("No se puede actualizar un estudiante sin id")
        cursor = self._conn.execute(
            "UPDATE estudiante SET codigo_universitario = ?, nombres = ?,"
            " apellidos = ?, activo = ?, actualizado_en = ? WHERE id = ?",
            (
                estudiante.codigo_universitario,
                estudiante.nombres,
                estudiante.apellidos,
                int(estudiante.activo),
                estudiante.actualizado_en,
                estudiante.id,
            ),
        )
        if cursor.rowcount == 0:
            raise NoEncontradoError(f"No existe el estudiante {estudiante.id}")
