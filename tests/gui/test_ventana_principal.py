"""Armazón de la ventana principal: estructura, navegación, atajos y estado."""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QKeySequence, QShortcut
from PySide6.QtWidgets import QLabel, QPushButton

from stocklend.core.constants import APP_NAME
from stocklend.ui.sidebar import SECCIONES


def test_estructura_del_armazon(ventana):
    assert ventana.objectName() == "ventana_principal"
    assert ventana.sidebar.objectName() == "barra_lateral"
    assert ventana.sidebar.width() == 240
    assert ventana.stack.objectName() == "contenido"

    claves = [seccion.clave for seccion in SECCIONES]
    assert list(ventana._indices) == claves
    assert ventana.stack.count() == len(claves)
    assert APP_NAME in ventana.windowTitle()


def test_tamano_inicial_y_minimo(ventana):
    assert (ventana.width(), ventana.height()) == (1360, 840)
    assert ventana.minimumWidth() == 1024
    assert ventana.minimumHeight() == 640


def test_navegacion_con_la_barra_lateral(ventana, qtbot):
    boton = ventana.sidebar.boton("prestamos")
    qtbot.mouseClick(boton, Qt.MouseButton.LeftButton)
    assert ventana.seccion_actual() == "prestamos"
    assert "Préstamos" in ventana.windowTitle()
    assert boton.property("activo") is True


def test_secciones_secundarias_navegables(ventana):
    ventana.ir_a("incidentes")
    assert ventana.seccion_actual() == "incidentes"
    ventana.ir_a("configuracion")
    assert ventana.seccion_actual() == "configuracion"


def test_seccion_desconocida_no_cambia(ventana):
    ventana.ir_a("dashboard")
    ventana.ir_a("no_existe")
    assert ventana.seccion_actual() == "dashboard"


def test_atajos_registrados(ventana):
    claves = {atajo.key().toString() for atajo in ventana.findChildren(QShortcut)}
    for esperado in ("Ctrl+1", "Ctrl+4", "Ctrl+7", "Ctrl+,", "F5"):
        assert esperado in claves


def test_atajo_cambia_de_seccion(ventana):
    for atajo in ventana.findChildren(QShortcut):
        if atajo.key() == QKeySequence("Ctrl+6"):
            atajo.activated.emit()
            break
    assert ventana.seccion_actual() == "reportes"


def test_insignias_ocultas_con_base_vacia(ventana):
    insignia_prestamos = ventana.sidebar._filas["prestamos"].insignia
    insignia_incidentes = ventana.sidebar._filas["incidentes"].insignia
    assert insignia_prestamos.isHidden()
    assert insignia_incidentes.isHidden()


def test_barra_de_estado(ventana):
    barra = ventana.statusBar()
    assert barra.objectName() == "barra_estado"
    textos = [etiqueta.text() for etiqueta in ventana.findChildren(QLabel)]
    assert any("prueba.sqlite" in texto for texto in textos)
    assert any(texto == "Listo" for texto in textos)


def test_botones_de_seccion_tienen_objectname(ventana):
    for seccion in SECCIONES:
        boton = ventana.sidebar.boton(seccion.clave)
        assert isinstance(boton, QPushButton)
        assert boton.objectName() == f"nav_{seccion.clave}"
