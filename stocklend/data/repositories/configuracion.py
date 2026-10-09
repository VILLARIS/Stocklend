"""Repositorio de configuración (clave/valor), usado por contadores y preferencias."""

from __future__ import annotations

import sqlite3

from ...domain.entidades import Configuracion
from ._comun import LIMITE_POR_DEFECTO, validar_pagina

_COLUMNAS = "clave, valor, actualizado_en"


def _a_entidad(fila: sqlite3.Row) -> Configuracion:
    return Configuracion(
        clave=fila["clave"],
        valor=fila["valor"],
        actualizado_en=fila["actualizado_en"],
    )


class ConfiguracionRepo:
    """Acceso a ``configuracion`` con escritura *upsert* (RN-20: contador de folios)."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def obtener(self, clave: str) -> str | None:
        fila = self._conn.execute(
            "SELECT valor FROM configuracion WHERE clave = ?", (clave,)
        ).fetchone()
        return fila["valor"] if fila is not None else None

    def obtener_entrada(self, clave: str) -> Configuracion | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM configuracion WHERE clave = ?", (clave,)
        ).fetchone()
        return _a_entidad(fila) if fila is not None else None

    def listar(
        self,
        *,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[Configuracion]:
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        filas = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM configuracion ORDER BY clave LIMIT ? OFFSET ?",
            (limite, desplazamiento),
        )
        return [_a_entidad(fila) for fila in filas]

    def contar(self) -> int:
        return int(self._conn.execute("SELECT COUNT(*) FROM configuracion").fetchone()[0])

    def establecer(self, clave: str, valor: str, actualizado_en: str) -> None:
        self._conn.execute(
            "INSERT INTO configuracion (clave, valor, actualizado_en) VALUES (?, ?, ?)"
            " ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor,"
            " actualizado_en = excluded.actualizado_en",
            (clave, valor, actualizado_en),
        )
