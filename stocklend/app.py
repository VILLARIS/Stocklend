"""Punto de entrada de la Etapa 1: configuración, logging y migración de la base.

No contiene lógica de negocio (ni inventario, ni estudiantes, ni préstamos).
La ventana es mínima y temporal, y existe para comprobar que la aplicación
arranca contra una base real.
"""

from __future__ import annotations

import argparse
import logging
import sqlite3
import sys
from typing import TYPE_CHECKING

from .core import paths
from .core.constants import APP_NAME, APP_VERSION, SCHEMA_VERSION
from .core.logging_setup import setup_logging
from .data import database, migrator

if TYPE_CHECKING:
    from PySide6.QtWidgets import QWidget

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


def crear_ventana(resumen: str) -> "QWidget":
    """Ventana mínima de arranque (temporal; las pantallas reales llegan en la Etapa 6)."""
    from PySide6.QtWidgets import QLabel, QPushButton, QVBoxLayout, QWidget

    ventana = QWidget()
    ventana.setWindowTitle(APP_NAME)
    etiqueta = QLabel(resumen)
    etiqueta.setObjectName("resumen_arranque")
    boton = QPushButton("Cerrar")
    boton.clicked.connect(ventana.close)
    disposicion = QVBoxLayout(ventana)
    disposicion.addWidget(etiqueta)
    disposicion.addWidget(boton)
    return ventana


def _abrir_ventana(resumen: str) -> int:
    try:
        from PySide6.QtWidgets import QApplication
    except ImportError:
        logger.exception("PySide6 no está disponible; no se puede abrir la ventana")
        print("PySide6 no está instalado; usa --check para verificar la base.", file=sys.stderr)
        return 1
    app = QApplication.instance()
    if app is None:
        app = QApplication(sys.argv)
    ventana = crear_ventana(resumen)
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
        return _abrir_ventana(estado)
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
