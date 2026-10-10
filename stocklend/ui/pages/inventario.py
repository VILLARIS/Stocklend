"""Pantalla de Inventario (`UI_SCREENS.md` §3).

En la Etapa 5 es un listado provisional pero ya conectado a datos reales: la tabla
muestra los artículos registrados y, con la base vacía, el estado vacío correcto.
Las pestañas Unidades y Categorías, el alta y el ajuste llegan en la Etapa 6.
"""

from __future__ import annotations

from typing import Any

from ..widgets.feedback import Toast
from ..widgets.table import QuantityCellDelegate
from .base import PaginaListado, icono_estado_vacio

COLUMNAS = [
    "Nombre",
    "Código",
    "Categoría",
    "Disponible",
    "Prestado",
    "Dañado",
    "Faltante",
    "Total",
    "No prestable",
]


class PaginaInventario(PaginaListado):
    def __init__(self, inventario, parent=None) -> None:
        super().__init__(
            "Inventario",
            "Artículos, unidades y existencias",
            COLUMNAS,
            accion_texto="+ Artículo",
            placeholder="Buscar por nombre o código…",
            parent=parent,
        )
        self._inventario = inventario
        for columna in range(3, 8):
            self.tabla.set_delegate(columna, QuantityCellDelegate(self.tabla))
        self.tabla.accion_vacio.connect(self._alta_pendiente)
        self.cabecera.accion_pulsada.connect(self._alta_pendiente)

    def _configurar_estado_vacio(self) -> None:
        self.tabla.configurar_estado_vacio(
            "Todavía no hay artículos registrados",
            "Registra el primero para empezar a controlar las existencias.",
            "Registrar el primero",
            icono_estado_vacio("inventario"),
        )

    def _categorias(self) -> dict[int, str]:
        return {
            categoria.id: categoria.nombre
            for categoria in self._inventario.listar_categorias(limite=1000)
            if categoria.id is not None
        }

    def _obtener_filas(self, termino: str) -> list[list[Any]]:
        nombres = self._categorias()
        articulos = (
            self._inventario.buscar_articulos(termino, limite=1000)
            if termino
            else self._inventario.listar_articulos(limite=1000)
        )
        return [
            [
                articulo.nombre,
                articulo.codigo or "—",
                nombres.get(articulo.categoria_id, "—"),
                articulo.cantidad_disponible,
                articulo.cantidad_prestada,
                articulo.cantidad_daniada,
                articulo.cantidad_faltante,
                articulo.cantidad_total,
                "No" if articulo.prestable else "Sí",
            ]
            for articulo in articulos
        ]

    def _alta_pendiente(self) -> None:
        Toast.mostrar(
            self.window(),
            "El alta de artículos llegará en la Etapa 6.",
            "atencion",
        )
