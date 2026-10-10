"""Tarjetas de estadística con imagen decorativa de fondo (módulo Inventario).

Componente reutilizable que pinta una imagen de ``resources/images`` como fondo que
**cubre por completo** la tarjeta (escalado proporcional *cover*, sin bandas blancas ni
deformación), recortado por una `QPainterPath` de esquinas redondeadas, y superpone el
título y la cifra reales con `QLabel`. El encuadre conserva íntegros el icono izquierdo
y las ondas inferiores derechas. Las cuatro tarjetas de Inventario comparten este mismo
mecanismo; el borde se dibuja por encima de la imagen.
"""

from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import QRect, QRectF, QSize, Qt
from PySide6.QtGui import QColor, QPainter, QPainterPath, QPixmap
from PySide6.QtWidgets import QLabel, QSizePolicy, QWidget

from .. import theme

# Recursos resueltos desde el propio paquete (sin rutas absolutas de la máquina).
_DIR_IMAGENES = Path(__file__).resolve().parents[2] / "resources" / "images"

# Proporción nativa de las ilustraciones (2172x724). El contenedor de las tarjetas
# adopta esta misma proporción para que el *cover* no recorte icono ni ondas.
ASPECTO = 2172 / 724

# Franja blanca común a las cuatro imágenes (medida por análisis de píxeles):
# el icono llega hasta ~0.28 y las ondas empiezan, como muy pronto, en ~0.60.
_ICONO_DERECHA = 0.28
_ONDA_IZQUIERDA = 0.58
_MARGEN_TEXTO = 10
_SEPARACION = 4
_ALTO_MINIMO = 84


class StatCardImagen(QWidget):
    """Tarjeta con fondo ilustrado a pantalla completa y datos reales encima."""

    _cache: dict[str, QPixmap] = {}

    def __init__(
        self,
        archivo: str,
        etiqueta: str,
        valor: str = "0",
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("tarjeta_imagen")
        self.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Preferred)
        self.setMinimumWidth(150)
        self.setFixedHeight(self.heightForWidth(260))
        self._pixmap = self._cargar(archivo)

        self.etiqueta = QLabel(etiqueta, self)
        self.etiqueta.setWordWrap(True)
        self.etiqueta.setStyleSheet(
            f"color: {theme.TOKENS.colores.azul_primario_oscuro};"
            f" font-size: {theme.TOKENS.tipografia.secundario}px; font-weight: 600;"
        )
        self.valor = QLabel(valor, self)
        self.valor.setObjectName("dato_destacado")

    # ------------------------------------------------------------------ API pública

    def set_valores(
        self, valor: str | int, etiqueta: str | None = None, _apoyo: str | None = None
    ) -> None:
        """Actualiza la cifra (y opcionalmente el título), como `StatCard`."""
        self.valor.setText(str(valor))
        if etiqueta is not None:
            self.etiqueta.setText(etiqueta)
        self._colocar_texto()

    def hasHeightForWidth(self) -> bool:  # noqa: N802
        return True

    def heightForWidth(self, ancho: int) -> int:  # noqa: N802
        return max(_ALTO_MINIMO, round(ancho / ASPECTO))

    def sizeHint(self) -> QSize:  # noqa: N802
        return QSize(260, self.heightForWidth(260))

    # ---------------------------------------------------------------------- interno

    @classmethod
    def _cargar(cls, archivo: str) -> QPixmap:
        if archivo not in cls._cache:
            cargada = QPixmap(str(_DIR_IMAGENES / archivo))
            cls._cache[archivo] = cargada if not cargada.isNull() else QPixmap()
        return cls._cache[archivo]

    def _rect_imagen(self) -> QRect:
        """Rectángulo que cubre la tarjeta con proporción conservada (cover)."""
        if self._pixmap.isNull() or self.width() <= 0 or self.height() <= 0:
            return self.rect()
        escalado = self._pixmap.size().scaled(
            self.size(), Qt.AspectRatioMode.KeepAspectRatioByExpanding
        )
        # Ancla izquierda/abajo: conserva el icono y las ondas si hubiera recorte.
        x = 0
        y = self.height() - escalado.height()
        return QRect(x, y, escalado.width(), escalado.height())

    def _colocar_texto(self) -> None:
        ancho = self.width()
        izquierda = int(ancho * _ICONO_DERECHA) + _MARGEN_TEXTO
        derecha = int(ancho * _ONDA_IZQUIERDA) - _MARGEN_TEXTO
        ancho_texto = max(48, derecha - izquierda)
        self.etiqueta.setFixedWidth(ancho_texto)
        self.valor.setFixedWidth(ancho_texto)
        alto_etiqueta = self.etiqueta.heightForWidth(ancho_texto)
        alto_valor = self.valor.sizeHint().height()
        total = alto_etiqueta + _SEPARACION + alto_valor
        superior = max(4, (self.height() - total) // 2)
        self.etiqueta.setGeometry(izquierda, superior, ancho_texto, alto_etiqueta)
        self.valor.setGeometry(
            izquierda, superior + alto_etiqueta + _SEPARACION, ancho_texto, alto_valor
        )

    # ------------------------------------------------------------------- eventos Qt

    def resizeEvent(self, evento) -> None:  # noqa: N802
        super().resizeEvent(evento)
        self._colocar_texto()

    def paintEvent(self, evento) -> None:  # noqa: N802
        pintor = QPainter(self)
        pintor.setRenderHints(
            QPainter.RenderHint.Antialiasing
            | QPainter.RenderHint.SmoothPixmapTransform
        )
        radio = theme.TOKENS.medidas.radio_l
        ruta = QPainterPath()
        ruta.addRoundedRect(QRectF(self.rect().adjusted(0, 0, -1, -1)), radio, radio)

        pintor.setClipPath(ruta)
        if self._pixmap.isNull():
            pintor.fillPath(ruta, QColor(theme.TOKENS.colores.superficie))
        else:
            dibujo = self._rect_imagen()
            escalada = self._pixmap.scaled(
                dibujo.size(),
                Qt.AspectRatioMode.KeepAspectRatioByExpanding,
                Qt.TransformationMode.SmoothTransformation,
            )
            pintor.drawPixmap(dibujo.topLeft(), escalada)
        pintor.setClipping(False)

        pintor.setPen(QColor(theme.TOKENS.colores.borde))
        pintor.setBrush(Qt.BrushStyle.NoBrush)
        pintor.drawPath(ruta)
