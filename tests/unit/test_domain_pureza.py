"""El dominio es una hoja: sin SQLite, sin PySide6 y sin leer la hora."""

from __future__ import annotations

from pathlib import Path

import pytest

import stocklend.domain as dominio

_RAIZ = Path(dominio.__file__).parent
_FUENTES = sorted(_RAIZ.glob("*.py"))

_PROHIBIDOS = (
    "import sqlite3",
    "from sqlite3",
    "import PySide6",
    "from PySide6",
    "import PyQt",
    "from PyQt",
    "datetime.now(",
)


@pytest.mark.parametrize("archivo", _FUENTES, ids=lambda ruta: ruta.name)
def test_el_dominio_no_depende_de_sqlite_ni_de_qt(archivo: Path):
    texto = archivo.read_text(encoding="utf-8")
    for prohibido in _PROHIBIDOS:
        assert prohibido not in texto, f"{archivo.name} contiene '{prohibido}'"
