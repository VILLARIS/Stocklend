"""Componentes de estado y presentación (`UI_COMPONENTS.md` §3 y §5)."""

from __future__ import annotations

from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import (
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

from .primitives import crear_boton

_TONOS = {
    "info": ("i", "azul_primario"),
    "correcto": ("✓", "exito"),
    "atencion": ("!", "advertencia_texto"),
    "error": ("×", "error"),
}


class EmptyState(QWidget):
    """Estado vacío compacto: icono, mensaje, descripción y acción (`§5.1`)."""

    accion_pulsada = Signal()

    def __init__(
        self,
        titulo: str = "",
        explicacion: str = "",
        accion_texto: str | None = None,
        icono: QPixmap | None = None,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("estado_vacio")
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)

        self.icono = QLabel()
        self.icono.setObjectName("icono_estado_vacio")
        self.icono.setFixedHeight(52)
        self.icono.setAlignment(Qt.AlignmentFlag.AlignCenter)

        self.titulo = QLabel()
        self.titulo.setObjectName("titulo_estado_vacio")
        self.titulo.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.explicacion = QLabel()
        self.explicacion.setObjectName("descripcion_estado_vacio")
        self.explicacion.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.explicacion.setWordWrap(True)
        self.accion = crear_boton("", "primaria")
        self.accion.clicked.connect(self.accion_pulsada)

        disposicion = QVBoxLayout(self)
        disposicion.setContentsMargins(24, 24, 24, 24)
        disposicion.setSpacing(8)
        disposicion.addStretch(1)
        disposicion.addWidget(self.icono)
        disposicion.addWidget(self.titulo)
        disposicion.addWidget(self.explicacion)
        disposicion.addWidget(self.accion, 0, Qt.AlignmentFlag.AlignHCenter)
        disposicion.addStretch(1)
        self.configurar(titulo, explicacion, accion_texto, icono)

    def configurar(
        self,
        titulo: str,
        explicacion: str = "",
        accion_texto: str | None = None,
        icono: QPixmap | None = None,
    ) -> None:
        self.titulo.setText(titulo)
        self.explicacion.setText(explicacion)
        self.explicacion.setVisible(bool(explicacion))
        self.accion.setText(accion_texto or "")
        self.accion.setVisible(bool(accion_texto))
        self.icono.setPixmap(icono or QPixmap())
        self.icono.setVisible(self.icono.pixmap() is not None and not self.icono.pixmap().isNull())


class InlineNotice(QWidget):
    """Aviso en línea, cuatro tonos (`§5.2`)."""

    accion_pulsada = Signal()

    def __init__(
        self,
        texto: str,
        tono: str = "info",
        titulo: str | None = None,
        accion_texto: str | None = None,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("aviso_en_linea")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setProperty("tono", tono)
        icono, _ = _TONOS.get(tono, _TONOS["info"])
        self.icono = QLabel(icono)
        self.icono.setObjectName("icono_aviso")
        self.icono.setFixedWidth(16)

        self.titulo = QLabel(titulo or "")
        self.titulo.setObjectName("titulo_aviso")
        self.titulo.setVisible(bool(titulo))
        self.texto = QLabel(texto)
        self.texto.setWordWrap(True)

        mensaje = QVBoxLayout()
        mensaje.setContentsMargins(0, 0, 0, 0)
        mensaje.setSpacing(2)
        mensaje.addWidget(self.titulo)
        mensaje.addWidget(self.texto)

        disposicion = QHBoxLayout(self)
        disposicion.setContentsMargins(12, 10, 12, 10)
        disposicion.setSpacing(8)
        disposicion.addWidget(self.icono, 0, Qt.AlignmentFlag.AlignTop)
        disposicion.addLayout(mensaje, 1)
        self.accion = crear_boton(accion_texto or "", "terciaria")
        self.accion.clicked.connect(self.accion_pulsada)
        self.accion.setVisible(bool(accion_texto))
        disposicion.addWidget(self.accion, 0, Qt.AlignmentFlag.AlignVCenter)

    def set_texto(self, texto: str) -> None:
        """Cambia el texto del aviso sin reconstruir el widget."""
        self.texto.setText(texto)


class Toast(QWidget):
    """Aviso flotante de resultado, no modal (`§5.4`)."""

    def __init__(
        self,
        texto: str,
        tono: str = "correcto",
        duracion: int = 4000,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("aviso_flotante")
        self.setProperty("tono", tono)
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        icono, _ = _TONOS.get(tono, _TONOS["correcto"])
        etiqueta_icono = QLabel(icono)
        etiqueta_icono.setFixedWidth(16)
        etiqueta_texto = QLabel(texto)
        etiqueta_texto.setWordWrap(True)
        disposicion = QHBoxLayout(self)
        disposicion.setContentsMargins(12, 8, 12, 8)
        disposicion.setSpacing(8)
        disposicion.addWidget(etiqueta_icono)
        disposicion.addWidget(etiqueta_texto)
        self.adjustSize()
        self._temporizador = QTimer(self)
        self._temporizador.setSingleShot(True)
        self._temporizador.timeout.connect(self.close)
        self._temporizador.start(duracion)

    @classmethod
    def mostrar(
        cls,
        padre: QWidget,
        texto: str,
        tono: str = "correcto",
        duracion: int = 4000,
    ) -> "Toast":
        toast = cls(texto, tono, duracion, padre)
        toast.adjustSize()
        margen = 24
        x = padre.width() - toast.width() - margen
        y = padre.height() - toast.height() - margen
        toast.move(max(0, x), max(0, y))
        toast.show()
        toast.raise_()
        return toast


class StatCard(QFrame):
    """Una cifra real con su etiqueta y su unidad (`§3.1`)."""

    def __init__(
        self,
        etiqueta: str,
        valor: str = "0",
        apoyo: str = "",
        icono: QPixmap | None = None,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("tarjeta_estadistica")
        self.setProperty("tarjeta", True)
        self.setFixedHeight(132)
        self.setMinimumWidth(180)
        self.valor = QLabel(valor)
        self.valor.setObjectName("dato_destacado")
        self.icono = QLabel()
        self.icono.setObjectName("icono_estadistica")
        if icono is not None:
            self.icono.setPixmap(icono)
        self.icono.setVisible(icono is not None and not icono.isNull())
        self.etiqueta = QLabel(etiqueta)
        self.etiqueta.setProperty("campo", "etiqueta")
        self.apoyo = QLabel(apoyo)
        self.apoyo.setProperty("campo", "etiqueta")
        self.apoyo.setWordWrap(True)

        cabecera = QHBoxLayout()
        cabecera.setContentsMargins(0, 0, 0, 0)
        cabecera.setSpacing(8)
        cabecera.addWidget(self.valor)
        cabecera.addStretch(1)
        cabecera.addWidget(self.icono, 0, Qt.AlignmentFlag.AlignTop)

        disposicion = QVBoxLayout(self)
        disposicion.setContentsMargins(20, 20, 20, 20)
        disposicion.setSpacing(4)
        disposicion.addLayout(cabecera)
        disposicion.addWidget(self.etiqueta)
        disposicion.addWidget(self.apoyo)
        disposicion.addStretch(1)

    def set_valores(
        self, valor: str | int, etiqueta: str | None = None, apoyo: str | None = None
    ) -> None:
        self.valor.setText(str(valor))
        if etiqueta is not None:
            self.etiqueta.setText(etiqueta)
        if apoyo is not None:
            self.apoyo.setText(apoyo)


class FilaEstadisticas(QWidget):
    """Fila de `StatCard` que se reorganiza sola al cambiar el ancho.

    En pantallas anchas usa cuatro columnas; en pantallas estrechas baja a dos
    (o a una) para que las cifras sigan legibles sin recortarse.
    """

    def __init__(self, tarjetas: list[StatCard], parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setObjectName("fila_estadisticas")
        self._tarjetas = list(tarjetas)
        self._columnas = 0
        self._rejilla = QGridLayout(self)
        self._rejilla.setContentsMargins(0, 0, 0, 0)
        self._rejilla.setHorizontalSpacing(16)
        self._rejilla.setVerticalSpacing(16)
        self._reorganizar(4)

    def _calcular_columnas(self, ancho: int) -> int:
        if ancho >= 820 or ancho <= 0:
            return 4
        if ancho >= 420:
            return 2
        return 1

    def _reorganizar(self, columnas: int) -> None:
        columnas = max(1, min(4, columnas))
        if columnas != self._columnas:
            self._columnas = columnas
            while self._rejilla.count():
                self._rejilla.takeAt(0)
            for columna in range(4):
                self._rejilla.setColumnStretch(columna, 1 if columna < columnas else 0)
            for posicion, tarjeta in enumerate(self._tarjetas):
                self._rejilla.addWidget(
                    tarjeta, posicion // columnas, posicion % columnas
                )
        self._ajustar_alturas()

    def _ajustar_alturas(self) -> None:
        """Ajusta la altura de cada tarjeta a la proporción de su ancho (cover)."""
        columnas = max(1, self._columnas)
        espacios = self._rejilla.horizontalSpacing() * (columnas - 1)
        ancho = max(1, (self.width() - espacios) // columnas)
        for tarjeta in self._tarjetas:
            if tarjeta.hasHeightForWidth():
                tarjeta.setFixedHeight(tarjeta.heightForWidth(ancho))

    def resizeEvent(self, evento) -> None:  # noqa: N802
        super().resizeEvent(evento)
        self._reorganizar(self._calcular_columnas(self.width()))


class DetailPanel(QFrame):
    """Zona de apoyo con el contexto de lo seleccionado (`§2.4`).

    Aparece solo cuando hay una fila elegida; el flujo de la página lo oculta al
    cerrarlo (`cerrado`) o al terminar sin selección. No deforma la distribución:
    la tabla vuelve a ocupar todo el ancho cuando el panel no está visible.
    """

    cerrado = Signal()
    accion_pulsada = Signal()

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setObjectName("panel_detalle")
        self.setProperty("tarjeta", True)
        self.setMinimumWidth(300)
        self.setMaximumWidth(340)

        self._titulo = QLabel()
        self._titulo.setObjectName("subtitulo")
        self._titulo.setWordWrap(True)
        self.boton_cerrar = QPushButton("×")
        self.boton_cerrar.setObjectName("boton_cerrar")
        self.boton_cerrar.setToolTip("Cerrar el detalle")
        self.boton_cerrar.setAccessibleName("Cerrar el detalle")
        self.boton_cerrar.clicked.connect(self.cerrado)

        cabecera = QHBoxLayout()
        cabecera.setContentsMargins(0, 0, 0, 0)
        cabecera.setSpacing(8)
        cabecera.addWidget(self._titulo, 1)
        cabecera.addWidget(self.boton_cerrar, 0, Qt.AlignmentFlag.AlignTop)

        self._disposicion = QVBoxLayout(self)
        self._disposicion.setContentsMargins(16, 12, 16, 16)
        self._disposicion.setSpacing(12)
        self._disposicion.addLayout(cabecera)
        self.mostrar_vacio()

    def _limpiar(self) -> None:
        while self._disposicion.count() > 1:
            item = self._disposicion.takeAt(1)
            widget = item.widget()
            if widget is not None:
                widget.deleteLater()

    def mostrar_vacio(self) -> None:
        self._titulo.setVisible(False)
        self._limpiar()
        aviso = QLabel("Selecciona una fila para ver su detalle")
        aviso.setProperty("campo", "etiqueta")
        aviso.setWordWrap(True)
        self._disposicion.addWidget(aviso)
        self._disposicion.addStretch(1)

    def mostrar(
        self,
        titulo: str,
        pares: list[tuple[str, str]],
        accion_texto: str | None = None,
    ) -> None:
        self._titulo.setText(titulo)
        self._titulo.setVisible(True)
        self._limpiar()
        for clave, valor in pares:
            fila = QHBoxLayout()
            fila.setSpacing(8)
            etiqueta = QLabel(clave)
            etiqueta.setProperty("campo", "etiqueta")
            etiqueta.setMinimumWidth(120)
            dato = QLabel(valor)
            dato.setWordWrap(True)
            fila.addWidget(etiqueta)
            fila.addWidget(dato, 1)
            self._disposicion.addLayout(fila)
        self._disposicion.addStretch(1)
        if accion_texto:
            boton = crear_boton(accion_texto, "terciaria")
            boton.clicked.connect(self.accion_pulsada)
            self._disposicion.addWidget(boton)
