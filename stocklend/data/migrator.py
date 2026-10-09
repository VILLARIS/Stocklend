"""Ejecutor de migraciones con ``PRAGMA user_version`` (ADR-10, DATABASE_DESIGN §10).

Reglas de la sección 10: un archivo ``NNNN_nombre.sql`` por versión, aplicación
en orden ascendente y solo hacia adelante, cada migración en su propia
transacción, y copia de seguridad automática antes de aplicar una migración
cuando ya existe una versión aplicada.
"""

from __future__ import annotations

import logging
import re
import sqlite3
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("stocklend.migrator")

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
_NOMBRE = re.compile(r"^(\d{4})_[a-z0-9_]+\.sql$")


def current_version(conn: sqlite3.Connection) -> int:
    return int(conn.execute("PRAGMA user_version").fetchone()[0])


def list_migrations(directory: Path | None = None) -> list[tuple[int, Path]]:
    """Devuelve las migraciones ordenadas por versión; valida nombres únicos."""
    origen = directory if directory is not None else MIGRATIONS_DIR
    encontradas: dict[int, Path] = {}
    for path in sorted(origen.glob("*.sql")):
        coincidencia = _NOMBRE.match(path.name)
        if coincidencia is None:
            raise ValueError(f"nombre de migración inválido: {path.name}")
        version = int(coincidencia.group(1))
        if version in encontradas:
            raise ValueError(
                f"versión {version} duplicada: {encontradas[version].name} y {path.name}"
            )
        encontradas[version] = path
    return sorted(encontradas.items())


def _backup(conn: sqlite3.Connection, backup_dir: Path) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    marca = datetime.now().strftime("%Y%m%d_%H%M%S")
    destino = backup_dir / f"respaldo_migracion_{marca}.sqlite"
    contador = 1
    while destino.exists():
        destino = backup_dir / f"respaldo_migracion_{marca}_{contador}.sqlite"
        contador += 1
    destino_conn = sqlite3.connect(destino)
    try:
        conn.backup(destino_conn)
    finally:
        destino_conn.close()
    logger.info("copia de seguridad previa a la migración: %s", destino)
    return destino


def _apply(conn: sqlite3.Connection, version: int, sql: str) -> None:
    script = f"BEGIN IMMEDIATE;\n{sql}\nPRAGMA user_version = {version};\nCOMMIT;\n"
    try:
        conn.executescript(script)
    except BaseException:
        if conn.in_transaction:
            conn.execute("ROLLBACK")
        raise


def migrate(
    conn: sqlite3.Connection,
    *,
    directory: Path | None = None,
    backup_dir: Path | None = None,
) -> list[int]:
    """Aplica las migraciones pendientes en orden ascendente. Devuelve las aplicadas."""
    version_actual = current_version(conn)
    pendientes = [
        (version, path)
        for version, path in list_migrations(directory)
        if version > version_actual
    ]
    if not pendientes:
        return []
    if version_actual > 0 and backup_dir is not None:
        _backup(conn, backup_dir)
    aplicadas: list[int] = []
    for version, path in pendientes:
        if version <= current_version(conn):
            continue
        sql = path.read_text(encoding="utf-8")
        try:
            _apply(conn, version, sql)
        except sqlite3.Error:
            logger.error(
                "la migración %04d falló; la base queda en la versión %d", version, version
            )
            raise
        aplicadas.append(version)
        logger.info("migración %04d aplicada desde %s", version, path.name)
    return aplicadas
