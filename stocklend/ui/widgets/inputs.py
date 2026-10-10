"""Componentes de entrada (`UI_COMPONENTS.md` §4)."""

from __future__ import annotations

from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QIntValidator
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPlainTextEdit,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from .primitives import crear_boton


class SearchBar(QLineEdit):
    """Búsqueda incremental con 250 ms de retardo (`§4.1`, RF-INV-04)."""

    busqueda_cambiada = Signal(str)

    def __init__(
        self, placeholder: str = "Buscar por nombre o código…", parent: QWidget | None = None
    ) -> None:
        super().__init__(parent)
        self.setObjectName("buscador")
        self.setPlaceholderText(placeholder)
        self.setClearButtonEnabled(True)
        self.setMinimumWidth(280)
        self.setMaximumWidth(480)
        self._temporizador = QTimer(self)
        self._temporizador.setSingleShot(True)
        self._temporizador.setInterval(250)
        self._temporizador.timeout.connect(lambda: self.busqueda_cambiada.emit(self.text()))
        self.textChanged.connect(self._temporizador.start)
        self.returnPressed.connect(self._emitir_ahora)

    def _emitir_ahora(self) -> None:
        self._temporizador.stop()
        self.busqueda_cambiada.emit(self.text())

    def limpiar(self) -> None:
        if self.text():
            self.clear()
            self._emitir_ahora()


class FormField(QWidget):
    """Etiqueta, campo, ayuda y error en una unidad (`§4.3`)."""

    def __init__(
        self,
        etiqueta: str,
        campo: QWidget,
        ayuda: str = "",
        obligatorio: bool = False,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("campo_formulario")
        self.campo = campo
        self.mensaje = QLabel(ayuda)
        self.mensaje.setObjectName("texto_ayuda")
        self.mensaje.setFixedHeight(20)

        texto = f"{etiqueta} *" if obligatorio else etiqueta
        titulo = QLabel(texto)
        titulo.setProperty("campo", "etiqueta")

        disposicion = QVBoxLayout(self)
        disposicion.setContentsMargins(0, 0, 0, 0)
        disposicion.setSpacing(4)
        disposicion.addWidget(titulo)
        disposicion.addWidget(campo)
        disposicion.addWidget(self.mensaje)

    def set_error(self, texto: str) -> None:
        self.mensaje.setObjectName("mensaje_error")
        self.mensaje.setText(texto)
        self.campo.setProperty("error", True)
        self._repintar()

    def limpiar_error(self, ayuda: str = "") -> None:
        self.mensaje.setObjectName("texto_ayuda")
        self.mensaje.setText(ayuda)
        self.campo.setProperty("error", False)
        self._repintar()

    def _repintar(self) -> None:
        self.mensaje.style().unpolish(self.mensaje)
        self.mensaje.style().polish(self.mensaje)
        self.campo.style().unpolish(self.campo)
        self.campo.style().polish(self.campo)


class QuantityInput(QWidget):
    """Cantidad con selector incremental y tope a la vista (`§4.4`)."""

    valor_cambiado = Signal(int)

    def __init__(
        self, valor: int = 0, maximo: int = 999, parent: QWidget | None = None
    ) -> None:
        super().__init__(parent)
        self.setObjectName("selector_cantidad")
        self._maximo = max(0, maximo)
        self._valor = self._acotar(valor)
        self.boton_menos = QPushButton("−")
        self.boton_menos.setProperty("variante", "secundaria")
        self.boton_mas = QPushButton("+")
        self.boton_mas.setProperty("variante", "secundaria")
        self.entrada = QLineEdit(str(self._valor))
        self.entrada.setObjectName("entrada_cantidad")
        self.entrada.setValidator(QIntValidator(0, self._maximo, self))
        self.entrada.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.entrada.setFixedWidth(64)
        self.tope = QLabel()
        self.tope.setProperty("campo", "etiqueta")

        disposicion = QHBoxLayout(self)
        disposicion.setContentsMargins(0, 0, 0, 0)
        disposicion.setSpacing(6)
        disposicion.addWidget(self.boton_menos)
        disposicion.addWidget(self.entrada)
        disposicion.addWidget(self.boton_mas)
        disposicion.addWidget(self.tope)

        self.boton_menos.clicked.connect(lambda: self.set_valor(self._valor - 1))
        self.boton_mas.clicked.connect(lambda: self.set_valor(self._valor + 1))
        self.entrada.editingFinished.connect(self._desde_texto)
        self._actualizar_tope()

    def _acotar(self, valor: int) -> int:
        return max(0, min(int(valor), self._maximo))

    def set_maximo(self, maximo: int) -> None:
        self._maximo = max(0, maximo)
        self.entrada.setValidator(QIntValidator(0, self._maximo, self))
        self._valor = self._acotar(self._valor)
        self.entrada.setText(str(self._valor))
        self._actualizar_tope()

    def set_valor(self, valor: int) -> None:
        nuevo = self._acotar(valor)
        if nuevo == self._valor:
            return
        self._valor = nuevo
        self.entrada.setText(str(nuevo))
        self._actualizar_tope()
        self.valor_cambiado.emit(nuevo)

    def valor(self) -> int:
        return self._valor

    def _desde_texto(self) -> None:
        texto = self.entrada.text()
        if not texto.isdigit():
            self.entrada.setText(str(self._valor))
            return
        self.set_valor(int(texto))

    def _actualizar_tope(self) -> None:
        self.tope.setText(f"Máximo {self._maximo}")


class TextArea(QWidget):
    """Área de texto con contador y límite (`§4.6`)."""

    def __init__(self, maximo: int = 200, lineas: int = 3, parent: QWidget | None = None):
        super().__init__(parent)
        self.setObjectName("area_texto")
        self._maximo = maximo
        self.editor = QPlainTextEdit()
        self.editor.setObjectName("editor_texto")
        self.editor.setFixedHeight(lineas * 24 + 16)
        self.contador = QLabel(f"0 de {maximo}")
        self.contador.setProperty("campo", "etiqueta")
        self.contador.setAlignment(Qt.AlignmentFlag.AlignRight)

        disposicion = QVBoxLayout(self)
        disposicion.setContentsMargins(0, 0, 0, 0)
        disposicion.setSpacing(4)
        disposicion.addWidget(self.editor)
        disposicion.addWidget(self.contador)
        self.editor.textChanged.connect(self._recortar)

    def texto(self) -> str:
        return self.editor.toPlainText()

    def set_texto(self, texto: str) -> None:
        self.editor.setPlainText(texto)

    def _recortar(self) -> None:
        texto = self.editor.toPlainText()
        if len(texto) > self._maximo:
            cursor = self.editor.textCursor()
            posicion = cursor.position()
            self.editor.blockSignals(True)
            self.editor.setPlainText(texto[: self._maximo])
            cursor.setPosition(min(posicion, self._maximo))
            self.editor.setTextCursor(cursor)
            self.editor.blockSignals(False)
            texto = texto[: self._maximo]
        self.contador.setText(f"{len(texto)} de {self._maximo}")


def boton_terciario(texto: str) -> QPushButton:
    """Atajo para un botón terciario (usado por filtros y enlaces de acción)."""
    return crear_boton(texto, "terciaria")
