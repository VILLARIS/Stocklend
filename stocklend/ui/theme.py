"""Tema visual de StockLend: tokens de `UI_DESIGN.md` §3 y hoja QSS generada.

La hoja de estilos se **genera** a partir de los tokens (UI_DESIGN §9.2); no hay
QSS escrito a mano. Los colores que QSS no alcanza (delegates, foco, iconos) se
toman de este mismo módulo, nunca de un literal suelto.

Identidad en claro: fondo gris extremadamente claro, barra lateral blanca, azul
principal profesional, textos oscuros y secundarios grises. Los cuatro estados
(suceso, atención, error, información) usan tonos con contraste medido contra su
fondo (§3 de `UI_DESIGN.md` y correcciones C-2).

**Nota de renderizado:** Qt solo pinta fondos QSS sobre subclases de `QWidget`
(cabeceras, barra lateral, avisos, diálogos) si el widget tiene el atributo
`WA_StyledBackground`. Esto no está en la hoja de estilos: se fija en el
constructor de cada uno de esos widgets.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Colores:
    """Tokens de color (`UI_DESIGN.md` §3.1). Identidad en claro."""

    azul_primario: str = "#1E5AA8"
    azul_primario_oscuro: str = "#153E75"
    azul_primario_hover: str = "#2867B5"
    azul_claro: str = "#E8F0FB"
    fondo: str = "#F5F7FA"
    superficie: str = "#FFFFFF"
    hover_fila: str = "#EEF2F8"
    borde_suave: str = "#EEF1F6"
    borde: str = "#E1E7EF"
    borde_fuerte: str = "#828D9E"
    cabecera_tabla: str = "#EFF3F9"
    texto: str = "#232F3F"
    texto_secundario: str = "#5A6672"
    exito: str = "#1E7B45"
    exito_claro: str = "#E6F4EC"
    advertencia: str = "#B26A00"
    advertencia_texto: str = "#9C5800"
    advertencia_claro: str = "#FDF1E0"
    error: str = "#B3261E"
    error_claro: str = "#FCEAE9"
    foco: str = "#1E5AA8"

    # Barra lateral (identidad en claro): fondo blanco, textos oscuros.
    sidebar_fondo: str = "#FFFFFF"
    sidebar_borde: str = "#E3E9F2"
    sidebar_texto: str = "#26334A"
    sidebar_texto_apagado: str = "#5A6672"
    sidebar_hover: str = "#EDF3FA"
    sidebar_activo_fondo: str = "#1E5AA8"
    sidebar_activo_texto: str = "#FFFFFF"
    sidebar_marca: str = "#153E75"


@dataclass(frozen=True)
class Tipografia:
    """Tokens tipográficos (`UI_DESIGN.md` §3.4), en píxeles."""

    familia: str = "Segoe UI"
    titulo_seccion: int = 20
    subtitulo: int = 16
    cuerpo: int = 13
    secundario: int = 12
    dato_destacado: int = 28
    etiqueta: int = 11


@dataclass(frozen=True)
class Medidas:
    """Espaciado base 4 px, radios y alturas fijas (`UI_DESIGN.md` §3.5 y §3.6)."""

    base: int = 4
    radio_s: int = 4
    radio_m: int = 6
    radio_l: int = 8
    alto_boton: int = 34
    alto_boton_grande: int = 40
    alto_campo: int = 36
    alto_fila_sidebar: int = 40
    alto_fila_tabla: int = 42
    alto_cabecera_tabla: int = 42
    alto_pastilla: int = 22
    ancho_sidebar: int = 240
    alto_marca: int = 64
    alto_version: int = 28
    alto_barra_estado: int = 26
    margen_pagina: int = 24


@dataclass(frozen=True)
class Tema:
    """Todos los tokens de la interfaz en un solo sitio."""

    colores: Colores = Colores()
    tipografia: Tipografia = Tipografia()
    medidas: Medidas = Medidas()


TOKENS = Tema()

COLOR_FOCO = TOKENS.colores.foco


def qss(tema: Tema = TOKENS) -> str:
    """Genera la hoja de estilos completa a partir de los tokens."""
    c = tema.colores
    t = tema.tipografia
    m = tema.medidas
    return f"""
* {{
    font-family: "{t.familia}";
    font-size: {t.cuerpo}px;
    color: {c.texto};
}}
QMainWindow {{
    background-color: {c.fondo};
}}
QDialog {{
    background-color: {c.superficie};
}}

/* ---------------------------------------------------------------- barra lateral */
QWidget#barra_lateral {{
    background-color: {c.sidebar_fondo};
    border-right: 1px solid {c.sidebar_borde};
}}
QLabel#marca {{
    color: {c.sidebar_marca};
    font-size: 18px;
    font-weight: 700;
}}
QFrame#separador_lateral {{
    background-color: {c.borde_suave};
    max-height: 1px;
}}
QLabel#version_lateral {{
    color: {c.texto_secundario};
    font-size: {t.secundario}px;
}}
QPushButton[nav="true"] {{
    background-color: transparent;
    color: {c.sidebar_texto};
    border: none;
    border-radius: {m.radio_m}px;
    text-align: left;
    padding: 0 12px;
    min-height: {m.alto_fila_sidebar}px;
    font-size: {t.cuerpo}px;
}}
QPushButton[nav="true"]:hover {{
    background-color: {c.sidebar_hover};
}}
QPushButton[nav="true"]:focus {{
    background-color: {c.sidebar_hover};
}}
QPushButton[nav="true"][secundario="true"] {{
    color: {c.sidebar_texto_apagado};
    font-size: {t.cuerpo}px;
}}
QPushButton[nav="true"][secundario="true"]:hover {{
    background-color: {c.sidebar_hover};
}}
QPushButton[nav="true"][activo="true"] {{
    background-color: {c.sidebar_activo_fondo};
    color: {c.sidebar_activo_texto};
    font-weight: 600;
}}
QPushButton[nav="true"][activo="true"]:hover {{
    background-color: {c.azul_primario_hover};
}}
QPushButton[nav="true"][activo="true"]:focus {{
    background-color: {c.azul_primario_hover};
}}

/* ------------------------------------------------------------ cabecera de página */
QWidget#cabecera_seccion {{
    background-color: {c.superficie};
    border-bottom: 1px solid {c.borde_suave};
}}
QLabel#titulo_seccion {{
    font-size: {t.titulo_seccion}px;
    font-weight: 600;
    color: {c.texto};
}}
QLabel#subtitulo_seccion {{
    color: {c.texto_secundario};
    font-size: {t.secundario}px;
}}
QLabel#subtitulo {{
    font-size: {t.subtitulo}px;
    font-weight: 600;
}}
QLabel[campo="etiqueta"] {{
    color: {c.texto_secundario};
    font-size: {t.secundario}px;
}}

/* ---------------------------------------------------------------------- botones */
QPushButton {{
    background-color: {c.superficie};
    color: {c.texto};
    border: 1px solid {c.borde};
    border-radius: {m.radio_m}px;
    min-height: {m.alto_boton}px;
    padding: 0 14px;
    font-size: {t.cuerpo}px;
}}
QPushButton[variante="primaria"] {{
    background-color: {c.azul_primario};
    color: {c.superficie};
    border: 1px solid {c.azul_primario};
    font-weight: 600;
}}
QPushButton[variante="primaria"]:hover {{
    background-color: {c.azul_primario_hover};
    border-color: {c.azul_primario_hover};
}}
QPushButton[variante="primaria"]:pressed {{
    background-color: {c.azul_primario_oscuro};
    border-color: {c.azul_primario_oscuro};
}}
QPushButton[variante="secundaria"] {{
    background-color: {c.superficie};
    color: {c.azul_primario};
    border: 1px solid {c.borde_fuerte};
}}
QPushButton[variante="secundaria"]:hover {{
    background-color: {c.azul_claro};
}}
QPushButton[variante="terciaria"] {{
    background-color: transparent;
    color: {c.azul_primario};
    border: none;
    padding: 0 8px;
}}
QPushButton[variante="terciaria"]:hover {{
    background-color: {c.azul_claro};
    border-radius: {m.radio_s}px;
}}
QPushButton[variante="destructiva"] {{
    background-color: {c.error};
    color: {c.superficie};
    border: 1px solid {c.error};
    font-weight: 600;
}}
QPushButton[variante="destructiva"]:hover {{
    background-color: #8F1F18;
    border-color: #8F1F18;
}}
QPushButton[variante="icono"] {{
    background-color: transparent;
    color: {c.texto_secundario};
    border: none;
    min-width: {m.alto_boton}px;
    max-width: {m.alto_boton}px;
    min-height: {m.alto_boton}px;
    padding: 0;
    border-radius: {m.radio_m}px;
}}
QPushButton[variante="icono"]:hover {{
    background-color: {c.borde_suave};
}}
QPushButton:focus {{
    border-color: {c.foco};
}}
QPushButton[variante="primaria"]:focus,
QPushButton[variante="destructiva"]:focus {{
    border-color: {c.superficie};
}}
QPushButton[variante="terciaria"]:focus {{
    background-color: {c.azul_claro};
}}
QPushButton:disabled {{
    background-color: {c.borde_suave};
    color: {c.texto_secundario};
    border: 1px solid {c.borde};
}}

/* ------------------------------------------------------- campos de entrada */
QLineEdit, QComboBox, QDateEdit, QSpinBox, QPlainTextEdit {{
    background-color: {c.superficie};
    color: {c.texto};
    border: 1px solid {c.borde_fuerte};
    border-radius: {m.radio_m}px;
    padding: 0 10px;
    min-height: {m.alto_campo}px;
    selection-background-color: {c.azul_primario};
    selection-color: {c.superficie};
}}
QLineEdit:focus, QComboBox:focus, QDateEdit:focus, QSpinBox:focus, QPlainTextEdit:focus {{
    border: 2px solid {c.foco};
}}
QLineEdit[error="true"] {{ border: 2px solid {c.error}; }}
QLineEdit::placeholder {{ color: {c.texto_secundario}; }}
QLabel#mensaje_error {{
    color: {c.error};
    font-size: {t.secundario}px;
}}
QLabel#texto_ayuda {{
    color: {c.texto_secundario};
    font-size: {t.secundario}px;
}}
QWidget#barra_herramientas {{
    border-bottom: 1px solid {c.borde_suave};
}}

/* ---------------------------------------------------------------------- tabla */
QTableView {{
    background-color: {c.superficie};
    border: 1px solid {c.borde};
    border-radius: {m.radio_l}px;
    selection-background-color: {c.azul_claro};
    selection-color: {c.texto};
    outline: none;
}}
QTableView::item {{
    padding: 0 12px;
    border-bottom: 1px solid {c.borde_suave};
}}
QTableView::item:hover {{
    background-color: {c.hover_fila};
}}
QTableView::item:selected {{
    background-color: {c.azul_claro};
    color: {c.texto};
    border-left: 3px solid {c.azul_primario};
}}
QTableView::item:selected:hover {{
    background-color: #DBE8F7;
}}
QHeaderView {{
    background-color: transparent;
}}
QHeaderView::section {{
    background-color: {c.superficie};
    color: {c.texto_secundario};
    font-weight: 600;
    font-size: {t.secundario}px;
    border: none;
    border-bottom: 1px solid {c.borde};
    padding: 0 12px;
    min-height: {m.alto_cabecera_tabla}px;
}}

/* ---------------------------------------------------------------- inventario */
QLabel#dato_destacado {{
    font-size: {t.dato_destacado}px;
    font-weight: 600;
}}
QLabel#icono_estadistica {{
    max-width: 30px;
    max-height: 30px;
}}
QFrame#contenedor_inventario {{
    background-color: {c.superficie};
    border: 1px solid {c.borde};
    border-radius: {m.radio_l}px;
}}
QFrame#separador_inventario {{
    background-color: {c.borde_suave};
    border: none;
    max-height: 1px;
}}

/* pestañas compactas del bloque de trabajo */
QTabBar#pestanas_inventario {{
    background-color: transparent;
    padding: 6px 10px 0 10px;
}}
QTabBar#pestanas_inventario::tab {{
    background-color: transparent;
    color: {c.texto_secundario};
    border: none;
    border-radius: {m.radio_m}px;
    padding: 0 14px;
    margin: 0 2px 6px 2px;
    min-height: 34px;
    font-size: {t.cuerpo}px;
}}
QTabBar#pestanas_inventario::tab:hover {{
    color: {c.texto};
    background-color: {c.hover_fila};
}}
QTabBar#pestanas_inventario::tab:selected {{
    color: {c.azul_primario};
    font-weight: 600;
    background-color: {c.azul_claro};
}}

/* buscador y filtro de categoría */
#filtro_inventario QLineEdit,
#filtro_inventario QComboBox {{
    background-color: {c.fondo};
    border: 1px solid {c.borde};
    border-radius: {m.radio_m}px;
    min-height: {m.alto_campo}px;
    padding: 0 12px;
}}
#filtro_inventario QLineEdit:focus,
#filtro_inventario QComboBox:focus,
#filtro_inventario QComboBox:on {{
    border: 1px solid {c.foco};
    background-color: {c.superficie};
}}
#filtro_categoria::drop-down {{
    border: none;
    width: 26px;
}}
#filtro_categoria::down-arrow {{
    image: none;
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid {c.texto_secundario};
    margin-right: 10px;
}}
QComboBox QAbstractItemView {{
    border: 1px solid {c.borde};
    border-radius: {m.radio_m}px;
    background-color: {c.superficie};
    selection-background-color: {c.azul_claro};
    selection-color: {c.texto};
    outline: none;
    padding: 4px;
}}

/* tabla del inventario */
QTableView#tabla_inventario {{
    background-color: {c.superficie};
    border: none;
    border-radius: 0;
    selection-background-color: {c.azul_claro};
    selection-color: {c.texto};
    outline: none;
    gridline-color: transparent;
}}
QTableView#tabla_inventario::item {{
    padding: 0 12px;
    border-bottom: 1px solid {c.borde_suave};
}}
QTableView#tabla_inventario::item:hover {{
    background-color: {c.hover_fila};
}}
QTableView#tabla_inventario::item:selected {{
    background-color: {c.azul_claro};
    color: {c.texto};
}}
QHeaderView#cabecera_inventario {{
    background-color: transparent;
}}
QHeaderView#cabecera_inventario::section {{
    background-color: {c.cabecera_tabla};
    color: {c.texto};
    font-weight: 600;
    font-size: {t.secundario}px;
    border: none;
    border-bottom: 1px solid {c.borde};
    border-right: 1px solid {c.borde_suave};
    padding: 0 12px;
    min-height: 44px;
}}
QHeaderView#cabecera_inventario::section:last {{
    border-right: none;
}}

/* pie del contenedor */
#texto_pie {{
    color: {c.texto_secundario};
    font-size: {t.secundario}px;
}}

/* -------------------------------------------------------------- tarjetas y paneles */
QFrame[tarjeta="true"] {{
    background-color: {c.superficie};
    border: 1px solid {c.borde};
    border-radius: {m.radio_l}px;
}}
QWidget[tono="info"] {{
    background-color: {c.azul_claro};
    border: 1px solid {c.azul_primario};
    border-radius: {m.radio_m}px;
}}
QWidget[tono="correcto"] {{
    background-color: {c.exito_claro};
    border: 1px solid {c.exito};
    border-radius: {m.radio_m}px;
}}
QWidget[tono="atencion"] {{
    background-color: {c.advertencia_claro};
    border: 1px solid {c.advertencia};
    border-radius: {m.radio_m}px;
}}
QWidget[tono="error"] {{
    background-color: {c.error_claro};
    border: 1px solid {c.error};
    border-radius: {m.radio_m}px;
}}
QLabel#icono_aviso {{
    font-size: {t.subtitulo}px;
    font-weight: 700;
}}
QLabel#titulo_aviso {{
    font-weight: 600;
    font-size: {t.cuerpo}px;
}}

/* ------------------------------------------------------------- estado vacío */
QLabel#icono_estado_vacio {{ max-width: 56px; max-height: 56px; }}
QLabel#titulo_estado_vacio {{
    font-size: {t.subtitulo}px;
    font-weight: 600;
    color: {c.texto};
}}
QLabel#descripcion_estado_vacio {{
    color: {c.texto_secundario};
    font-size: {t.cuerpo}px;
}}

/* ------------------------------------------------------------ panel de detalle */
QPushButton#boton_cerrar {{
    background-color: transparent;
    color: {c.texto_secundario};
    border: none;
    min-width: 28px;
    max-width: 28px;
    min-height: 28px;
    border-radius: {m.radio_s}px;
    font-size: {t.subtitulo}px;
}}
QPushButton#boton_cerrar:hover {{
    background-color: {c.borde_suave};
    color: {c.texto};
}}

/* ------------------------------------------------------------------ pestañas */
QTabWidget::pane {{ border: none; }}
QTabBar::tab {{
    background: transparent;
    color: {c.texto_secundario};
    padding: 8px 16px;
    border: none;
    border-bottom: 2px solid transparent;
}}
QTabBar::tab:hover {{
    color: {c.texto};
}}
QTabBar::tab:selected {{
    color: {c.texto};
    font-weight: 600;
    border-bottom: 2px solid {c.azul_primario};
}}

/* ------------------------------------------------------------- barra de estado */
QStatusBar {{
    background-color: {c.superficie};
    border-top: 1px solid {c.borde_suave};
    color: {c.texto_secundario};
    min-height: {m.alto_barra_estado}px;
    font-size: {t.secundario}px;
}}
QStatusBar::item {{ border: none; }}

/* ------------------------------------------------------------------ insignia */
QLabel#insignia {{
    background-color: {c.error};
    color: {c.superficie};
    border-radius: 9px;
    min-height: 18px;
    max-height: 18px;
    min-width: 18px;
    font-size: {t.etiqueta}px;
    font-weight: 700;
    padding: 0 5px;
}}

/* ----------------------------------------------------------- barras de scroll */
QScrollBar:vertical {{
    background: transparent;
    width: 12px;
    margin: 2px;
}}
QScrollBar::handle:vertical {{
    background: {c.borde_fuerte};
    border-radius: 5px;
    min-height: 24px;
}}
QScrollBar::handle:vertical:hover {{ background: {c.texto_secundario}; }}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {{ background: transparent; }}
QScrollBar:horizontal {{
    background: transparent;
    height: 12px;
    margin: 2px;
}}
QScrollBar::handle:horizontal {{
    background: {c.borde_fuerte};
    border-radius: 5px;
    min-width: 24px;
}}
QScrollBar::handle:horizontal:hover {{ background: {c.texto_secundario}; }}
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{ width: 0; }}
QScrollBar::add-page:horizontal, QScrollBar::sub-page:horizontal {{ background: transparent; }}
""".strip()


def aplicar_tema(app) -> None:
    """Aplica la hoja generada a la `QApplication` una sola vez (UI_DESIGN §9.2)."""
    app.setStyleSheet(qss())
