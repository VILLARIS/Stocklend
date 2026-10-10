"""Menú lateral de 240 px con identidad en claro (`UI_DESIGN.md` §5).

La barra es blanca con textos oscuros; la sección activa usa fondo azul y texto
blanco. Incluye logotipo (`StockLend` + marca pintada con `QPainter`), un icono SVG
propio por sección, separación entre navegación principal y secundaria y la versión
al pie. Categorías no es una entrada: es una pestaña dentro de Inventario
(contradicción C-1). La barra no se colapsa.
"""

from __future__ import annotations

from dataclasses import dataclass

from PySide6.QtCore import QRectF, QSize, Qt, Signal
from PySide6.QtGui import QColor, QFont, QPainter, QPixmap
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QPushButton,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

from . import icons, theme
from .widgets.primitives import CountBadge, SeparadorLateral

_TOKENS = theme.TOKENS.colores


@dataclass(frozen=True)
class Seccion:
    """Una entrada de la barra lateral."""

    clave: str
    etiqueta: str
    principal: bool = True
    atajo: str | None = None


SECCIONES: tuple[Seccion, ...] = (
    Seccion("dashboard", "Panel", atajo="Ctrl+1"),
    Seccion("inventario", "Inventario", atajo="Ctrl+2"),
    Seccion("estudiantes", "Estudiantes", atajo="Ctrl+3"),
    Seccion("prestamos", "Préstamos", atajo="Ctrl+4"),
    Seccion("devoluciones", "Devoluciones", atajo="Ctrl+5"),
    Seccion("reportes", "Reportes", atajo="Ctrl+6"),
    Seccion("incidentes", "Incidentes", principal=False, atajo="Ctrl+7"),
    Seccion("respaldo", "Respaldo", principal=False),
    Seccion("configuracion", "Configuración", principal=False, atajo="Ctrl+,"),
)


def _color_icono(seccion: Seccion, activa: bool) -> str:
    if activa:
        return _TOKENS.sidebar_activo_texto
    if seccion.principal:
        return _TOKENS.sidebar_texto
    return _TOKENS.sidebar_texto_apagado


def _pintar_logo() -> QPixmap:
    """Marca 32×32: cuadrado redondeado azul con la letra «S» en blanco."""
    pixmap = QPixmap(32, 32)
    pixmap.fill(Qt.GlobalColor.transparent)
    pintor = QPainter(pixmap)
    pintor.setRenderHint(QPainter.RenderHint.Antialiasing)
    pintor.setPen(Qt.PenStyle.NoPen)
    pintor.setBrush(QColor(_TOKENS.azul_primario))
    pintor.drawRoundedRect(QRectF(1, 1, 30, 30), 8, 8)
    fuente = QFont("Segoe UI", 15)
    fuente.setWeight(QFont.Weight.DemiBold)
    pintor.setFont(fuente)
    pintor.setPen(QColor(_TOKENS.sidebar_activo_texto))
    pintor.drawText(pixmap.rect(), Qt.AlignmentFlag.AlignCenter, "S")
    pintor.end()
    return pixmap


class FilaNavegacion(QWidget):
    """Fila de la barra lateral: icono, botón de sección e insignia opcional."""

    pulsada = Signal(str)

    def __init__(self, seccion: Seccion, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.seccion = seccion
        self.boton = QPushButton(seccion.etiqueta)
        self.boton.setObjectName(f"nav_{seccion.clave}")
        self.boton.setProperty("nav", True)
        self.boton.setProperty("secundario", not seccion.principal)
        self.boton.setProperty("activo", False)
        self.boton.setCursor(Qt.CursorShape.PointingHandCursor)
        self.boton.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.boton.setIconSize(QSize(18, 18))
        self.boton.clicked.connect(lambda: self.pulsada.emit(seccion.clave))
        self._aplicar_icono(False)

        self.insignia = CountBadge()
        self.insignia.setAccessibleName(f"{self.seccion.etiqueta}, insignia")
        disposicion = QHBoxLayout(self)
        disposicion.setContentsMargins(12, 1, 12, 1)
        disposicion.setSpacing(4)
        disposicion.addWidget(self.boton, 1)
        disposicion.addWidget(self.insignia, 0, Qt.AlignmentFlag.AlignVCenter)

    def _aplicar_icono(self, activa: bool) -> None:
        color = _color_icono(self.seccion, activa)
        self.boton.setIcon(icons.icono_seccion(self.seccion.clave, color))

    def set_activa(self, activa: bool) -> None:
        self.boton.setProperty("activo", activa)
        self.boton.style().unpolish(self.boton)
        self.boton.style().polish(self.boton)
        self._aplicar_icono(activa)

    def set_insignia(self, valor: int) -> None:
        self.insignia.set_valor(valor)


class Sidebar(QWidget):
    """Barra lateral completa; emite la clave de la sección elegida."""

    seccion_elegida = Signal(str)

    def __init__(
        self,
        version: str,
        esquema: int,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("barra_lateral")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setFixedWidth(240)
        self._filas: dict[str, FilaNavegacion] = {}

        # Marca: logotipo pintado + nombre.
        logo = QLabel()
        logo.setPixmap(_pintar_logo())
        logo.setFixedSize(32, 32)
        marca = QLabel("StockLend")
        marca.setObjectName("marca")
        marca.setAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
        cabecera = QHBoxLayout()
        cabecera.setContentsMargins(16, 0, 12, 0)
        cabecera.setSpacing(10)
        cabecera.addWidget(logo)
        cabecera.addWidget(marca, 1)

        contenedor_marca = QWidget()
        contenedor_marca.setFixedHeight(64)
        contenedor_marca.setLayout(cabecera)

        disposicion = QVBoxLayout(self)
        disposicion.setContentsMargins(0, 12, 0, 8)
        disposicion.setSpacing(2)
        disposicion.addWidget(contenedor_marca)
        disposicion.addWidget(SeparadorLateral())

        def _agregar_grupo(principales: bool) -> None:
            for seccion in SECCIONES:
                if seccion.principal != principales:
                    continue
                fila = FilaNavegacion(seccion, self)
                fila.pulsada.connect(self.seccion_elegida)
                self._filas[seccion.clave] = fila
                disposicion.addWidget(fila)

        _agregar_grupo(True)
        disposicion.addStretch(1)
        separador = SeparadorLateral()
        separador.setContentsMargins(16, 8, 16, 8)
        disposicion.addWidget(separador)
        _agregar_grupo(False)
        disposicion.addStretch(1)

        version_label = QLabel(f"v{version} · esquema {esquema}")
        version_label.setObjectName("version_lateral")
        version_label.setFixedHeight(28)
        version_label.setContentsMargins(16, 0, 16, 0)
        version_label.setAlignment(
            Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft
        )
        disposicion.addWidget(version_label)

    def set_activa(self, clave: str) -> None:
        for nombre, fila in self._filas.items():
            fila.set_activa(nombre == clave)

    def set_insignia(self, clave: str, valor: int) -> None:
        fila = self._filas.get(clave)
        if fila is not None:
            fila.set_insignia(valor)

    def boton(self, clave: str) -> QPushButton | None:
        fila = self._filas.get(clave)
        return fila.boton if fila is not None else None
