"""Punto de entrada: configuración, logging, migración y arranque del armazón.

No contiene lógica de negocio (ni inventario, ni estudiantes, ni préstamos). Desde
la Etapa 5 abre la ventana única con barra lateral y páginas navegables.
"""

from __future__ import annotations

import argparse
import logging
import sqlite3
import sys

from .core import paths
from .core.constants import APP_NAME, APP_VERSION, SCHEMA_VERSION
from .core.container import construir
from .core.logging_setup import setup_logging
from .data import database, migrator

logger = logging.getLogger("stocklend.app")


def bootstrap() -> tuple[sqlite3.Connection, list[int]]:
    """Prepara directorios, registro y base de datos. Aplica migraciones pendientes."""
    paths.ensure_data_dirs()
    setup_logging()
    conn = database.connect(paths.db_path())
    aplicadas = migrator.migrate(conn, backup_dir=paths.respaldos_dir())
    return conn, aplicadas


def _resumen(conn: "sqlite3.Connection", aplicadas: list[int]) -> str:
    version = database.user_version(conn)
    foreign_keys = 1 if database.foreign_keys_activo(conn) else 0
    texto = (
        f"{APP_NAME} {APP_VERSION} · base lista · esquema user_version={version}"
        f" · foreign_keys={foreign_keys}"
    )
    if aplicadas:
        texto += f" · migraciones aplicadas: {', '.join(f'{v:04d}' for v in aplicadas)}"
    return texto


def abrir_ventana(conn: sqlite3.Connection) -> int:
    """Aplica el tema, compone los servicios y muestra la ventana principal."""
    try:
        from PySide6.QtWidgets import QApplication
    except ImportError:
        logger.exception("PySide6 no está disponible; no se puede abrir la ventana")
        print("PySide6 no está instalado; usa --check para verificar la base.", file=sys.stderr)
        return 1

    from .ui.main_window import VentanaPrincipal
    from .ui.theme import aplicar_tema

    app = QApplication.instance()
    if app is None:
        app = QApplication(sys.argv)
    aplicar_tema(app)

    servicios = construir(conn)
    ventana = VentanaPrincipal(
        servicios,
        ruta_base=paths.db_path().name,
        version=APP_VERSION,
        esquema=database.user_version(conn),
    )
    ventana.show()
    return app.exec()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="stocklend",
        description=f"{APP_NAME} — gestión de préstamos de laboratorio",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="verifica la base de datos y termina sin abrir ventana",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"{APP_NAME} {APP_VERSION} (esquema {SCHEMA_VERSION})",
    )
    args = parser.parse_args(argv)

    conn, aplicadas = bootstrap()
    try:
        estado = _resumen(conn, aplicadas)
        print(estado)
        logger.info(estado)
        if args.check:
            return 0
        return abrir_ventana(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
