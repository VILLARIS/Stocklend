"""Ventana mínima de arranque de la Etapa 1: se construye, se muestra y se cierra."""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QLabel, QPushButton

from stocklend.app import crear_ventana


def test_ventana_muestra_el_resumen_y_se_cierra(qtbot):
    resumen = "StockLend 0.1.0 · base lista · esquema user_version=1 · foreign_keys=1"
    ventana = crear_ventana(resumen)
    qtbot.addWidget(ventana)
    ventana.show()

    assert ventana.isVisible()
    etiquetas = [hijo for hijo in ventana.findChildren(QLabel) if hijo.text() == resumen]
    assert etiquetas, "la ventana debe mostrar el resumen del estado de la base"

    boton = ventana.findChild(QPushButton)
    assert boton is not None and boton.text() == "Cerrar"
    qtbot.mouseClick(boton, Qt.MouseButton.LeftButton)
    assert not ventana.isVisible()
