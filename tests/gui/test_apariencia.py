"""Apariencia: contraste de tokens y requisitos visuales de la Etapa 5.

Las proporciones se calculan conforme a WCAG 2.1 (§1.4.3): AA requiere 4.5:1
para texto normal y 7:1 en la identidad (texto principal sobre fondo).
"""

from __future__ import annotations

from PySide6.QtCore import Qt

from stocklend.ui import icons, theme


def _rgb(color: str) -> tuple[int, int, int]:
    valor = color.lstrip("#")
    return tuple(int(valor[i : i + 2], 16) for i in (0, 2, 4))


def _lineal(v: float) -> float:
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def _luminancia(color: str) -> float:
    r, g, b = (float(ch) / 255 for ch in _rgb(color))
    return 0.2126 * _lineal(r) + 0.7152 * _lineal(g) + 0.0722 * _lineal(b)


def razon_contraste(a: str, b: str) -> float:
    la, lb = _luminancia(a), _luminancia(b)
    alta, baja = max(la, lb), min(la, lb)
    return (alta + 0.05) / (baja + 0.05)


def test_texto_sobre_fondo_supera_aaa():
    c = theme.TOKENS.colores
    assert razon_contraste(c.texto, c.fondo) >= 7
    assert razon_contraste(c.texto, c.superficie) >= 7
    assert razon_contraste(c.texto_secundario, c.fondo) >= 4.5
    assert razon_contraste(c.texto_secundario, c.superficie) >= 4.5
    assert razon_contraste(c.texto_secundario, c.borde_suave) >= 4.5


def test_contraste_barra_lateral():
    c = theme.TOKENS.colores
    assert razon_contraste(c.sidebar_texto, c.sidebar_fondo) >= 7
    assert razon_contraste(c.sidebar_texto_apagado, c.sidebar_fondo) >= 4.5
    assert razon_contraste(c.sidebar_marca, c.sidebar_fondo) >= 7
    assert razon_contraste(c.sidebar_activo_texto, c.sidebar_activo_fondo) >= 4.5
    assert razon_contraste(c.sidebar_activo_texto, c.azul_primario_hover) >= 4.5


def test_contraste_botones_y_pastillas():
    c = theme.TOKENS.colores
    assert razon_contraste(c.superficie, c.azul_primario) >= 4.5
    assert razon_contraste(c.superficie, c.error) >= 4.5
    assert razon_contraste(c.azul_primario, c.superficie) >= 4.5
    assert razon_contraste(c.exito, c.exito_claro) >= 4.5
    assert razon_contraste(c.advertencia_texto, c.advertencia_claro) >= 4.5
    assert razon_contraste(c.error, c.error_claro) >= 4.5


def test_iconos_plantillas_renderizan(qtbot):
    c = theme.TOKENS.colores
    for clave in icons._PLANTILLAS:
        imagen = icons.pixmap_seccion(clave, c.sidebar_texto, 18).toImage()
        trazados = sum(
            1
            for p in range(18 * 18)
            if imagen.pixelColor(p % 18, p // 18).alpha() > 10
        )
        assert trazados > 30, clave


def test_sidebar_fondo_y_estados_de_navegacion(ventana):
    barra = ventana.sidebar
    assert barra.testAttribute(Qt.WidgetAttribute.WA_StyledBackground)
    principal = barra.boton("inventario")
    secundaria = barra.boton("incidentes")
    assert principal.property("nav") is True
    assert principal.property("secundario") is False
    assert secundaria.property("secundario") is True
    assert not principal.icon().isNull()
    ventana.ir_a("inventario")
    assert principal.property("activo") is True
    assert barra.boton("dashboard").property("activo") is False


def test_hoja_qss_incluye_estados_hover_focus_y_disabled():
    hoja = theme.qss()
    from PySide6.QtWidgets import QApplication

    aplicacion = QApplication.instance()
    if aplicacion is not None:
        aplicacion.setStyleSheet(hoja)
    assert "QWidget#barra_lateral {" in hoja
    assert 'QPushButton[nav="true"] {' in hoja
    assert 'QPushButton[nav="true"]:hover {' in hoja
    assert "QPushButton:focus {" in hoja
    assert "QPushButton:disabled {" in hoja
    assert "QLineEdit:focus" in hoja
    assert "QTableView::item:selected {" in hoja
    assert "QLabel#titulo_estado_vacio {" in hoja
