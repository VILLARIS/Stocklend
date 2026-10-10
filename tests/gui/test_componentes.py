"""Componentes base reutilizables: insignias, estados, tarjetas y tabla."""

from __future__ import annotations

from stocklend.ui.widgets.feedback import EmptyState, InlineNotice, StatCard
from stocklend.ui.widgets.inputs import SearchBar
from stocklend.ui.widgets.primitives import CountBadge
from stocklend.ui.widgets.table import DataTable


def test_count_badge_oculto_en_cero(qtbot):
    insignia = CountBadge(0)
    qtbot.addWidget(insignia)
    assert insignia.isHidden()
    insignia.set_valor(5)
    assert insignia.text() == "5"
    assert not insignia.isHidden()
    insignia.set_valor(150)
    assert insignia.text() == "99+"


def test_stat_card_actualiza_valores(qtbot):
    tarjeta = StatCard("Disponibles", "0")
    qtbot.addWidget(tarjeta)
    tarjeta.set_valores(12, apoyo="de 20")
    assert tarjeta.valor.text() == "12"
    assert tarjeta.etiqueta.text() == "Disponibles"
    assert tarjeta.apoyo.text() == "de 20"


def test_inline_notice_guarda_su_tono(qtbot):
    aviso = InlineNotice("No se pudo cargar", "error")
    qtbot.addWidget(aviso)
    assert aviso.property("tono") == "error"
    assert aviso.texto.text() == "No se pudo cargar"


def test_empty_state_emite_accion(qtbot):
    estado = EmptyState("Vacío", "Nada", "Crear")
    qtbot.addWidget(estado)
    with qtbot.waitSignal(estado.accion_pulsada, timeout=1000):
        estado.accion.click()


def test_data_table_alterna_tabla_y_vacio(qtbot):
    tabla = DataTable(["Nombre", "Total"])
    qtbot.addWidget(tabla)
    tabla.configurar_estado_vacio("Sin datos")
    assert tabla._pila.currentIndex() == 1
    tabla.set_filas([["Olla", 3]])
    assert tabla._pila.currentIndex() == 0
    assert tabla.modelo.rowCount() == 1
    tabla.set_filas([])
    assert tabla._pila.currentIndex() == 1


def test_search_bar_emite_tras_el_retardo(qtbot):
    buscador = SearchBar()
    qtbot.addWidget(buscador)
    with qtbot.waitSignal(buscador.busqueda_cambiada, timeout=1500) as senal:
        buscador.setText("olla")
    assert senal.args == ["olla"]
