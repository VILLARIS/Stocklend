"""Iconos vectoriales de StockLend (recursos locales, sin internet).

Cada icono es una plantilla SVG lineal de 24×24 dibujada en este módulo y
renderizada en memoria con `QSvgRenderer` (PySide6). No hay emojis ni dependencia
de red ni de fuentes de iconos; el color se inyecta en la planta para poder pintar
la misma forma en estado inactivo, activo o de aviso.
"""

from __future__ import annotations

from PySide6.QtCore import QByteArray, Qt
from PySide6.QtGui import QIcon, QPainter, QPixmap
from PySide6.QtSvg import QSvgRenderer

_TRAZO = 'fill="none" stroke="{color}" stroke-width="1.8" '
_TRAZO += 'stroke-linecap="round" stroke-linejoin="round"'

_PLANTILLAS: dict[str, str] = {
    "dashboard": f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    f'<path {_TRAZO} d="M3 11.2 12 4l9 7.2"/><path {_TRAZO} d="M5.4 9.6V20h13.2V9.6"/>'
    f'<path {_TRAZO} d="M10 20v-4.6h4V20"/></svg>',
    "inventario": f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    f'<path {_TRAZO} d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z"/>'
    f'<path {_TRAZO} d="M4 7.5l8 3.5 8-3.5"/><path {_TRAZO} d="M12 11v9"/></svg>',
    "estudiantes": f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    f'<circle {_TRAZO} cx="12" cy="8" r="3.4"/>'
    f'<path {_TRAZO} d="M5 20.2c.9-3.9 3.6-5.9 7-5.9s6.1 2 7 5.9"/></svg>',
    "prestamos": f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    f'<path {_TRAZO} d="M12 5v9.5"/><path {_TRAZO} d="M7.6 10.6 12 6.2l4.4 4.4"/>'
    f'<path {_TRAZO} d="M4 14.5V19h16v-4.5"/></svg>',
    "devoluciones": f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    f'<path {_TRAZO} d="M19 11.8H9"/><path {_TRAZO} d="M13 7.8l-4 4 4 4"/>'
    f'<path {_TRAZO} d="M4.5 5v14"/></svg>',
    "reportes": f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    f'<path {_TRAZO} d="M5 20v-7"/><path {_TRAZO} d="M12 20V5"/><path {_TRAZO} d="M19 20v-9"/>'
    f'<path {_TRAZO} d="M3 20h18"/></svg>',
    "incidentes": f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    f'<path {_TRAZO} d="M12 3.8 3 20h18z"/><path {_TRAZO} d="M12 10.4v4"/>'
    f'<path {_TRAZO} d="M12 17.2h.01"/></svg>',
    "disponible": f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    f'<circle {_TRAZO} cx="12" cy="12" r="8.5"/>'
    f'<path {_TRAZO} d="M8.4 12.4 11 15l4.8-5.2"/></svg>',
    "buscar": f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    f'<circle {_TRAZO} cx="10.5" cy="10.5" r="6.5"/>'
    f'<path {_TRAZO} d="M15.6 15.6 20.5 20.5"/></svg>',
    "unidades": f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    f'<rect {_TRAZO} x="4" y="4" width="7" height="7" rx="1"/>'
    f'<rect {_TRAZO} x="13" y="4" width="7" height="7" rx="1"/>'
    f'<rect {_TRAZO} x="4" y="13" width="7" height="7" rx="1"/>'
    f'<rect {_TRAZO} x="13" y="13" width="7" height="7" rx="1"/></svg>',
    "categorias": f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    f'<path {_TRAZO} d="M4 6.4c0-.9.7-1.6 1.6-1.6h4.1c.6 0 1.1.3 1.4.8l.8 1.4h6.5'
    f'c.9 0 1.6.7 1.6 1.6v9.4c0 .9-.7 1.6-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18z"/></svg>',
    "respaldo": f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    f'<path {_TRAZO} d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3v12c0 1.7-3.6 3-8 3s-8-1.3-8-3z"/>'
    f'<path {_TRAZO} d="M4 6v12"/><path {_TRAZO} d="M20 6v12"/><path {_TRAZO} d="M4 12h16"/></svg>',
    "configuracion": f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    f'<path {_TRAZO} d="M4 6h16"/><path {_TRAZO} d="M4 12h16"/><path {_TRAZO} d="M4 18h16"/>'
    f'<circle {_TRAZO} cx="9" cy="6" r="2"/><circle {_TRAZO} cx="15" cy="12" r="2"/>'
    f'<circle {_TRAZO} cx="7" cy="18" r="2"/></svg>',
    "estado_vacio": f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    f'<path {_TRAZO} d="M3.5 12.5h4.2l1.5 2.4c.3.5.9.8 1.5.8h2.6c.6 0 1.2-.3 1.5-.8l1.5-2.4h4.2"/>'
    f'<path {_TRAZO} d="M4.6 5.6h14.8l1.7 6.5c.1.3.2.6.2.9v6c0 .6 '
    f'-.4 1-1 1H3.7a1 1 0 0 1-1-1v-6c0-.3.1-.6.2-.9z"/>'
    "</svg>",
}


def render_icono(svg: str, color: str, tamano: int = 20) -> QIcon:
    """Renderiza una plantilla SVG con el color indicado y la devuelve como `QIcon`."""
    datos = svg.replace("{color}", color)
    renderer = QSvgRenderer(QByteArray(datos.encode("utf-8")))
    pixmap = QPixmap(tamano, tamano)
    pixmap.fill(Qt.GlobalColor.transparent)
    pintar = QPainter(pixmap)
    renderer.render(pintar)
    pintar.end()
    return QIcon(pixmap)


def icono_seccion(clave: str, color: str, tamano: int = 18) -> QIcon:
    """Icono de una sección de la barra lateral, del color pedido."""
    return render_icono(_PLANTILLAS[clave], color, tamano)


def pixmap_seccion(clave: str, color: str, tamano: int = 48) -> QPixmap:
    """Versión `QPixmap` del icono, para estados vacíos y mensajes."""
    return render_icono(_PLANTILLAS[clave], color, tamano).pixmap(tamano, tamano)
