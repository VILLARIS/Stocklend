"""Panel (`UI_SCREENS.md` §2). Armazón provisional hasta la Etapa 7."""

from __future__ import annotations

from .base import PaginaProvisional


class PaginaPanel(PaginaProvisional):
    def __init__(self, parent=None) -> None:
        super().__init__(
            "Panel",
            "Resumen del estado actual del inventario",
            etapa="la Etapa 7",
            parent=parent,
        )
