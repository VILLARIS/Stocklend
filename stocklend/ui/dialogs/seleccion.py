"""Búsqueda y selección con resultados en vivo (`UI_COMPONENTS.md` §4.5).

`BuscadorResultados` es el patrón de los pasos «elige estudiante», «elige artículo»
y «elige préstamo»: se escribe y los resultados se filtran con el retardo propio de
`SearchBar` (250 ms). Cada fila guarda en `Qt.UserRole` el dato que representa, de
modo que quien lo usa recibe el estudiante, artículo o préstamo elegido sin volver
a consultar la base.
"""

from __future__ import annotations

from typing import Callable

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QLabel,
    QListWidget,
    QListWidgetItem,
    QVBoxLayout,
    QWidget,
)

from ..widgets.inputs import SearchBar


class BuscadorResultados(QWidget):
    """Campo de búsqueda con su lista de resultados (una sola fila elegible)."""

    elegida = Signal(object)
    """Se emite al cambiar la selección o al hacer doble clic, con el dato elegido."""

    def __init__(
        self,
        placeholder: str,
        buscar: Callable[[str], "list[tuple[str, object]]"],
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("buscador_resultados")
        self._buscar = buscar
        self._orden = 0

        self.buscador = SearchBar(placeholder)
        self.lista = QListWidget()
        self.lista.setObjectName("lista_resultados")
        self.lista.setSelectionMode(QListWidget.SelectionMode.SingleSelection)
        self.lista.setUniformItemSizes(True)
        self._contador = QLabel()
        self._contador.setProperty("campo", "etiqueta")

        disposicion = QVBoxLayout(self)
        disposicion.setContentsMargins(0, 0, 0, 0)
        disposicion.setSpacing(8)
        disposicion.addWidget(self.buscador)
        disposicion.addWidget(self.lista)
        disposicion.addWidget(self._contador)

        self.buscador.busqueda_cambiada.connect(self._recargar)
        self.lista.currentItemChanged.connect(self._emitir_cambio)
        self.lista.itemDoubleClicked.connect(self._emitir_item)

    # ------------------------------------------------------------------ datos

    def _recargar(self, termino: str) -> None:
        self._orden += 1
        orden = self._orden
        try:
            pares = self._buscar(termino)
        except Exception:  # noqa: BLE001 - un error de búsqueda solo vacía la lista
            pares = []
        if orden != self._orden:
            return
        self.lista.clear()
        for texto, dato in pares:
            item = QListWidgetItem(texto)
            item.setData(Qt.ItemDataRole.UserRole, dato)
            self.lista.addItem(item)
        n = self.lista.count()
        self._contador.setText(
            f"{n} {('resultado' if n == 1 else 'resultados')}"
        )

    def set_datos(self, pares: "list[tuple[str, object]]") -> None:
        """Rellena la lista sin pasar por la búsqueda (selección previa)."""
        self.lista.clear()
        for texto, dato in pares:
            item = QListWidgetItem(texto)
            item.setData(Qt.ItemDataRole.UserRole, dato)
            self.lista.addItem(item)

    def dato_actual(self) -> object | None:
        item = self.lista.currentItem()
        return item.data(Qt.ItemDataRole.UserRole) if item is not None else None

    def seleccionar_dato(self, dato: object) -> None:
        """Marca como actual la fila cuyo dato coincida; no hace nada si no existe."""
        for fila in range(self.lista.count()):
            item = self.lista.item(fila)
            if item.data(Qt.ItemDataRole.UserRole) == dato:
                self.lista.setCurrentItem(item)
                return

    def limpiar(self) -> None:
        self.buscador.limpiar()

    # ---------------------------------------------------------------- señales

    def _emitir_cambio(self, actual: QListWidgetItem | None, _anterior) -> None:
        if actual is not None:
            self.elegida.emit(actual.data(Qt.ItemDataRole.UserRole))

    def _emitir_item(self, item: QListWidgetItem) -> None:
        self.lista.setCurrentItem(item)
        self.elegida.emit(item.data(Qt.ItemDataRole.UserRole))
