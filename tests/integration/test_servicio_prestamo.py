"""Préstamos: alta atómica, folio, control individual y anulación (RN-16 a RN-25)."""

from __future__ import annotations

import pytest
from _reconciliacion import discrepancias_contadores, discrepancias_unidades

from stocklend.domain import (
    CantidadInsuficienteError,
    EstadoDetalle,
    EstadoPrestamo,
    EstadoUnidad,
    NoEncontradoError,
    ReglaNegocioError,
    TipoMovimiento,
    ValidacionError,
)
from stocklend.services.prestamo_service import LineaPrestamo


def _categoria(servicios, nombre="Equipos"):
    return servicios.inventario.registrar_categoria(nombre)


def _articulo(servicios, categoria_id, nombre="Calculadora", cantidad=10, **kw):
    return servicios.inventario.registrar_articulo(
        nombre, categoria_id, cantidad_inicial=cantidad, **kw
    )


def _estudiante(servicios, codigo="2020001", nombres="Ana", apellidos="Pérez"):
    return servicios.estudiantes.registrar_estudiante(codigo, nombres, apellidos)


def _articulo_individual(servicios, categoria_id, nombre="Proyector"):
    return servicios.inventario.registrar_articulo(
        nombre, categoria_id, control_individual=True
    )


def test_prestamo_simple_descuenta_y_deja_pendiente(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=5)
    estudiante = _estudiante(servicios)

    prestamo = servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 2)])

    assert prestamo.estado is EstadoPrestamo.ACTIVO
    assert prestamo.folio.startswith("PRE-")
    assert prestamo.folio.endswith("000001")
    assert prestamo.fecha_limite is None
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_total, articulo.cantidad_disponible, articulo.cantidad_prestada) == (
        5,
        3,
        2,
    )
    detalles = servicios.prestamos.detalles(prestamo.id)
    assert len(detalles) == 1
    assert detalles[0].cantidad_pendiente == 2
    assert detalles[0].estado is EstadoDetalle.PENDIENTE
    assert discrepancias_contadores(conn_migrada) == []
    assert discrepancias_unidades(conn_migrada) == []


def test_prestamo_multiple_es_todo_o_nada(servicios, conn_migrada):
    categoria = _categoria(servicios)
    primera = _articulo(servicios, categoria.id, nombre="Calculadora", cantidad=5)
    segunda = _articulo(servicios, categoria.id, nombre="Tablero", cantidad=2)
    estudiante = _estudiante(servicios)

    prestamo = servicios.prestamos.registrar_prestamo(
        estudiante.id, [(primera.id, 2), (segunda.id, 1)]
    )
    detalles = servicios.prestamos.detalles(prestamo.id)
    assert [detalle.cantidad_prestada for detalle in detalles] == [2, 1]
    primera = servicios.inventario.obtener_articulo(primera.id)
    segunda = servicios.inventario.obtener_articulo(segunda.id)
    assert (primera.cantidad_disponible, primera.cantidad_prestada) == (3, 2)
    assert (segunda.cantidad_disponible, segunda.cantidad_prestada) == (1, 1)
    assert discrepancias_contadores(conn_migrada) == []


def test_stock_insuficiente_no_registra_nada(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=3)
    estudiante = _estudiante(servicios)

    with pytest.raises(CantidadInsuficienteError):
        servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 4)])

    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_disponible, articulo.cantidad_prestada) == (3, 0)
    assert servicios.prestamos.listar_prestamos() == []
    assert discrepancias_contadores(conn_migrada) == []


def test_una_linea_invalida_deshace_todo_el_prestamo(servicios, conn_migrada):
    categoria = _categoria(servicios)
    primera = _articulo(servicios, categoria.id, nombre="Calculadora", cantidad=5)
    segunda = _articulo(servicios, categoria.id, nombre="Tablero", cantidad=1)
    estudiante = _estudiante(servicios)

    with pytest.raises(CantidadInsuficienteError):
        servicios.prestamos.registrar_prestamo(
            estudiante.id, [(primera.id, 2), (segunda.id, 9)]
        )

    primera = servicios.inventario.obtener_articulo(primera.id)
    assert (primera.cantidad_disponible, primera.cantidad_prestada) == (5, 0)
    assert servicios.prestamos.listar_prestamos() == []
    assert discrepancias_contadores(conn_migrada) == []


def test_cantidad_cero_o_negativa_se_rechaza(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id)
    estudiante = _estudiante(servicios)

    for cantidad in (0, -1):
        with pytest.raises(ValidacionError):  # RN-17
            servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, cantidad)])
    with pytest.raises(ReglaNegocioError):  # lista vacía (RN-17)
        servicios.prestamos.registrar_prestamo(estudiante.id, [])


def test_agrupa_el_mismo_articulo_suma_cantidades(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=6)
    estudiante = _estudiante(servicios)

    prestamo = servicios.prestamos.registrar_prestamo(
        estudiante.id, [(articulo.id, 1), (articulo.id, 2)]
    )
    detalles = servicios.prestamos.detalles(prestamo.id)
    assert len(detalles) == 1  # RN-18
    assert detalles[0].cantidad_prestada == 3
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_disponible, articulo.cantidad_prestada) == (3, 3)
    assert discrepancias_contadores(conn_migrada) == []


def test_no_se_presta_articulo_no_prestable(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, nombre="Mesa", cantidad=2, prestable=False)
    estudiante = _estudiante(servicios)

    with pytest.raises(ReglaNegocioError):
        servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 1)])


def test_no_se_presta_a_estudiante_inactivo(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id)
    estudiante = _estudiante(servicios)
    servicios.estudiantes.editar_estudiante(estudiante.id, activo=False)

    with pytest.raises(ReglaNegocioError):
        servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 1)])


def test_no_se_presta_a_estudiante_inexistente(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id)
    with pytest.raises(NoEncontradoError):
        servicios.prestamos.registrar_prestamo(999, [(articulo.id, 1)])


def test_fecha_futura_se_rechaza(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id)
    estudiante = _estudiante(servicios)

    with pytest.raises(ReglaNegocioError):  # RN-24
        servicios.prestamos.registrar_prestamo(
            estudiante.id, [(articulo.id, 1)], fecha="2999-01-01T00:00:00"
        )


def test_folios_consecutivos(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=5)
    estudiante = _estudiante(servicios)

    primero = servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 1)])
    segundo = servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 1)])
    assert primero.folio != segundo.folio
    assert primero.folio.endswith("000001")
    assert segundo.folio.endswith("000002")
    assert servicios.prestamos.obtener_por_folio(segundo.folio).id == segundo.id


def test_control_individual_presta_unidades_concretas(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = _articulo_individual(servicios, categoria.id)
    primera = servicios.unidades.registrar_unidad(articulo.id, "PROY-01")
    segunda = servicios.unidades.registrar_unidad(articulo.id, "PROY-02")
    estudiante = _estudiante(servicios)

    prestamo = servicios.prestamos.registrar_prestamo(
        estudiante.id, [LineaPrestamo(articulo.id, unidad_ids=(primera.id, segunda.id))]
    )

    primera = servicios.unidades.obtener_unidad(primera.id)
    segunda = servicios.unidades.obtener_unidad(segunda.id)
    assert primera.estado is EstadoUnidad.PRESTADA
    assert segunda.estado is EstadoUnidad.PRESTADA
    assert primera.prestamo_detalle_id == segunda.prestamo_detalle_id is not None
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_total, articulo.cantidad_disponible, articulo.cantidad_prestada) == (
        2,
        0,
        2,
    )
    assert servicios.prestamos.detalles(prestamo.id)[0].cantidad_pendiente == 2
    assert discrepancias_contadores(conn_migrada) == []
    assert discrepancias_unidades(conn_migrada) == []


def test_control_individual_exige_unidades(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo_individual(servicios, categoria.id)
    servicios.unidades.registrar_unidad(articulo.id, "PROY-01")
    estudiante = _estudiante(servicios)

    with pytest.raises(ValidacionError):  # RN-50
        servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 1)])


def test_control_individual_no_presta_unidad_ocupada(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo_individual(servicios, categoria.id)
    primera = servicios.unidades.registrar_unidad(articulo.id, "PROY-01")
    estudiante = _estudiante(servicios)
    servicios.prestamos.registrar_prestamo(
        estudiante.id, [LineaPrestamo(articulo.id, unidad_ids=(primera.id,))]
    )
    with pytest.raises(ReglaNegocioError):
        servicios.prestamos.registrar_prestamo(
            estudiante.id, [LineaPrestamo(articulo.id, unidad_ids=(primera.id,))]
        )


def test_control_individual_no_presta_unidad_de_otro_articulo(servicios):
    categoria = _categoria(servicios)
    primero = _articulo_individual(servicios, categoria.id, nombre="Proyector")
    segundo = _articulo_individual(servicios, categoria.id, nombre="Cámara")
    unidad = servicios.unidades.registrar_unidad(segundo.id, "CAM-01")
    estudiante = _estudiante(servicios)

    with pytest.raises(ReglaNegocioError):
        servicios.prestamos.registrar_prestamo(
            estudiante.id, [LineaPrestamo(primero.id, unidad_ids=(unidad.id,))]
        )


def test_anular_prestamo_libera_el_stock(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=4)
    estudiante = _estudiante(servicios)
    prestamo = servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 3)])

    anulado = servicios.prestamos.anular_prestamo(prestamo.id, motivo="Se canceló")

    assert anulado.estado is EstadoPrestamo.ANULADO
    assert anulado.cerrado_en is not None
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_disponible, articulo.cantidad_prestada) == (4, 0)
    movimientos = servicios.inventario.listar_movimientos(articulo.id)
    ultimo = movimientos[0]
    assert ultimo.tipo is TipoMovimiento.DEVOLUCION
    assert ultimo.referencia_tipo == "anulacion"
    assert discrepancias_contadores(conn_migrada) == []

    with pytest.raises(ReglaNegocioError):  # no se anula dos veces (RN-22)
        servicios.prestamos.anular_prestamo(prestamo.id, motivo="Otra vez")


def test_anular_prestamo_con_devoluciones_se_rechaza(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)
    estudiante = _estudiante(servicios)
    prestamo = servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 2)])
    detalle = servicios.prestamos.detalles(prestamo.id)[0]
    servicios.devoluciones.registrar_devolucion(prestamo.id, [(detalle.id, 1, 0, 0)])

    with pytest.raises(ReglaNegocioError):  # RN-22
        servicios.prestamos.anular_prestamo(prestamo.id, motivo="No se puede")


def test_anular_prestamo_individual_libera_unidades(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = _articulo_individual(servicios, categoria.id)
    unidad = servicios.unidades.registrar_unidad(articulo.id, "PROY-01")
    estudiante = _estudiante(servicios)
    prestamo = servicios.prestamos.registrar_prestamo(
        estudiante.id, [LineaPrestamo(articulo.id, unidad_ids=(unidad.id,))]
    )

    servicios.prestamos.anular_prestamo(prestamo.id, motivo="Se canceló")

    unidad = servicios.unidades.obtener_unidad(unidad.id)
    assert unidad.estado is EstadoUnidad.DISPONIBLE
    assert unidad.prestamo_detalle_id is None
    assert discrepancias_unidades(conn_migrada) == []
    assert discrepancias_contadores(conn_migrada) == []


def test_obtener_prestamo_inexistente(servicios):
    with pytest.raises(NoEncontradoError):
        servicios.prestamos.obtener_prestamo(999)


def test_listar_activos_solo_con_pendiente(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=4)
    estudiante = _estudiante(servicios)
    primer = servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 2)])
    segundo = servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 2)])
    detalle = servicios.prestamos.detalles(primer.id)[0]
    servicios.devoluciones.registrar_devolucion(primer.id, [(detalle.id, 2, 0, 0)])

    activos = {prestamo.id for prestamo in servicios.prestamos.listar_activos()}
    assert segundo.id in activos
    assert primer.id not in activos  # cerrado por devolución completa
