"""La interfaz no accede a la base y la composición no depende de PySide6.

ARCHITECTURE §3.4: los widgets reciben servicios y muestran; nunca abren la base ni
escriben SQL. ARCHITECTURE §3.5: `core/container.py` compone servicios sin Qt.
"""

from __future__ import annotations

from pathlib import Path

import pytest

import stocklend.ui as paquete_ui
from stocklend.core import container

_RAIZ_UI = Path(paquete_ui.__file__).parent
_FUENTES_UI = sorted(_RAIZ_UI.rglob("*.py"))

_PROHIBIDOS = (
    "import sqlite3",
    "from sqlite3",
    "sqlite3.connect",
    ".execute(",
    ".cursor(",
    "SELECT ",
    "INSERT INTO",
    "UPDATE ",
    "DELETE FROM",
)


@pytest.mark.parametrize("archivo", _FUENTES_UI, ids=lambda ruta: ruta.name)
def test_la_interfaz_no_accede_a_la_base(archivo: Path):
    texto = archivo.read_text(encoding="utf-8")
    for prohibido in _PROHIBIDOS:
        assert prohibido not in texto, f"{archivo.name} contiene '{prohibido}'"


def test_container_no_depende_de_pyside6():
    lineas = Path(container.__file__).read_text(encoding="utf-8").splitlines()
    importaciones = [
        linea.strip()
        for linea in lineas
        if linea.lstrip().startswith(("import PySide6", "from PySide6"))
    ]
    assert importaciones == []


def test_container_compone_los_seis_servicios(conn_migrada):
    servicios = container.construir(conn_migrada)
    for nombre in (
        "inventario",
        "unidades",
        "estudiantes",
        "prestamos",
        "devoluciones",
        "incidentes",
    ):
        assert getattr(servicios, nombre) is not None
