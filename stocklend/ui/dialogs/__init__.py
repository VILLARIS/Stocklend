"""Diálogos modales (Etapas 5 y 6).

`FormDialog` es la base de todos los formularios y `BuscadorResultados` el patrón de
búsqueda y selección de los pasos guiados. `ConfirmDialog` viene de la Etapa 5.
"""

from __future__ import annotations

from .confirm import ConfirmDialog, confirmar
from .form import FormDialog
from .seleccion import BuscadorResultados

__all__ = [
    "BuscadorResultados",
    "ConfirmDialog",
    "FormDialog",
    "confirmar",
]
