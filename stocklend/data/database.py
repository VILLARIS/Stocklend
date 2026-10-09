"""Conexión a SQLite con PRAGMA y transacciones (ADR-02, ADR-09, DATABASE_DESIGN §9)."""

from __future__ import annotations

import logging
import sqlite3
import unicodedata
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from ..core.constants import BUSY_TIMEOUT_MS

logger = logging.getLogger("stocklend.database")


def sin_acentos(texto: str | None) -> str | None:
    """Pliega un texto para búsquedas: sin acentos, sin distinción de mayúsculas (RN-13).

    Se registra como función SQL determinista en cada conexión para que la
    comparación se haga en la base y la paginación siga siendo correcta.
    """
    if texto is None:
        return None
    descompuesto = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in descompuesto if not unicodedata.combining(c)).lower()


def connect(db_path: str | Path = ":memory:") -> sqlite3.Connection:
    """Abre la base con los PRAGMA de conexión obligatorios (§9, ADR-09)."""
    ruta = str(db_path)
    if ruta != ":memory:":
        Path(ruta).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(ruta, timeout=BUSY_TIMEOUT_MS / 1000, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.create_function("sin_acentos", 1, sin_acentos, deterministic=True)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute(f"PRAGMA busy_timeout = {BUSY_TIMEOUT_MS}")
    conn.execute("PRAGMA temp_store = MEMORY")
    if ruta != ":memory:":
        modo = conn.execute("PRAGMA journal_mode = WAL").fetchone()[0]
        if str(modo).lower() != "wal":
            logger.warning("journal_mode WAL no disponible; la base queda en %s", modo)
    return conn


def close(conn: sqlite3.Connection) -> None:
    conn.close()


def foreign_keys_activo(conn: sqlite3.Connection) -> bool:
    return bool(conn.execute("PRAGMA foreign_keys").fetchone()[0])


def user_version(conn: sqlite3.Connection) -> int:
    return int(conn.execute("PRAGMA user_version").fetchone()[0])


def integridad(conn: sqlite3.Connection) -> str:
    return str(conn.execute("PRAGMA integrity_check").fetchone()[0])


@contextmanager
def transaction(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """Transacción ``BEGIN IMMEDIATE`` con commit o rollback (§9.1)."""
    if conn.in_transaction:
        raise RuntimeError("ya hay una transacción activa en esta conexión")
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
    except BaseException:
        conn.rollback()
        raise
    else:
        conn.commit()
