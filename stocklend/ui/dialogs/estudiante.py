"""Diálogos de Estudiantes (`UI_SCREENS.md` §4): alta/edición y ficha.

Nota documentada: el formulario de la especificación añade un campo «Nota»
(`ui_screens` §4.6), pero el modelo no tiene esa columna, de modo que el diálogo
solo recoge los tres campos reales de RF-EST-01. La ficha muestra la misma
información que la zona de apoyo y el historial completo (RF-EST-04).
"""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QDialog,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QVBoxLayout,
)

from ..formatters import fecha_hora
from ..widgets.primitives import crear_boton
from .form import FormDialog

_ESTADO_ESTUDIANTE = {True: "Activo", False: "Inactivo"}
_ESTADO_PRESTAMO = {"activo": "Activo", "cerrado": "Cerrado", "anulado": "Anulado"}


class EstudianteDialog(FormDialog):
    """Alta o edición de un estudiante (RF-EST-01, RF-EST-02)."""

    def __init__(self, servicio_estudiantes, estudiante=None, parent=None) -> None:
        es_edicion = estudiante is not None
        super().__init__(
            "Editar estudiante" if es_edicion else "Registrar estudiante",
            "Corregir los datos no altera el historial de préstamos (RN-15)."
            if es_edicion
            else "Los préstamos quedarán a nombre de este estudiante.",
            texto_accion="Guardar cambios" if es_edicion else "Registrar estudiante",
            ancho=460,
            parent=parent,
        )
        self._servicio = servicio_estudiantes
        self._estudiante = estudiante

        self.codigo = QLineEdit()
        self.codigo.setMaxLength(30)
        self.campo_codigo = self.agregar_campo(
            "Código universitario",
            self.codigo,
            "Obligatorio y único en toda la aplicación (RN-11).",
            obligatorio=True,
        )
        self.nombres = QLineEdit()
        self.nombres.setMaxLength(60)
        self.campo_nombres = self.agregar_campo(
            "Nombres",
            self.nombres,
            "No vacío; se busca sin distinguir mayúsculas y acentos (RN-12).",
            obligatorio=True,
        )
        self.apellidos = QLineEdit()
        self.apellidos.setMaxLength(60)
        self.campo_apellidos = self.agregar_campo(
            "Apellidos", self.apellidos, "No vacío.", obligatorio=True
        )

        if estudiante is not None:
            self.codigo.setText(estudiante.codigo_universitario)
            self.nombres.setText(estudiante.nombres)
            self.apellidos.setText(estudiante.apellidos)

    def validar(self):
        errores = []
        if not self.codigo.text().strip():
            errores.append((self.campo_codigo, "El código universitario es obligatorio"))
        if not self.nombres.text().strip():
            errores.append((self.campo_nombres, "Los nombres son obligatorios"))
        if not self.apellidos.text().strip():
            errores.append((self.campo_apellidos, "Los apellidos son obligatorios"))
        return errores

    def guardar(self) -> None:
        if self._estudiante is None:
            self.resultado = self._servicio.registrar_estudiante(
                self.codigo.text().strip(),
                self.nombres.text().strip(),
                self.apellidos.text().strip(),
            )
        else:
            self.resultado = self._servicio.editar_estudiante(
                self._estudiante.id,
                codigo_universitario=self.codigo.text().strip(),
                nombres=self.nombres.text().strip(),
                apellidos=self.apellidos.text().strip(),
            )


class FichaEstudianteDialog(QDialog):
    """Ficha completa con el historial (RF-EST-04); sin acciones de escritura."""

    def __init__(self, servicio_estudiantes, servicio_prestamos, estudiante, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("dialogo_ficha")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setWindowTitle("Ficha del estudiante")
        self.setModal(True)
        self.setMinimumWidth(520)
        self.setMaximumWidth(560)
        self.setWindowFlag(Qt.WindowType.WindowContextHelpButtonHint, False)

        titulo = QLabel(f"{estudiante.nombres} {estudiante.apellidos}")
        titulo.setObjectName("subtitulo")
        codigo = QLabel(estudiante.codigo_universitario)
        codigo.setProperty("campo", "etiqueta")

        cabecera = QVBoxLayout()
        cabecera.setSpacing(2)
        cabecera.addWidget(titulo)
        cabecera.addWidget(codigo)

        estado = QLabel(f"· {_ESTADO_ESTUDIANTE[bool(estudiante.activo)]} ·")
        estado.setProperty("campo", "etiqueta")
        fila_cabecera = QHBoxLayout()
        fila_cabecera.addLayout(cabecera)
        fila_cabecera.addStretch(1)
        fila_cabecera.addWidget(estado)

        seccion = QLabel("Historial de préstamos")
        seccion.setObjectName("subtitulo")
        self.lista = QListWidget()
        self.lista.setObjectName("lista_historial")
        self.lista.setUniformItemSizes(True)

        atras = crear_boton("Cerrar", "secundaria")
        atras.clicked.connect(self.reject)

        botones = QHBoxLayout()
        botones.addStretch(1)
        botones.addWidget(atras)

        disposicion = QVBoxLayout(self)
        disposicion.setContentsMargins(24, 20, 24, 20)
        disposicion.setSpacing(12)
        disposicion.addLayout(fila_cabecera)
        disposicion.addWidget(seccion)
        disposicion.addWidget(self.lista)
        disposicion.addLayout(botones)

        self._cargar_historial(servicio_estudiantes, servicio_prestamos, estudiante.id)

    def _cargar_historial(self, estudiantes, prestamos, estudiante_id: int) -> None:
        for prestamo in estudiantes.historial_prestamos(estudiante_id, limite=50):
            prestadas = pendientes = 0
            for detalle in prestamos.detalles(prestamo.id):
                prestadas += detalle.cantidad_prestada
                pendientes += detalle.cantidad_pendiente or 0
            texto = (
                f"{prestamo.folio}  ·  {fecha_hora(prestamo.fecha_prestamo)}"
                f"  ·  {_ESTADO_PRESTAMO[prestamo.estado.value]}"
                f"  ·  {prestadas} prestadas, {pendientes} pendientes"
            )
            item = QListWidgetItem(texto)
            item.setData(Qt.ItemDataRole.UserRole, prestamo.id)
            self.lista.addItem(item)
