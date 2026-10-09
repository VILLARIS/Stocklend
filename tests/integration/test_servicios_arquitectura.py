"""La capa de servicios usa transacciones, no las abre a mano ni borra (ARCHITECTURE §3.3)."""

from __future__ import annotations

import inspect
from pathlib import Path

import pytest

import stocklend.services as paquete
from stocklend.services import EstudianteService, InventarioService, UnidadService

_RAIZ = Path(paquete.__file__).parent
_FUENTES = sorted(_RAIZ.glob("*.py"))

_PROHIBIDOS = (
    "commit(",
    "rollback(",
    "BEGIN",
    "sqlite3.connect(",
    ".close()",
    "DELETE FROM",
    "import PySide6",
    "from PySide6",
)


@pytest.mark.parametrize("archivo", _FUENTES, ids=lambda ruta: ruta.name)
def test_sin_transacciones_propias_ni_borrados(archivo: Path):
    texto = archivo.read_text(encoding="utf-8")
    for prohibido in _PROHIBIDOS:
        assert prohibido not in texto, f"{archivo.name} contiene '{prohibido}'"


@pytest.mark.parametrize(
    "clase",
    [EstudianteService, InventarioService, UnidadService],
    ids=lambda clase: clase.__name__,
)
def test_recibe_la_conexion_por_constructor(clase):
    parametros = list(inspect.signature(clase.__init__).parameters)
    assert parametros[1] == "conn"
