"""Diálogo de confirmación propio (`UI_COMPONENTS.md` §5.3).

`QDialog` construido a mano: `QMessageBox` no admite el nombre del registro, ni un
botón con verbo propio, ni la doble confirmación (decisión registrada como C-8).
"""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QDialog,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QVBoxLayout,
    QWidget,
)

from ..widgets.primitives import crear_boton


class ConfirmDialog(QDialog):
    """Confirmación con el nombre del registro afectado y su lista de efectos."""

    def __init__(
        self,
        titulo: str,
        cuerpo: str,
        efectos: list[str] | None = None,
        texto_accion: str = "Confirmar",
        palabra_confirmacion: str | None = None,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("dialogo_confirmacion")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setWindowTitle(titulo)
        self.setModal(True)
        self.setMinimumWidth(440)
        self.setWindowFlag(Qt.WindowType.WindowContextHelpButtonHint, False)

        etiqueta_titulo = QLabel(titulo)
        etiqueta_titulo.setObjectName("subtitulo")
        etiqueta_cuerpo = QLabel(cuerpo)
        etiqueta_cuerpo.setWordWrap(True)

        disposicion = QVBoxLayout(self)
        disposicion.setContentsMargins(24, 24, 24, 24)
        disposicion.setSpacing(12)
        disposicion.addWidget(etiqueta_titulo)
        disposicion.addWidget(etiqueta_cuerpo)
        for efecto in efectos or ():
            vineta = QLabel(f"•  {efecto}")
            vineta.setWordWrap(True)
            disposicion.addWidget(vineta)

        self.confirmacion: QLineEdit | None = None
        self._palabra = palabra_confirmacion
        self.boton_accion = crear_boton(texto_accion, "destructiva")
        if palabra_confirmacion:
            self.confirmacion = QLineEdit()
            self.confirmacion.setPlaceholderText(f"Escribe {palabra_confirmacion} para confirmar")
            self.confirmacion.textChanged.connect(self._validar_palabra)
            self.boton_accion.setEnabled(False)
            disposicion.addWidget(self.confirmacion)

        botones = QHBoxLayout()
        self.boton_cancelar = crear_boton("Cancelar", "secundaria")
        self.boton_cancelar.clicked.connect(self.reject)
        botones.addStretch(1)
        botones.addWidget(self.boton_cancelar)
        botones.addWidget(self.boton_accion)
        disposicion.addLayout(botones)

        self.boton_accion.clicked.connect(self.accept)
        self.boton_cancelar.setFocus()

    def _validar_palabra(self, texto: str) -> None:
        if self.confirmacion is None or not self._palabra:
            return
        self.boton_accion.setEnabled(texto.strip().upper() == self._palabra.upper())


def confirmar(
    padre: QWidget,
    titulo: str,
    cuerpo: str,
    efectos: list[str] | None = None,
    texto_accion: str = "Confirmar",
    palabra_confirmacion: str | None = None,
) -> bool:
    """Muestra el diálogo y devuelve `True` si se confirma."""
    dialogo = ConfirmDialog(
        titulo, cuerpo, efectos, texto_accion, palabra_confirmacion, padre
    )
    return dialogo.exec() == QDialog.DialogCode.Accepted
