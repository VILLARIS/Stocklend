"""Componentes estructurales y de entrada básicos (`UI_COMPONENTS.md` §2).

`Button` se materializa como `QPushButton` con la propiedad dinámica `variante`, que
el QSS generado en `theme.py` usa para distinguir las cinco variantes. `SectionHeader`
y `Toolbar` son `QWidget` con `QHBoxLayout`, sin barras nativas de Qt.
"""

from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)


def crear_boton(texto: str = "", variante: str = "primaria", parent: QWidget | None = None):
    """Crea un botón con una de las cinco variantes (`UI_COMPONENTS.md` §2.5)."""
    boton = QPushButton(texto, parent)
    boton.setProperty("variante", variante)
    boton.setCursor(Qt.CursorShape.PointingHandCursor)
    return boton


class SectionHeader(QWidget):
    """Cabecera de contenido: título, subtítulo y acción principal (`§2.1`)."""

    accion_pulsada = Signal()

    def __init__(
        self,
        titulo: str,
        subtitulo: str = "",
        accion_texto: str | None = None,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("cabecera_seccion")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.titulo = QLabel(titulo)
        self.titulo.setObjectName("titulo_seccion")
        self.subtitulo = QLabel(subtitulo)
        self.subtitulo.setObjectName("subtitulo_seccion")
        self.subtitulo.setVisible(bool(subtitulo))

        textos = QVBoxLayout()
        textos.setContentsMargins(0, 0, 0, 0)
        textos.setSpacing(2)
        textos.addWidget(self.titulo)
        textos.addWidget(self.subtitulo)

        self.accion = crear_boton(accion_texto or "", "primaria") if accion_texto else None
        if self.accion is not None:
            self.accion.setObjectName("accion_principal")
            self.accion.clicked.connect(self.accion_pulsada)

        disposicion = QHBoxLayout(self)
        disposicion.setContentsMargins(32, 20, 32, 20)
        disposicion.addLayout(textos)
        disposicion.addStretch(1)
        if self.accion is not None:
            disposicion.addWidget(self.accion, 0, Qt.AlignmentFlag.AlignVCenter)


class Toolbar(QWidget):
    """Fila de herramientas: búsqueda, filtros y acciones (`§2.2`)."""

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setObjectName("barra_herramientas")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self._disposicion = QHBoxLayout(self)
        self._disposicion.setContentsMargins(32, 10, 32, 10)
        self._disposicion.setSpacing(12)
        self._cola = QHBoxLayout()
        self._disposicion.addLayout(self._cola)
        self._disposicion.addStretch(1)

    def agregar(self, widget: QWidget) -> None:
        self._cola.addWidget(widget)

    def agregar_derecha(self, widget: QWidget) -> None:
        self._disposicion.addWidget(widget)


class CountBadge(QLabel):
    """Insignia de la barra lateral: nunca aparece con `0` (`UI_COMPONENTS.md` §3.6)."""

    def __init__(self, valor: int = 0, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setObjectName("insignia")
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setProperty("tono", "error")
        self.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Fixed)
        self.set_valor(valor)

    def set_valor(self, valor: int) -> None:
        self._valor = max(0, int(valor))
        self.setText("99+" if self._valor > 99 else str(self._valor))
        self.setVisible(self._valor > 0)
        self.setAccessibleName(f"{self._valor} pendientes")


class SeparadorLateral(QFrame):
    """Separador de 1 px entre las secciones principales y las secundarias."""

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setObjectName("separador_lateral")
        self.setFrameShape(QFrame.Shape.HLine)
        self.setFixedHeight(1)
