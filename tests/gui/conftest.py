"""Pruebas de interfaz: usan la plataforma offscreen para no abrir ventanas reales.

Añade fixtures para construir la ventana principal sobre la base migrada temporal
de `tests/conftest.py`, sin tocar datos reales.
"""

from __future__ import annotations

import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from stocklend.core.constants import APP_VERSION, SCHEMA_VERSION  # noqa: E402
from stocklend.ui.main_window import VentanaPrincipal  # noqa: E402
from stocklend.ui.theme import aplicar_tema  # noqa: E402


@pytest.fixture(autouse=True)
def _tema(qapp):
    aplicar_tema(qapp)


@pytest.fixture
def ventana(qtbot, servicios):
    """Ventana principal sobre una base migrada vacía."""
    widget = VentanaPrincipal(
        servicios,
        ruta_base="prueba.sqlite",
        version=APP_VERSION,
        esquema=SCHEMA_VERSION,
    )
    qtbot.addWidget(widget)
    widget.show()
    return widget
