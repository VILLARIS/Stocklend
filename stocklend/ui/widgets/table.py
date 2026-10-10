"""Tabla de datos y delegates (`UI_COMPONENTS.md` §3.2, §3.3, §3.4, §3.7).

`DataTable` es `QStackedWidget`: la vista `QTableView` con su `QAbstractTableModel`
y, debajo, el `EmptyState` que la sustituye cuando no hay filas. Nunca se usa
`QTableWidget` (decidido en ARCHITECTURE §4).
"""

from __future__ import annotations

from typing import Any

from PySide6.QtCore import QAbstractTableModel, QModelIndex, QRect, Qt, Signal
from PySide6.QtGui import QColor, QFont, QPalette, QPen
from PySide6.QtWidgets import (
    QAbstractItemView,
    QHeaderView,
    QStackedWidget,
    QStyle,
    QStyledItemDelegate,
    QTableView,
    QVBoxLayout,
    QWidget,
)

from .. import theme
from .feedback import EmptyState

_COL = theme.TOKENS.colores


def _estilos_estado() -> dict[str, tuple[str, str]]:
    return {
        "Disponible": (_COL.exito_claro, _COL.exito),
        "Devuelto": (_COL.exito_claro, _COL.exito),
        "Resuelto": (_COL.exito_claro, _COL.exito),
        "Sin incidencias": (_COL.exito_claro, _COL.exito),
        "Prestable": (_COL.exito_claro, _COL.exito),
        "No prestable": (_COL.borde_suave, _COL.texto_secundario),
        "Dañado": (_COL.advertencia_claro, _COL.advertencia_texto),
        "Dañada": (_COL.advertencia_claro, _COL.advertencia_texto),
        "Daño": (_COL.advertencia_claro, _COL.advertencia_texto),
        "Pérdida": (_COL.error_claro, _COL.error),
        "Otro": (_COL.borde_suave, _COL.texto_secundario),
        "Prestada": (_COL.azul_claro, _COL.azul_primario),
        "Baja": (_COL.borde_suave, _COL.texto_secundario),
        "Depósito": (_COL.azul_claro, _COL.azul_primario),
        "Préstamo": (_COL.azul_claro, _COL.azul_primario),
        "Devolución": (_COL.azul_claro, _COL.azul_primario),
        "Pendiente de devolución": (_COL.advertencia_claro, _COL.advertencia_texto),
        "Sin determinar": (_COL.advertencia_claro, _COL.advertencia_texto),
        "Pendiente": (_COL.advertencia_claro, _COL.advertencia_texto),
        "Faltante": (_COL.error_claro, _COL.error),
        "Perdido": (_COL.error_claro, _COL.error),
        "Perdida": (_COL.error_claro, _COL.error),
        "Anulado": (_COL.error_claro, _COL.error),
        "Activo": (_COL.borde_suave, _COL.texto_secundario),
        "Inactivo": (_COL.borde_suave, _COL.texto_secundario),
        "Cerrado": (_COL.borde_suave, _COL.texto_secundario),
        "Abierto": (_COL.azul_claro, _COL.azul_primario),
        "Con control individual": (_COL.azul_claro, _COL.azul_primario),
    }


class TablaModelo(QAbstractTableModel):
    """Modelo de tabla simple: filas de celdas ya formateadas para la vista."""

    def __init__(self, columnas: list[str], parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._columnas = list(columnas)
        self._filas: list[list[Any]] = []
        self._columnas_derecha: set[int] = set()

    def set_filas(self, filas: list[list[Any]]) -> None:
        self.beginResetModel()
        self._filas = [list(fila) for fila in filas]
        self.endResetModel()

    def set_columnas(self, columnas: list[str]) -> None:
        self.beginResetModel()
        self._columnas = list(columnas)
        self._filas = []
        self.endResetModel()

    def set_columnas_derecha(self, indices: list[int]) -> None:
        """Marca columnas cuyo encabezado se alinea a la derecha (cifras)."""
        self._columnas_derecha = set(indices)

    def fila(self, indice: int) -> list[Any]:
        return self._filas[indice]

    def rowCount(self, parent: QModelIndex = QModelIndex()) -> int:  # noqa: N802
        return 0 if parent.isValid() else len(self._filas)

    def columnCount(self, parent: QModelIndex = QModelIndex()) -> int:  # noqa: N802
        return 0 if parent.isValid() else len(self._columnas)

    def data(self, indice: QModelIndex, rol: int = Qt.ItemDataRole.DisplayRole):
        if not indice.isValid():
            return None
        if rol in (Qt.ItemDataRole.DisplayRole, Qt.ItemDataRole.ToolTipRole):
            return str(self._filas[indice.row()][indice.column()])
        return None

    def headerData(  # noqa: N802
        self, seccion: int, orientacion: Qt.Orientation, rol: int = Qt.ItemDataRole.DisplayRole
    ):
        if orientacion == Qt.Orientation.Horizontal:
            if rol == Qt.ItemDataRole.DisplayRole:
                return self._columnas[seccion]
            if (
                rol == Qt.ItemDataRole.TextAlignmentRole
                and seccion in self._columnas_derecha
            ):
                return int(
                    Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter
                )
        return None


class NameCellDelegate(QStyledItemDelegate):
    """Refuerza la jerarquía del nombre del artículo (`§3.3`)."""

    def initStyleOption(self, opcion, indice):  # noqa: N802
        super().initStyleOption(opcion, indice)
        opcion.displayAlignment = (
            Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter
        )
        fuente = QFont(opcion.font)
        fuente.setWeight(QFont.Weight.DemiBold)
        opcion.font = fuente


class StatusChipDelegate(QStyledItemDelegate):
    """Dibuja una pastilla de estado con su texto (`§3.4`)."""

    def paint(self, painter, opcion, indice):  # noqa: N802
        texto = str(indice.data(Qt.ItemDataRole.DisplayRole) or "")
        if not texto or texto == "—":
            return
        fondo, color = _estilos_estado().get(texto, (_COL.borde_suave, _COL.texto_secundario))
        painter.save()
        painter.setRenderHint(painter.RenderHint.Antialiasing)
        rect = opcion.rect.adjusted(8, 7, -8, -7)
        radio = max(4.0, rect.height() / 2)
        borde = QColor(color)
        borde.setAlpha(70)
        painter.setBrush(QColor(fondo))
        painter.setPen(QPen(borde, 1))
        painter.drawRoundedRect(rect, radio, radio)
        painter.setPen(QColor(color))
        fuente = QFont(opcion.font)
        fuente.setPixelSize(12)
        fuente.setWeight(QFont.Weight.DemiBold)
        painter.setFont(fuente)
        painter.drawText(rect, Qt.AlignmentFlag.AlignCenter, texto)
        painter.restore()


class AccionesCellDelegate(QStyledItemDelegate):
    """Botón de menú de fila: una pastilla «⋯» que abre las acciones (`§3.7`)."""

    def paint(self, painter, opcion, indice):  # noqa: N802
        painter.save()
        painter.setRenderHint(painter.RenderHint.Antialiasing)
        rect = opcion.rect.adjusted(12, 6, -12, -6)
        resaltado = bool(
            opcion.state & QStyle.StateFlag.State_MouseOver
        ) or bool(opcion.state & QStyle.StateFlag.State_Selected)
        painter.setBrush(
            QColor(_COL.azul_claro) if resaltado else QColor(_COL.superficie)
        )
        painter.setPen(QPen(QColor(_COL.azul_primario if resaltado else _COL.borde), 1))
        painter.drawRoundedRect(rect, 6, 6)
        painter.setPen(QColor(_COL.azul_primario if resaltado else _COL.texto_secundario))
        fuente = QFont(opcion.font)
        fuente.setPixelSize(16)
        fuente.setWeight(QFont.Weight.Bold)
        painter.setFont(fuente)
        painter.drawText(rect, Qt.AlignmentFlag.AlignCenter, "⋯")
        painter.restore()


class QuantityCellDelegate(QStyledItemDelegate):
    """Cifra tabular alineada a la derecha (`§3.3`).

    Con `alerta=True`, los valores mayores que cero se dibujan en negrita, con el
    color indicado y un punto de aviso a la izquierda: la jerarquía no depende solo
    del color. Se usa para «Dañado» y «Faltante» del inventario.
    """

    def __init__(
        self,
        parent: QWidget | None = None,
        *,
        alerta: bool = False,
        color_alerta: str | None = None,
    ) -> None:
        super().__init__(parent)
        self._alerta = alerta
        self._color_alerta = color_alerta or _COL.advertencia_texto

    def _positivo(self, indice) -> bool:
        try:
            return int(str(indice.data(Qt.ItemDataRole.DisplayRole))) > 0
        except (TypeError, ValueError):
            return False

    def initStyleOption(self, opcion, indice):  # noqa: N802
        super().initStyleOption(opcion, indice)
        opcion.displayAlignment = (
            Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter
        )
        fuente = QFont(opcion.font)
        fuente.setStyleHint(QFont.StyleHint.Monospace)
        fuente.setFamily("Consolas")
        resaltar = self._alerta and self._positivo(indice)
        if resaltar:
            fuente.setWeight(QFont.Weight.Bold)
        opcion.font = fuente
        if resaltar:
            color = QColor(self._color_alerta)
            opcion.palette.setColor(QPalette.ColorRole.Text, color)
            opcion.palette.setColor(QPalette.ColorRole.HighlightedText, color)

    def paint(self, painter, opcion, indice):  # noqa: N802
        if self._alerta and self._positivo(indice):
            painter.save()
            painter.setRenderHint(painter.RenderHint.Antialiasing)
            painter.setPen(Qt.PenStyle.NoPen)
            painter.setBrush(QColor(self._color_alerta))
            centro = opcion.rect.center()
            painter.drawEllipse(QRect(opcion.rect.left() + 12, centro.y() - 2, 4, 4))
            painter.restore()
        super().paint(painter, opcion, indice)


class UnitCodeBadgeDelegate(QStyledItemDelegate):
    """Código de unidad monoespaciado (`§3.7`)."""

    def initStyleOption(self, opcion, indice):  # noqa: N802
        super().initStyleOption(opcion, indice)
        opcion.displayAlignment = (
            Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter
        )
        fuente = QFont(opcion.font)
        fuente.setFamily("Consolas")
        opcion.font = fuente


class DataTable(QWidget):
    """Vista de tabla con su estado vacío integrado (`§3.2`)."""

    fila_seleccionada = Signal(int)
    accion_vacio = Signal()

    def __init__(self, columnas: list[str], parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setObjectName("tabla_datos")
        self.modelo = TablaModelo(columnas, self)
        self.tabla = QTableView()
        self.tabla.setObjectName("tabla_datos_vista")
        self.tabla.setModel(self.modelo)
        self.tabla.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.tabla.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.tabla.setAlternatingRowColors(False)
        self.tabla.setShowGrid(False)
        self.tabla.setWordWrap(False)
        self.tabla.verticalHeader().setVisible(False)
        self.tabla.verticalHeader().setDefaultSectionSize(40)
        self.tabla.horizontalHeader().setFixedHeight(40)
        self.tabla.horizontalHeader().setStretchLastSection(True)
        self.tabla.horizontalHeader().setDefaultAlignment(
            Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter
        )
        self.tabla.horizontalHeader().setSectionResizeMode(
            QHeaderView.ResizeMode.Interactive
        )
        self.tabla.selectionModel().currentRowChanged.connect(self._emitir_seleccion)

        self.vacio = EmptyState()
        self.vacio.accion_pulsada.connect(self.accion_vacio)

        self._pila = QStackedWidget()
        self._pila.addWidget(self.tabla)
        self._pila.addWidget(self.vacio)
        self._pila.setCurrentIndex(1)

        disposicion = QVBoxLayout(self)
        disposicion.setContentsMargins(0, 0, 0, 0)
        disposicion.addWidget(self._pila)

    def configurar_estado_vacio(
        self,
        titulo: str,
        explicacion: str = "",
        accion_texto: str | None = None,
        icono=None,
    ) -> None:
        self.vacio.configurar(titulo, explicacion, accion_texto, icono)

    def set_filas(self, filas: list[list[Any]]) -> None:
        self.modelo.set_filas(filas)
        self._pila.setCurrentIndex(0 if filas else 1)
        if not filas:
            self.tabla.clearSelection()

    def set_columnas(self, columnas: list[str]) -> None:
        self.modelo.set_columnas(columnas)
        self._pila.setCurrentIndex(1)

    def set_delegate(self, columna: int, delegate: QStyledItemDelegate) -> None:
        self.tabla.setItemDelegateForColumn(columna, delegate)

    def limpiar_seleccion(self) -> None:
        self.tabla.clearSelection()

    def _emitir_seleccion(self, actual: QModelIndex, _anterior: QModelIndex) -> None:
        if actual.isValid():
            self.fila_seleccionada.emit(actual.row())
