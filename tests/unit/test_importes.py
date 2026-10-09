"""Compatibilidad de importaciones: el paquete carga sin Qt y con la versión correcta."""

from __future__ import annotations

import subprocess
import sys

from stocklend.core.constants import APP_VERSION, SCHEMA_VERSION
from stocklend.data import database, migrator


def test_importaciones_basicas():
    import stocklend
    import stocklend.app
    import stocklend.core.config
    import stocklend.core.logging_setup
    import stocklend.core.paths
    import stocklend.data
    import stocklend.data.migrator
    import stocklend.data.repositories
    import stocklend.domain
    import stocklend.services
    import stocklend.services.reporting
    import stocklend.ui
    import stocklend.ui.dialogs
    import stocklend.ui.pages
    import stocklend.ui.widgets

    assert stocklend.__doc__


def test_importar_app_no_carga_qt():
    codigo = (
        "import sys; import stocklend.app;"
        "assert 'PySide6' not in sys.modules, 'stocklend.app no debe importar Qt';"
        "print('OK')"
    )
    resultado = subprocess.run(
        [sys.executable, "-c", codigo],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    assert "OK" in resultado.stdout


def test_versiones_de_aplicacion_y_esquema():
    assert APP_VERSION == "0.1.0"
    assert SCHEMA_VERSION == 1


def test_esquema_instalado_coincide_con_la_constante(conn):
    migrator.migrate(conn)
    assert database.user_version(conn) == SCHEMA_VERSION
