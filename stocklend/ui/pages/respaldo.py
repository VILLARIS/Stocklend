"""Respaldo (`UI_SCREENS.md` §9). Armazón provisional hasta la Etapa 8."""

from __future__ import annotations

from .base import PaginaProvisional


class PaginaRespaldo(PaginaProvisional):
    def __init__(self, parent=None) -> None:
        super().__init__(
            "Respaldo",
            "Copias de seguridad de la base de datos",
            etapa="la Etapa 8",
            parent=parent,
        )
