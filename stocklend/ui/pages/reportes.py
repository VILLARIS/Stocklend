"""Reportes (`UI_SCREENS.md` §7). Armazón provisional hasta la Etapa 7."""

from __future__ import annotations

from .base import PaginaProvisional


class PaginaReportes(PaginaProvisional):
    def __init__(self, parent=None) -> None:
        super().__init__(
            "Reportes",
            "Histórico y estadísticas",
            etapa="la Etapa 7",
            parent=parent,
        )
