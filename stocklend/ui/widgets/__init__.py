"""Componentes reutilizables de interfaz (Etapa 5).

Reúne los componentes base de `UI_COMPONENTS.md` que el armazón de la Etapa 5
necesita. El catálogo completo se completará en las etapas de pantallas.
"""

from __future__ import annotations

from .feedback import (
    DetailPanel,
    EmptyState,
    FilaEstadisticas,
    InlineNotice,
    StatCard,
    Toast,
)
from .inputs import FormField, QuantityInput, SearchBar, TextArea, boton_terciario
from .primitives import CountBadge, SectionHeader, SeparadorLateral, Toolbar, crear_boton
from .table import (
    AccionesCellDelegate,
    DataTable,
    NameCellDelegate,
    QuantityCellDelegate,
    StatusChipDelegate,
    TablaModelo,
    UnitCodeBadgeDelegate,
)
from .tarjeta_imagen import StatCardImagen

__all__ = [
    "AccionesCellDelegate",
    "CountBadge",
    "DataTable",
    "DetailPanel",
    "EmptyState",
    "FilaEstadisticas",
    "FormField",
    "InlineNotice",
    "NameCellDelegate",
    "QuantityCellDelegate",
    "QuantityInput",
    "SearchBar",
    "SectionHeader",
    "SeparadorLateral",
    "StatCard",
    "StatCardImagen",
    "StatusChipDelegate",
    "TablaModelo",
    "TextArea",
    "Toast",
    "Toolbar",
    "UnitCodeBadgeDelegate",
    "boton_terciario",
    "crear_boton",
]
