"""Pruebas de los diálogos de operación de la Etapa 6 (RNF-01, RNF-02, RF-*).

Cada prueba construye el diálogo real, manipula sus campos como lo haría Sonia y
llama a `enviar()` (o a `guardar()`) para comprobar el efecto **real** sobre la base
SQLite temporal. Donde el diálogo pide una confirmación modal se sustituye
`confirmar` por una respuesta fija.
"""

from __future__ import annotations

from stocklend.domain.enums import EstadoIncidente, EstadoPrestamo, EstadoUnidad
from stocklend.services import LineaDevolucion
from stocklend.ui.dialogs.confirm import ConfirmDialog
from stocklend.ui.dialogs.devolucion import DevolucionDialog
from stocklend.ui.dialogs.estudiante import EstudianteDialog, FichaEstudianteDialog
from stocklend.ui.dialogs.incidente import (
    AsignarResponsabilidadDialog,
    DetalleIncidenteDialog,
    IncidenteDialog,
    ResolverIncidenteDialog,
)
from stocklend.ui.dialogs.inventario import (
    AjusteDialog,
    ArticuloDialog,
    CategoriaDialog,
    UnidadEditarDialog,
    UnidadEstadoDialog,
)
from stocklend.ui.dialogs.prestamo import DetallePrestamoDialog, NuevoPrestamoDialog

# --------------------------------------------------------------------- ayudas


def _categoria(servicios, nombre="Utensilios"):
    return servicios.inventario.registrar_categoria(nombre)


def _articulo(servicios, categoria_id, nombre="Olla", cantidad=5, control=False):
    return servicios.inventario.registrar_articulo(
        nombre,
        categoria_id,
        cantidad_inicial=0 if control else cantidad,
        control_individual=control,
    )


def _estudiante(servicios, codigo="U100", nombres="Ana", apellidos="Pérez"):
    return servicios.estudiantes.registrar_estudiante(codigo, nombres, apellidos)


def _prestamo(servicios, estudiante_id, articulo_id, cantidad=1):
    from stocklend.services import LineaPrestamo

    return servicios.prestamos.registrar_prestamo(
        estudiante_id, [LineaPrestamo(articulo_id, cantidad=cantidad)]
    )


# ------------------------------------------------------------------ inventario


def test_articulo_dialog_alta_stock(qtbot, servicios):
    categoria = _categoria(servicios)
    dialogo = ArticuloDialog(servicios.inventario, servicios.unidades, [categoria])
    qtbot.addWidget(dialogo)
    dialogo.nombre.setText("Olla grande")
    dialogo.cantidad_inicial.set_valor(3)
    assert dialogo.enviar() is True
    articulos = servicios.inventario.listar_articulos(limite=10)
    assert len(articulos) == 1
    assert articulos[0].nombre == "Olla grande"
    assert articulos[0].cantidad_disponible == 3


def test_articulo_dialog_alta_control_individual_crea_unidades(qtbot, servicios):
    categoria = _categoria(servicios)
    dialogo = ArticuloDialog(servicios.inventario, servicios.unidades, [categoria])
    qtbot.addWidget(dialogo)
    dialogo.nombre.setText("Laptop")
    dialogo.control_individual.setChecked(True)
    dialogo.codigos_unidad.set_texto("LAP-1\nLAP-2")
    assert dialogo.enviar() is True
    articulo = servicios.inventario.listar_articulos(limite=10)[0]
    assert articulo.control_individual is True
    unidades = servicios.unidades.listar_por_articulo(articulo.id, limite=10)
    assert {u.codigo for u in unidades} == {"LAP-1", "LAP-2"}


def test_articulo_dialog_edicion_no_toca_cantidades(qtbot, servicios):
    categoria = _categoria(servicios)
    original = _articulo(servicios, categoria.id, cantidad=4)
    dialogo = ArticuloDialog(
        servicios.inventario, servicios.unidades, [categoria], articulo=original
    )
    qtbot.addWidget(dialogo)
    dialogo.nombre.setText("Olla renombrada")
    assert dialogo.enviar() is True
    actualizado = servicios.inventario.obtener_articulo(original.id)
    assert actualizado.nombre == "Olla renombrada"
    assert actualizado.cantidad_total == 4


def test_articulo_dialog_exige_nombre(qtbot, servicios):
    categoria = _categoria(servicios)
    dialogo = ArticuloDialog(servicios.inventario, servicios.unidades, [categoria])
    qtbot.addWidget(dialogo)
    assert dialogo.enviar() is False
    assert servicios.inventario.listar_articulos(limite=10) == []


def test_ajuste_dialog_registra_movimiento(qtbot, servicios, monkeypatch):
    monkeypatch.setattr("stocklend.ui.dialogs.inventario.confirmar", lambda *a, **k: True)
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)
    dialogo = AjusteDialog(servicios.inventario, articulo)
    qtbot.addWidget(dialogo)
    dialogo.entrada.set_valor(7)
    dialogo.motivo.set_texto("Recuento físico")
    assert dialogo.enviar() is True
    assert servicios.inventario.obtener_articulo(articulo.id).cantidad_total == 7


def test_ajuste_dialog_rechaza_bajar_de_lo_prestado(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=3)
    persona = _estudiante(servicios)
    _prestamo(servicios, persona.id, articulo.id, cantidad=2)
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert articulo.cantidad_prestada == 2
    dialogo = AjusteDialog(servicios.inventario, articulo)
    qtbot.addWidget(dialogo)
    dialogo.entrada.set_valor(1)
    errores = dialogo.validar()
    assert any("prestada" in mensaje for _campo, mensaje in errores)
    dialogo.motivo.set_texto("Intento inválido")
    assert dialogo.enviar() is False
    assert servicios.inventario.obtener_articulo(articulo.id).cantidad_total == 3


def test_ajuste_dialog_motivo_obligatorio(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)
    dialogo = AjusteDialog(servicios.inventario, articulo)
    qtbot.addWidget(dialogo)
    dialogo.entrada.set_valor(5)
    assert dialogo.enviar() is False
    assert servicios.inventario.obtener_articulo(articulo.id).cantidad_total == 2


def test_categoria_dialog_alta_y_edicion(qtbot, servicios):
    dialogo = CategoriaDialog(servicios.inventario)
    qtbot.addWidget(dialogo)
    dialogo.nombre.setText("Cristalería")
    assert dialogo.enviar() is True
    creada = dialogo.resultado
    edicion = CategoriaDialog(servicios.inventario, categoria=creada)
    qtbot.addWidget(edicion)
    edicion.nombre.setText("Cristalería fina")
    assert edicion.enviar() is True
    nombres = {c.nombre for c in servicios.inventario.listar_categorias()}
    assert "Cristalería fina" in nombres


def test_unidad_estado_dialog_cambia_estado(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, control=True)
    unidad = servicios.unidades.registrar_unidades(articulo.id, ["U-1"])[0]
    dialogo = UnidadEstadoDialog(servicios.unidades, unidad)
    qtbot.addWidget(dialogo)
    dialogo.destino.setCurrentIndex(0)
    dialogo.motivo.set_texto("Se golpeó")
    assert dialogo.enviar() is True
    actual = servicios.unidades.listar_por_articulo(articulo.id, limite=10)[0]
    assert actual.estado is EstadoUnidad.DANADA


def test_unidad_editar_dialog_corrige_codigo(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, control=True)
    unidad = servicios.unidades.registrar_unidades(articulo.id, ["U-1"])[0]
    dialogo = UnidadEditarDialog(servicios.unidades, unidad)
    qtbot.addWidget(dialogo)
    dialogo.codigo.setText("U-9")
    assert dialogo.enviar() is True
    actual = servicios.unidades.listar_por_articulo(articulo.id, limite=10)[0]
    assert actual.codigo == "U-9"


# ----------------------------------------------------------------- estudiantes


def test_estudiante_dialog_alta_y_edicion(qtbot, servicios):
    dialogo = EstudianteDialog(servicios.estudiantes)
    qtbot.addWidget(dialogo)
    dialogo.codigo.setText("U200")
    dialogo.nombres.setText("Luis")
    dialogo.apellidos.setText("Gómez")
    assert dialogo.enviar() is True
    edicion = EstudianteDialog(servicios.estudiantes, estudiante=dialogo.resultado)
    qtbot.addWidget(edicion)
    edicion.nombres.setText("Luis Alberto")
    assert edicion.enviar() is True
    personas = servicios.estudiantes.listar_estudiantes(limite=10)
    assert personas[0].nombres == "Luis Alberto"


def test_ficha_estudiante_muestra_historial(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=1)
    persona = _estudiante(servicios)
    _prestamo(servicios, persona.id, articulo.id)
    dialogo = FichaEstudianteDialog(servicios.estudiantes, servicios.prestamos, persona)
    qtbot.addWidget(dialogo)
    assert dialogo.lista.count() == 1


# ------------------------------------------------------------------- préstamos


def test_nuevo_prestamo_completo_desde_interfaz(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=5)
    persona = _estudiante(servicios)
    dialogo = NuevoPrestamoDialog(
        servicios.prestamos, servicios.estudiantes, servicios.inventario, servicios.unidades
    )
    qtbot.addWidget(dialogo)
    dialogo.buscador_estudiante.set_datos([("Ana", persona)])
    dialogo.buscador_estudiante.seleccionar_dato(persona)
    dialogo.buscador_articulo.set_datos([("Olla", articulo)])
    dialogo.buscador_articulo.seleccionar_dato(articulo)
    dialogo._agregar_seleccionado()
    assert len(dialogo._lineas) == 1
    dialogo._lineas[0].entrada_cantidad.set_valor(2)
    assert dialogo.enviar() is True
    assert dialogo.resultado is not None
    assert servicios.inventario.obtener_articulo(articulo.id).cantidad_prestada == 2


def test_nuevo_prestamo_control_individual_elige_unidad(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, control=True)
    servicios.unidades.registrar_unidades(articulo.id, ["LAP-1", "LAP-2"])
    persona = _estudiante(servicios)
    dialogo = NuevoPrestamoDialog(
        servicios.prestamos, servicios.estudiantes, servicios.inventario, servicios.unidades
    )
    qtbot.addWidget(dialogo)
    dialogo.buscador_estudiante.set_datos([("Ana", persona)])
    dialogo.buscador_estudiante.seleccionar_dato(persona)
    dialogo.buscador_articulo.set_datos([("Laptop", articulo)])
    dialogo.buscador_articulo.seleccionar_dato(articulo)
    dialogo._agregar_seleccionado()
    combo = dialogo._lineas[0].combo_unidades
    assert combo.count() == 2
    combo.setCurrentIndex(0)
    assert dialogo.enviar() is True
    prestadas = [
        u
        for u in servicios.unidades.listar_por_articulo(articulo.id, limite=10)
        if u.estado is EstadoUnidad.PRESTADA
    ]
    assert len(prestadas) == 1


def test_nuevo_prestamo_rechaza_estudiante_inactivo(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)
    persona = _estudiante(servicios)
    servicios.estudiantes.inactivar_estudiante(persona.id)
    persona = servicios.estudiantes.obtener_estudiante(persona.id)
    dialogo = NuevoPrestamoDialog(
        servicios.prestamos, servicios.estudiantes, servicios.inventario, servicios.unidades
    )
    qtbot.addWidget(dialogo)
    dialogo.buscador_estudiante.set_datos([("Ana", persona)])
    dialogo.buscador_estudiante.seleccionar_dato(persona)
    dialogo.buscador_articulo.set_datos([("Olla", articulo)])
    dialogo.buscador_articulo.seleccionar_dato(articulo)
    dialogo._agregar_seleccionado()
    dialogo._continuar()
    assert dialogo._pasos.currentIndex() == 0
    assert "inactivo" in dialogo._error.texto.text().lower()


def test_nuevo_prestamo_avisa_articulo_repetido(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=5)
    dialogo = NuevoPrestamoDialog(
        servicios.prestamos, servicios.estudiantes, servicios.inventario, servicios.unidades
    )
    qtbot.addWidget(dialogo)
    dialogo.buscador_articulo.set_datos([("Olla", articulo)])
    dialogo.buscador_articulo.seleccionar_dato(articulo)
    dialogo._agregar_seleccionado()
    dialogo.buscador_articulo.set_datos([("Olla", articulo)])
    dialogo.buscador_articulo.seleccionar_dato(articulo)
    dialogo._agregar_seleccionado()
    assert len(dialogo._lineas) == 1
    assert "ya está" in dialogo._aviso_repetido.texto.text()


def test_nuevo_prestamo_tope_visible_no_excede(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)
    dialogo = NuevoPrestamoDialog(
        servicios.prestamos, servicios.estudiantes, servicios.inventario, servicios.unidades
    )
    qtbot.addWidget(dialogo)
    dialogo.buscador_articulo.set_datos([("Olla", articulo)])
    dialogo.buscador_articulo.seleccionar_dato(articulo)
    dialogo._agregar_seleccionado()
    entrada = dialogo._lineas[0].entrada_cantidad
    assert entrada.tope.text() == "Máximo 2"
    entrada.set_valor(99)
    assert entrada.valor() == 2


# ----------------------------------------------------------------- devoluciones


def test_devolucion_parcial_actualiza_pendiente(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)
    persona = _estudiante(servicios)
    prestamo = _prestamo(servicios, persona.id, articulo.id, cantidad=2)
    dialogo = DevolucionDialog(
        servicios.devoluciones,
        servicios.prestamos,
        servicios.estudiantes,
        servicios.inventario,
        servicios.unidades,
        prestamo_inicial=prestamo,
    )
    qtbot.addWidget(dialogo)
    dialogo._renglones[0].entradas[0].set_valor(1)
    assert dialogo.enviar() is True
    estado = servicios.prestamos.obtener_prestamo(prestamo.id)
    assert estado.estado is EstadoPrestamo.ACTIVO
    detalle = servicios.prestamos.detalles(prestamo.id)[0]
    assert detalle.cantidad_pendiente == 1


def test_devolucion_con_dano_crea_incidente(qtbot, servicios, monkeypatch):
    monkeypatch.setattr("stocklend.ui.dialogs.devolucion.confirmar", lambda *a, **k: True)
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=1)
    persona = _estudiante(servicios)
    prestamo = _prestamo(servicios, persona.id, articulo.id, cantidad=1)
    dialogo = DevolucionDialog(
        servicios.devoluciones,
        servicios.prestamos,
        servicios.estudiantes,
        servicios.inventario,
        servicios.unidades,
        prestamo_inicial=prestamo,
    )
    qtbot.addWidget(dialogo)
    dialogo._renglones[0].entradas[1].set_valor(1)
    dialogo.descripcion.set_texto("Se cayó y se rompió")
    assert dialogo.enviar() is True
    incidentes = servicios.incidentes.listar_incidentes(limite=10)
    assert len(incidentes) == 1
    assert incidentes[0].origen.value == "devolucion"
    assert incidentes[0].estado is EstadoIncidente.ABIERTO


def test_devolucion_completa_cierra_prestamo(qtbot, servicios, monkeypatch):
    monkeypatch.setattr("stocklend.ui.dialogs.devolucion.confirmar", lambda *a, **k: True)
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=1)
    persona = _estudiante(servicios)
    prestamo = _prestamo(servicios, persona.id, articulo.id, cantidad=1)
    dialogo = DevolucionDialog(
        servicios.devoluciones,
        servicios.prestamos,
        servicios.estudiantes,
        servicios.inventario,
        servicios.unidades,
        prestamo_inicial=prestamo,
    )
    qtbot.addWidget(dialogo)
    dialogo._renglones[0].entradas[0].set_valor(1)
    assert dialogo.enviar() is True
    cerrado = servicios.prestamos.obtener_prestamo(prestamo.id)
    assert cerrado.estado is EstadoPrestamo.CERRADO
    assert servicios.inventario.obtener_articulo(articulo.id).cantidad_disponible == 1


def test_devolucion_dano_exige_descripcion(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=1)
    persona = _estudiante(servicios)
    prestamo = _prestamo(servicios, persona.id, articulo.id, cantidad=1)
    dialogo = DevolucionDialog(
        servicios.devoluciones,
        servicios.prestamos,
        servicios.estudiantes,
        servicios.inventario,
        servicios.unidades,
        prestamo_inicial=prestamo,
    )
    qtbot.addWidget(dialogo)
    dialogo._renglones[0].entradas[1].set_valor(1)
    assert dialogo.enviar() is False
    assert "descripción" in dialogo._error.texto.text().lower()


# ------------------------------------------------------------------ incidentes


def test_incidente_dialog_stock(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=3)
    dialogo = IncidenteDialog(
        servicios.incidentes,
        servicios.inventario,
        servicios.estudiantes,
        servicios.prestamos,
        servicios.unidades,
    )
    qtbot.addWidget(dialogo)
    dialogo._articulo_selector(articulo)
    dialogo.descripcion.set_texto("Se rompió una al lavarla")
    assert dialogo.enviar() is True
    incidentes = servicios.incidentes.listar_incidentes(limite=10)
    assert len(incidentes) == 1
    assert incidentes[0].origen.value == "stock"
    assert incidentes[0].estudiante_id is None
    assert incidentes[0].responsabilidad.value == "sin_determinar"


def test_incidente_dialog_exige_descripcion(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=3)
    dialogo = IncidenteDialog(
        servicios.incidentes,
        servicios.inventario,
        servicios.estudiantes,
        servicios.prestamos,
        servicios.unidades,
    )
    qtbot.addWidget(dialogo)
    dialogo._articulo_selector(articulo)
    assert dialogo.enviar() is False
    assert servicios.incidentes.listar_incidentes(limite=10) == []


def test_resolver_incidente_dialog(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)
    incidente = servicios.incidentes.registrar_incidente(
        articulo.id, "danio", "stock", 1, "Se agrietó"
    )
    dialogo = ResolverIncidenteDialog(servicios.incidentes, incidente)
    qtbot.addWidget(dialogo)
    dialogo.resolucion.set_texto("Se reemplazó la pieza")
    assert dialogo.enviar() is True
    actualizado = servicios.incidentes.obtener_incidente(incidente.id)
    assert actualizado.estado is EstadoIncidente.RESUELTO


def test_asignar_responsabilidad_dialog(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)
    persona = _estudiante(servicios)
    incidente = servicios.incidentes.registrar_incidente(
        articulo.id, "perdida", "stock", 1, "Desapareció"
    )
    dialogo = AsignarResponsabilidadDialog(servicios.incidentes, servicios.estudiantes, incidente)
    qtbot.addWidget(dialogo)
    dialogo.buscador_estudiante.set_datos([("Ana", persona)])
    dialogo.buscador_estudiante.seleccionar_dato(persona)
    dialogo.motivo.set_texto("La tenía bajo su cargo")
    assert dialogo.enviar() is True
    actualizado = servicios.incidentes.obtener_incidente(incidente.id)
    assert actualizado.estudiante_id == persona.id


def test_detalle_prestamo_e_incidente_se_construyen(qtbot, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)
    persona = _estudiante(servicios)
    prestamo = _prestamo(servicios, persona.id, articulo.id, cantidad=1)
    detalle = DetallePrestamoDialog(
        servicios.prestamos, servicios.estudiantes, servicios.inventario, prestamo
    )
    qtbot.addWidget(detalle)
    assert detalle.lista.count() == 1
    incidente = servicios.incidentes.registrar_incidente(
        articulo.id, "danio", "stock", 1, "Golpe"
    )
    ficha = DetalleIncidenteDialog(servicios.incidentes, servicios.inventario, incidente)
    qtbot.addWidget(ficha)
    assert ficha.windowTitle().startswith("Incidente #")


def test_confirm_dialog_palabra_de_seguridad(qtbot):
    dialogo = ConfirmDialog("Anular", "Escribe la palabra", palabra_confirmacion="ANULAR")
    qtbot.addWidget(dialogo)
    assert dialogo.boton_accion.isEnabled() is False
    dialogo.confirmacion.setText("anular")
    assert dialogo.boton_accion.isEnabled() is True


# ------------------------------------------------------------------- páginas


def test_pagina_prestamos_desactiva_devolver_en_cerrado(ventana, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=1)
    persona = _estudiante(servicios)
    prestamo = _prestamo(servicios, persona.id, articulo.id, cantidad=1)
    detalle = servicios.prestamos.detalles(prestamo.id)[0]
    servicios.devoluciones.registrar_devolucion(
        prestamo.id, [LineaDevolucion(prestamo_detalle_id=detalle.id, cantidad_devuelta=1)]
    )
    pagina = ventana.paginas["prestamos"]
    pagina.cargar()
    acciones = pagina._acciones_fila(0)
    devolver = next(accion for accion in acciones if accion[0] == "Registrar devolución")
    assert devolver[2] is False


def test_pagina_devoluciones_sin_activos_muestra_vacio(ventana, servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=1)
    persona = _estudiante(servicios)
    prestamo = _prestamo(servicios, persona.id, articulo.id, cantidad=1)
    detalle = servicios.prestamos.detalles(prestamo.id)[0]
    servicios.devoluciones.registrar_devolucion(
        prestamo.id, [LineaDevolucion(prestamo_detalle_id=detalle.id, cantidad_devuelta=1)]
    )
    pagina = ventana.paginas["devoluciones"]
    pagina.cargar()
    assert pagina.tabla._pila.currentIndex() == 1
