"""Diálogo base de formularios (`UI_COMPONENTS.md` §7.1).

Cada formulario de la Etapa 6 hereda de `FormDialog`: cabecera con título y
descripción, campos en línea con su ayuda, botones «Cancelar» + el verbo de la
acción y un solo envío (el botón se deshabilita mientras dura la operación, RNF-06).

El diálogo **no valida por sí mismo**: la subclase decide. ``validar()`` devuelve
pares (campo, mensaje) o un mensaje general; ``antes_de_guardar()`` puede mostrar
la confirmación previa (RNF-02); ``guardar()`` llama al servicio y, si todo va
bien, deja el resultado en ``self.resultado`` y cierra con ``Accepted``.
"""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QApplication,
    QDialog,
    QFrame,
    QHBoxLayout,
    QLabel,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from ..errors import mensaje_error
from ..widgets.feedback import InlineNotice
from ..widgets.inputs import FormField
from ..widgets.primitives import crear_boton


class FormDialog(QDialog):
    """Formulario modal de ancho fijo con errores en línea y anti-doble-envío."""

    def __init__(
        self,
        titulo: str,
        descripcion: str = "",
        texto_accion: str = "Guardar",
        variante_accion: str = "primaria",
        ancho: int = 480,
        desplazable: bool = True,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self._texto_accion = texto_accion
        self._enviando = False
        self._foco_puesto = False
        self._primer_campo: QWidget | None = None
        self._campos: list[FormField] = []
        self.resultado: object = None

        self.setObjectName("dialogo_formulario")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setWindowTitle(titulo)
        self.setModal(True)
        self.setFixedWidth(ancho)
        self.setWindowFlag(Qt.WindowType.WindowContextHelpButtonHint, False)

        self._titulo = QLabel(titulo)
        self._titulo.setObjectName("subtitulo")
        self._descripcion = QLabel(descripcion)
        self._descripcion.setProperty("campo", "etiqueta")
        self._descripcion.setWordWrap(True)
        self._descripcion.setVisible(bool(descripcion))

        self._error_bandera = InlineNotice("", "error")
        self._error_bandera.setVisible(False)

        cuerpo = QWidget()
        self.campos = QVBoxLayout(cuerpo)
        self.campos.setContentsMargins(0, 0, 0, 0)
        self.campos.setSpacing(14)
        self._contenido = cuerpo
        if desplazable:
            area = QScrollArea()
            area.setObjectName("area_formulario")
            area.setWidgetResizable(True)
            area.setFrameShape(QFrame.Shape.NoFrame)
            area.setWidget(cuerpo)
            self._contenido = area

        disposicion = QVBoxLayout(self)
        disposicion.setContentsMargins(24, 20, 24, 20)
        disposicion.setSpacing(12)
        disposicion.addWidget(self._titulo)
        disposicion.addWidget(self._descripcion)
        disposicion.addWidget(self._error_bandera)
        disposicion.addWidget(self._contenido, 1)

        botones = QHBoxLayout()
        self.boton_cancelar = crear_boton("Cancelar", "secundaria")
        self.boton_cancelar.clicked.connect(self.reject)
        self.boton_accion = crear_boton(texto_accion, variante_accion)
        self.boton_accion.setObjectName("accion_formulario")
        self.boton_accion.setDefault(True)
        self.boton_accion.clicked.connect(self._aceptar)
        botones.addStretch(1)
        botones.addWidget(self.boton_cancelar)
        botones.addWidget(self.boton_accion)
        disposicion.addLayout(botones)

        ventana = self.window()
        tope = ventana.height() if ventana.isVisible() else 780
        self.setMaximumHeight(int(tope * 0.8))

    # ------------------------------------------------------------------ campos

    def agregar_campo(
        self,
        etiqueta: str,
        campo: QWidget,
        ayuda: str = "",
        obligatorio: bool = False,
    ) -> FormField:
        """Añade un `FormField` y lo recuerda para la recogida de errores."""
        field = FormField(etiqueta, campo, ayuda, obligatorio, self)
        self.campos.addWidget(field)
        self._campos.append(field)
        if self._primer_campo is None:
            self._primer_campo = campo
        return field

    def agregar_seccion(self, titulo: str) -> None:
        """Encabezado de sección dentro del formulario."""
        self.campos.addSpacing(4)
        etiqueta = QLabel(titulo)
        etiqueta.setObjectName("subtitulo")
        self.campos.addWidget(etiqueta)

    def agregar_widget(self, widget: QWidget) -> None:
        self.campos.addWidget(widget)

    def agregar_salto(self, pixeles: int = 8) -> None:
        self.campos.addSpacing(pixeles)

    # ---------------------------------------------------------------- errores

    def error_en(self, campo: FormField, texto: str) -> None:
        campo.set_error(texto)

    def set_error(self, texto: str) -> None:
        """Aviso general de error al pie del título (no sustituye a los de campo)."""
        self._error_bandera.set_texto(texto)
        self._error_bandera.setVisible(True)

    def limpiar_error(self) -> None:
        self._error_bandera.setVisible(False)
        for campo in self._campos:
            campo.limpiar_error()

    # ------------------------------------------------------- envío

    def validar(self) -> "list[tuple[FormField, str]] | str | None":
        """Devuelve los errores de campo o un mensaje general; vacío si es válido."""
        return None

    def antes_de_guardar(self) -> bool:
        """Confirmación previa opcional; `False` detiene el envío sin guardar."""
        return True

    def guardar(self) -> None:
        """Persiste el formulario; cualquier excepción se muestra al pie."""
        raise NotImplementedError

    def enviar(self) -> bool:
        """Punto de entrada del botón de acción; `True` si el diálogo aceptó."""
        if self._enviando:
            return False
        self.limpiar_error()
        try:
            errores = self.validar()
        except Exception as exc:  # noqa: BLE001 - la interfaz nunca se cierra
            self.set_error(mensaje_error(exc))
            return False
        if isinstance(errores, str):
            self.set_error(errores)
            return False
        if errores:
            for campo, texto in errores:
                campo.set_error(texto)
            errores[0][0].campo.setFocus()
            return False
        if not self.antes_de_guardar():
            return False
        self._enviando = True
        self.boton_accion.setEnabled(False)
        self.boton_accion.setText("Guardando…")
        QApplication.processEvents()
        try:
            self.guardar()
        except Exception as exc:  # noqa: BLE001 - el error se muestra en el diálogo
            self._enviando = False
            self.boton_accion.setEnabled(True)
            self.boton_accion.setText(self._texto_accion)
            self.set_error(mensaje_error(exc))
            return False
        self.accept()
        return True

    def _aceptar(self) -> None:
        self.enviar()

    # ------------------------------------------------------------------ foco

    def showEvent(self, event) -> None:  # noqa: N802
        super().showEvent(event)
        if not self._foco_puesto:
            self._foco_puesto = True
            if self._primer_campo is not None:
                self._primer_campo.setFocus()
