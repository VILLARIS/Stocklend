"""La capa de repositorios no gestiona transacciones, no abre conexiones ni borra."""

from __future__ import annotations

from pathlib import Path

import pytest

import stocklend.data.repositories as paquete
from stocklend.data.repositories import (
    ArticuloRepo,
    ArticuloUnidadRepo,
    CategoriaRepo,
    ConfiguracionRepo,
    DevolucionRepo,
    EstudianteRepo,
    IncidenteRepo,
    MovimientoRepo,
    PrestamoRepo,
)

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
    "datetime.now(",
)


@pytest.mark.parametrize("archivo", _FUENTES, ids=lambda ruta: ruta.name)
def test_sin_transacciones_propias_ni_borrados(archivo: Path):
    texto = archivo.read_text(encoding="utf-8")
    for prohibido in _PROHIBIDOS:
        assert prohibido not in texto, f"{archivo.name} contiene '{prohibido}'"


@pytest.mark.parametrize(
    "clase",
    [
        ArticuloRepo,
        ArticuloUnidadRepo,
        CategoriaRepo,
        ConfiguracionRepo,
        DevolucionRepo,
        EstudianteRepo,
        IncidenteRepo,
        MovimientoRepo,
        PrestamoRepo,
    ],
    ids=lambda clase: clase.__name__,
)
def test_recibe_la_conexion_por_constructor(clase):
    import inspect

    parametros = list(inspect.signature(clase.__init__).parameters)
    assert parametros[1] == "conn"
