"""Páginas del armazón: listados reales, estados vacíos y páginas provisionales."""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QLabel

from stocklend.ui.pages import PaginaProvisional
from stocklend.ui.pages.inventario import COLUMNAS as COLUMNAS_INVENTARIO
from stocklend.ui.widgets.feedback import EmptyState


def test_inventario_muestra_estado_vacio(ventana):
    pagina = ventana.paginas["inventario"]
    assert pagina.tabla._pila.currentIndex() == 1
    vacio = pagina.tabla.vacio
    assert "artículos" in vacio.titulo.text().lower()
    assert vacio.accion.text() == "Registrar el primero"


def test_inventario_lista_datos_reales(ventana, servicios):
    categoria = servicios.inventario.registrar_categoria("Utensilios")
    servicios.inventario.registrar_articulo(
        "Olla", categoria.id, cantidad_inicial=3
    )
    pagina = ventana.paginas["inventario"]
    pagina.cargar()

    assert pagina.tabla._pila.currentIndex() == 0
    modelo = pagina.tabla.modelo
    assert modelo.rowCount() == 1
    fila = modelo.fila(0)
    assert fila[0] == "Olla"
    assert fila[2] == "Utensilios"
    assert fila[3] == 3
    columnas = [
        modelo.headerData(i, Qt.Orientation.Horizontal)
        for i in range(len(COLUMNAS_INVENTARIO))
    ]
    assert columnas == COLUMNAS_INVENTARIO


def test_inventario_busqueda_deja_estado_vacio(ventana, servicios):
    categoria = servicios.inventario.registrar_categoria("Utensilios")
    servicios.inventario.registrar_articulo("Olla", categoria.id, cantidad_inicial=1)
    pagina = ventana.paginas["inventario"]
    pagina.cargar()

    pagina._cambiar_termino("inexistente")
    assert pagina.tabla.modelo.rowCount() == 0
    assert pagina.tabla._pila.currentIndex() == 1

    pagina._cambiar_termino("")
    assert pagina.tabla.modelo.rowCount() == 1


def test_panel_de_detalle_muestra_la_fila(ventana, servicios):
    categoria = servicios.inventario.registrar_categoria("Utensilios")
    servicios.inventario.registrar_articulo("Olla", categoria.id, cantidad_inicial=2)
    pagina = ventana.paginas["inventario"]
    pagina.cargar()

    pagina._mostrar_detalle(0)
    textos = [etiqueta.text() for etiqueta in pagina.detalle.findChildren(QLabel)]
    assert "Olla" in textos
    assert "Utensilios" in textos


def test_listados_muestran_estado_vacio_con_base_vacia(ventana):
    for clave in ("estudiantes", "prestamos", "devoluciones", "incidentes"):
        pagina = ventana.paginas[clave]
        assert pagina.tabla._pila.currentIndex() == 1, clave


def test_estudiantes_lista_datos_reales(ventana, servicios):
    servicios.estudiantes.registrar_estudiante("U100", "Ana", "Pérez")
    pagina = ventana.paginas["estudiantes"]
    pagina.cargar()
    assert pagina.tabla.modelo.rowCount() == 1
    fila = pagina.tabla.modelo.fila(0)
    assert fila[0] == "U100"
    assert fila[4] == "Activo"


def test_paginas_provisionales_avisan_de_su_etapa(ventana):
    esperado = {
        "dashboard": "Etapa 7",
        "reportes": "Etapa 7",
        "respaldo": "Etapa 8",
    }
    for clave, etapa in esperado.items():
        pagina = ventana.paginas[clave]
        assert isinstance(pagina, PaginaProvisional), clave
        estado = pagina.findChild(EmptyState)
        assert estado is not None
        assert etapa in estado.explicacion.text()
        assert "pendiente" in estado.titulo.text().lower()
        assert estado.icono.pixmap() is not None


def test_estados_vacios_de_listado_llevan_icono(ventana):
    for clave in ("inventario", "estudiantes", "prestamos", "devoluciones", "incidentes"):
        pagina = ventana.paginas[clave]
        assert pagina.tabla._pila.currentIndex() == 1, clave
        assert pagina.tabla.vacio.icono.pixmap() is not None, clave


def test_detalle_oculto_sin_seleccion(ventana, servicios):
    categoria = servicios.inventario.registrar_categoria("Utensilios")
    servicios.inventario.registrar_articulo("Olla", categoria.id, cantidad_inicial=1)
    ventana.ir_a("inventario")
    pagina = ventana.paginas["inventario"]
    pagina.cargar()
    assert pagina.detalle.isHidden()

    pagina.tabla.tabla.selectRow(0)
    assert not pagina.detalle.isHidden()
    assert pagina.detalle.boton_cerrar.isHidden() is False

    pagina.detalle.boton_cerrar.click()
    assert pagina.detalle.isHidden()

    pagina.tabla.tabla.selectRow(0)
    assert not pagina.detalle.isHidden()
    pagina.cargar()
    assert pagina.detalle.isHidden()


def test_buscador_ancho_util(ventana):
    for clave in ("inventario", "estudiantes", "prestamos", "incidentes"):
        paginas_con_buscador = ventana.paginas[clave]
        assert paginas_con_buscador.buscador.minimumWidth() >= 260
        assert paginas_con_buscador.buscador.maximumWidth() >= 400


def test_cada_pagina_tiene_cabecera(ventana):
    for clave, pagina in ventana.paginas.items():
        assert pagina.cabecera.titulo.text(), clave


# ------------------------------------------------------------- rediseño Inventario


def test_inventario_tarjetas_muestran_agregados_reales(ventana, servicios):
    categoria = servicios.inventario.registrar_categoria("Utensilios")
    servicios.inventario.registrar_articulo("Olla", categoria.id, cantidad_inicial=5)
    pagina = ventana.paginas["inventario"]
    pagina.cargar()

    assert pagina.tarjeta_articulos.valor.text() == "1"
    assert pagina.tarjeta_unidades.valor.text() == "5"
    assert pagina.tarjeta_disponibles.valor.text() == "5"
    assert pagina.tarjeta_prestadas.valor.text() == "0"


def test_inventario_tarjetas_se_actualizan_tras_alta(ventana, servicios):
    pagina = ventana.paginas["inventario"]
    pagina.cargar()
    assert pagina.tarjeta_articulos.valor.text() == "0"

    categoria = servicios.inventario.registrar_categoria("Utensilios")
    servicios.inventario.registrar_articulo("Olla", categoria.id, cantidad_inicial=2)
    pagina.cargar()
    assert pagina.tarjeta_articulos.valor.text() == "1"
    assert pagina.tarjeta_unidades.valor.text() == "2"
    assert pagina.tarjeta_disponibles.valor.text() == "2"


def test_inventario_estado_prestable_y_no_prestable(ventana, servicios):
    categoria = servicios.inventario.registrar_categoria("Utensilios")
    servicios.inventario.registrar_articulo("Olla", categoria.id, cantidad_inicial=1)
    servicios.inventario.registrar_articulo(
        "Candado", categoria.id, cantidad_inicial=1, prestable=False
    )
    pagina = ventana.paginas["inventario"]
    pagina.cargar()

    modelo = pagina.tabla.modelo
    estados = {modelo.fila(i)[0]: modelo.fila(i)[8] for i in range(modelo.rowCount())}
    assert estados["Olla"] == "Prestable"
    assert estados["Candado"] == "No prestable"
    ultima = len(COLUMNAS_INVENTARIO) - 1
    assert modelo.headerData(ultima, Qt.Orientation.Horizontal) == "Acciones"


def test_inventario_acciones_fila_disponibles(ventana, servicios):
    categoria = servicios.inventario.registrar_categoria("Utensilios")
    servicios.inventario.registrar_articulo("Olla", categoria.id, cantidad_inicial=1)
    pagina = ventana.paginas["inventario"]
    pagina.cargar()
    textos = [accion[0] for accion in pagina._acciones_fila(0)]
    assert "Editar artículo" in textos
    assert "Ajustar existencias" in textos
    assert "Registrar incidente" in textos


def test_inventario_pestanas_llevan_icono(ventana):
    pagina = ventana.paginas["inventario"]
    assert pagina.pestanas.count() == 3
    assert [pagina.pestanas.tabText(i) for i in range(3)] == [
        "Artículos",
        "Unidades",
        "Categorías",
    ]
    for indice in range(3):
        assert not pagina.pestanas.tabIcon(indice).isNull(), indice


def test_inventario_filtro_categoria_segun_pestana(ventana):
    pagina = ventana.paginas["inventario"]
    assert pagina.filtro_categoria.isHidden() is False
    pagina.pestanas.setCurrentIndex(1)
    assert pagina.filtro_categoria.isHidden() is True
    pagina.pestanas.setCurrentIndex(2)
    assert pagina.alta_categoria.isHidden() is False
    pagina.pestanas.setCurrentIndex(0)
    assert pagina.alta_categoria.isHidden() is True


def test_fila_estadisticas_se_reorganiza(ventana):
    fila = ventana.paginas["inventario"].fila_estadisticas
    fila._reorganizar(fila._calcular_columnas(1000))
    assert fila._columnas == 4
    fila._reorganizar(fila._calcular_columnas(500))
    assert fila._columnas == 2


def test_inventario_responsive_sin_errores(ventana, servicios):
    categoria = servicios.inventario.registrar_categoria("Utensilios")
    servicios.inventario.registrar_articulo("Olla", categoria.id, cantidad_inicial=3)
    pagina = ventana.paginas["inventario"]
    for ancho, alto in ((1360, 840), (1024, 640)):
        ventana.resize(ancho, alto)
        pagina.cargar()
        assert pagina.tabla.modelo.rowCount() == 1
