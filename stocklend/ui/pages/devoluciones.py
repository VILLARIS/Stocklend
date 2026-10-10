"""Devoluciones (`UI_SCREENS.md` §6). Armazón provisional hasta la Etapa 6."""

from __future__ import annotations

from .base import PaginaProvisional


class PaginaDevoluciones(PaginaProvisional):
    def __init__(self, parent=None) -> None:
        super().__init__(
            "Devoluciones",
            "",
            etapa="la Etapa 6",
            parent=parent,
        )
