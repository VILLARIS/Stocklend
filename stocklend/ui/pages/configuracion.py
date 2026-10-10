"""Configuración (`UI_SCREENS.md` §10). Armazón provisional."""

from __future__ import annotations

from .base import PaginaProvisional


class PaginaConfiguracion(PaginaProvisional):
    def __init__(self, parent=None) -> None:
        super().__init__(
            "Configuración",
            "",
            etapa="una etapa posterior",
            parent=parent,
        )
