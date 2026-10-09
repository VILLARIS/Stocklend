"""Devoluciones e incidentes (RN-26 a RN-45, RN-54 a RN-57)."""

from __future__ import annotations

import pytest
from _reconciliacion import discrepancias_contadores, discrepancias_unidades

from stocklend.data import database
from stocklend.domain import (
    CantidadInsuficienteError,
    EstadoDetalle,
    EstadoIncidente,
    EstadoPrestamo,
    EstadoUnidad,
    NoEncontradoError,
    OrigenIncidente,
    ReglaNegocioError,
    ResponsabilidadIncidente,
    TipoIncidente,
    ValidacionError,
)
from stocklend.services.devolucion_service import LineaDevolucion
from stocklend.services.prestamo_service import LineaPrestamo


def _categoria(servicios, nombre="Equipos"):
    return servicios.inventario.registrar_categoria(nombre)


def _articulo(servicios, categoria_id, nombre="Calculadora", cantidad=10, **kw):
    return servicios.inventario.registrar_articulo(
        nombre, categoria_id, cantidad_inicial=cantidad, **kw
    )


def _articulo_individual(servicios, categoria_id, nombre="Proyector"):
    return servicios.inventario.registrar_articulo(
        nombre, categoria_id, control_individual=True
    )


def _estudiante(servicios, codigo="2020001", nombres="Ana", apellidos="Pérez"):
    return servicios.estudiantes.registrar_estudiante(codigo, nombres, apellidos)


def _prestamo_con_detalle(servicios, cantidad=3):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=cantidad)
    estudiante = _estudiante(servicios)
    prestamo = servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, cantidad)])
    detalle = servicios.prestamos.detalles(prestamo.id)[0]
    return prestamo, detalle, articulo, estudiante


# --------------------------------------------------------------- devoluciones


def test_devolucion_completa_cierra_el_prestamo(servicios, conn_migrada):
    prestamo, detalle, articulo, _ = _prestamo_con_detalle(servicios, cantidad=3)

    devolucion = servicios.devoluciones.registrar_devolucion(
        prestamo.id, [(detalle.id, 3, 0, 0)]
    )

    assert devolucion.prestamo_id == prestamo.id
    prestamo = servicios.prestamos.obtener_prestamo(prestamo.id)
    assert prestamo.estado is EstadoPrestamo.CERRADO
    assert prestamo.cerrado_en is not None
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_disponible, articulo.cantidad_prestada) == (3, 0)
    detalle = servicios.prestamos.detalles(prestamo.id)[0]
    assert detalle.cantidad_pendiente == 0
    assert detalle.estado is EstadoDetalle.DEVUELTO
    assert discrepancias_contadores(conn_migrada) == []


def test_devolucion_parcial_mantiene_activo_y_luego_cierra(servicios, conn_migrada):
    prestamo, detalle, articulo, _ = _prestamo_con_detalle(servicios, cantidad=3)

    servicios.devoluciones.registrar_devolucion(prestamo.id, [(detalle.id, 1, 0, 0)])

    prestamo = servicios.prestamos.obtener_prestamo(prestamo.id)
    assert prestamo.estado is EstadoPrestamo.ACTIVO  # RN-36
    detalle = servicios.prestamos.detalles(prestamo.id)[0]
    assert detalle.cantidad_pendiente == 2
    assert detalle.estado is EstadoDetalle.PARCIAL
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_disponible, articulo.cantidad_prestada) == (1, 2)

    servicios.devoluciones.registrar_devolucion(prestamo.id, [(detalle.id, 2, 0, 0)])
    prestamo = servicios.prestamos.obtener_prestamo(prestamo.id)
    assert prestamo.estado is EstadoPrestamo.CERRADO
    assert discrepancias_contadores(conn_migrada) == []


def test_devolucion_excesiva_no_cambia_nada(servicios, conn_migrada):
    prestamo, detalle, articulo, _ = _prestamo_con_detalle(servicios, cantidad=2)

    with pytest.raises(CantidadInsuficienteError):  # RN-27, RN-28
        servicios.devoluciones.registrar_devolucion(prestamo.id, [(detalle.id, 3, 0, 0)])

    assert servicios.devoluciones.listar_devoluciones(prestamo_id=prestamo.id) == []
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_disponible, articulo.cantidad_prestada) == (0, 2)
    assert discrepancias_contadores(conn_migrada) == []


def test_devolucion_con_danio_crea_incidente(servicios, conn_migrada):
    prestamo, detalle, articulo, _ = _prestamo_con_detalle(servicios, cantidad=2)

    servicios.devoluciones.registrar_devolucion(
        prestamo.id,
        [
            LineaDevolucion(
                detalle.id, cantidad_devuelta=1, cantidad_daniada=1, descripcion="Rayado"
            )
        ],
    )

    articulo = servicios.inventario.obtener_articulo(articulo.id)
    estado = (
        articulo.cantidad_disponible,
        articulo.cantidad_prestada,
        articulo.cantidad_daniada,
    )
    assert estado == (1, 0, 1)
    detalle = servicios.prestamos.detalles(prestamo.id)[0]
    assert detalle.estado is EstadoDetalle.CON_INCIDENTE
    assert detalle.cantidad_daniada == 1
    prestamo = servicios.prestamos.obtener_prestamo(prestamo.id)
    assert prestamo.estado is EstadoPrestamo.CERRADO
    incidentes = servicios.incidentes.listar_por_prestamo(prestamo.id)
    assert len(incidentes) == 1  # RN-33
    assert incidentes[0].origen is OrigenIncidente.DEVOLUCION
    assert incidentes[0].tipo is TipoIncidente.DANIO
    assert incidentes[0].estado is EstadoIncidente.ABIERTO
    assert incidentes[0].devolucion_id is not None
    assert discrepancias_contadores(conn_migrada) == []


def test_devolucion_con_perdida_crea_incidente(servicios, conn_migrada):
    prestamo, detalle, articulo, _ = _prestamo_con_detalle(servicios, cantidad=2)

    servicios.devoluciones.registrar_devolucion(
        prestamo.id,
        [
            LineaDevolucion(
                detalle.id, cantidad_devuelta=1, cantidad_perdida=1, descripcion="Se perdió"
            )
        ],
    )

    articulo = servicios.inventario.obtener_articulo(articulo.id)
    estado = (
        articulo.cantidad_disponible,
        articulo.cantidad_prestada,
        articulo.cantidad_faltante,
    )
    assert estado == (1, 0, 1)
    incidentes = servicios.incidentes.listar_por_prestamo(prestamo.id)
    assert [incidente.tipo for incidente in incidentes] == [TipoIncidente.PERDIDA]
    assert discrepancias_contadores(conn_migrada) == []


def test_danio_sin_descripcion_se_rechaza(servicios, conn_migrada):
    prestamo, detalle, articulo, _ = _prestamo_con_detalle(servicios, cantidad=2)

    with pytest.raises(ValidacionError):  # RN-33
        servicios.devoluciones.registrar_devolucion(prestamo.id, [(detalle.id, 0, 1, 0)])

    assert servicios.devoluciones.listar_devoluciones(prestamo_id=prestamo.id) == []
    assert servicios.incidentes.listar_incidentes() == []
    assert discrepancias_contadores(conn_migrada) == []


def test_no_se_devuelve_un_prestamo_cerrado(servicios):
    prestamo, detalle, _, _ = _prestamo_con_detalle(servicios, cantidad=1)
    servicios.devoluciones.registrar_devolucion(prestamo.id, [(detalle.id, 1, 0, 0)])

    with pytest.raises(ReglaNegocioError):  # RN-26
        servicios.devoluciones.registrar_devolucion(prestamo.id, [(detalle.id, 1, 0, 0)])


def test_no_se_devuelve_un_prestamo_anulado(servicios):
    prestamo, detalle, _, _ = _prestamo_con_detalle(servicios, cantidad=1)
    servicios.prestamos.anular_prestamo(prestamo.id, motivo="Se canceló")

    with pytest.raises(ReglaNegocioError):
        servicios.devoluciones.registrar_devolucion(prestamo.id, [(detalle.id, 1, 0, 0)])


def test_devolucion_de_renglon_ajeno_se_rechaza(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=4)
    estudiante = _estudiante(servicios)
    primero = servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 2)])
    segundo = servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 2)])
    detalle_ajeno = servicios.prestamos.detalles(segundo.id)[0]

    with pytest.raises(ReglaNegocioError):
        servicios.devoluciones.registrar_devolucion(primero.id, [(detalle_ajeno.id, 1, 0, 0)])


def test_devolucion_control_individual_libera_unidades(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = _articulo_individual(servicios, categoria.id)
    primera = servicios.unidades.registrar_unidad(articulo.id, "PROY-01")
    segunda = servicios.unidades.registrar_unidad(articulo.id, "PROY-02")
    estudiante = _estudiante(servicios)
    prestamo = servicios.prestamos.registrar_prestamo(
        estudiante.id, [LineaPrestamo(articulo.id, unidad_ids=(primera.id, segunda.id))]
    )
    detalle = servicios.prestamos.detalles(prestamo.id)[0]

    servicios.devoluciones.registrar_devolucion(prestamo.id, [(detalle.id, 2, 0, 0)])

    assert servicios.unidades.obtener_unidad(primera.id).estado is EstadoUnidad.DISPONIBLE
    assert servicios.unidades.obtener_unidad(segunda.id).estado is EstadoUnidad.DISPONIBLE
    prestamo = servicios.prestamos.obtener_prestamo(prestamo.id)
    assert prestamo.estado is EstadoPrestamo.CERRADO
    assert discrepancias_unidades(conn_migrada) == []
    assert discrepancias_contadores(conn_migrada) == []


def test_devolucion_control_individual_con_danio(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = _articulo_individual(servicios, categoria.id)
    unidad = servicios.unidades.registrar_unidad(articulo.id, "PROY-01")
    estudiante = _estudiante(servicios)
    prestamo = servicios.prestamos.registrar_prestamo(
        estudiante.id, [LineaPrestamo(articulo.id, unidad_ids=(unidad.id,))]
    )
    detalle = servicios.prestamos.detalles(prestamo.id)[0]

    servicios.devoluciones.registrar_devolucion(
        prestamo.id,
        [LineaDevolucion(detalle.id, cantidad_daniada=1, descripcion="Se cayó")],
    )

    unidad = servicios.unidades.obtener_unidad(unidad.id)
    assert unidad.estado is EstadoUnidad.DANADA
    incidentes = servicios.incidentes.listar_por_prestamo(prestamo.id)
    assert incidentes[0].articulo_unidad_id == unidad.id
    assert discrepancias_unidades(conn_migrada) == []
    assert discrepancias_contadores(conn_migrada) == []


# ----------------------------------------------------------------- incidentes


def test_incidente_de_stock_por_danio(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=5)

    incidente = servicios.incidentes.registrar_incidente(
        articulo.id, TipoIncidente.DANIO, OrigenIncidente.STOCK, 2, "Se mojaron"
    )

    assert incidente.origen is OrigenIncidente.STOCK
    assert incidente.estado is EstadoIncidente.ABIERTO
    assert incidente.prestamo_id is None
    assert incidente.responsabilidad is ResponsabilidadIncidente.SIN_DETERMINAR
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_disponible, articulo.cantidad_daniada, articulo.cantidad_total) == (
        3,
        2,
        5,
    )
    assert discrepancias_contadores(conn_migrada) == []


def test_incidente_de_stock_por_perdida(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=4)

    servicios.incidentes.registrar_incidente(
        articulo.id, TipoIncidente.PERDIDA, OrigenIncidente.STOCK, 1, "Desapareció"
    )

    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_disponible, articulo.cantidad_faltante) == (3, 1)
    assert discrepancias_contadores(conn_migrada) == []


def test_incidente_otro_no_mueve_el_inventario(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=3)

    servicios.incidentes.registrar_incidente(
        articulo.id, TipoIncidente.OTRO, OrigenIncidente.STOCK, 1, "Observación"
    )

    articulo = servicios.inventario.obtener_articulo(articulo.id)
    estado = (
        articulo.cantidad_disponible,
        articulo.cantidad_daniada,
        articulo.cantidad_faltante,
    )
    assert estado == (3, 0, 0)
    movimientos = [
        movimiento
        for movimiento in servicios.inventario.listar_movimientos(articulo.id)
        if movimiento.referencia_tipo == "incidente"
    ]
    assert movimientos == []
    assert discrepancias_contadores(conn_migrada) == []


def test_incidente_stock_excede_lo_disponible(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)

    with pytest.raises(CantidadInsuficienteError):
        servicios.incidentes.registrar_incidente(
            articulo.id, TipoIncidente.PERDIDA, OrigenIncidente.STOCK, 5, "No hay tanto"
        )

    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_disponible, articulo.cantidad_faltante) == (2, 0)
    assert discrepancias_contadores(conn_migrada) == []


def test_incidente_stock_individual_exige_unidad(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo_individual(servicios, categoria.id)
    unidad = servicios.unidades.registrar_unidad(articulo.id, "PROY-01")

    with pytest.raises(ReglaNegocioError):
        servicios.incidentes.registrar_incidente(
            articulo.id, TipoIncidente.DANIO, OrigenIncidente.STOCK, 1, "Golpe"
        )

    incidente = servicios.incidentes.registrar_incidente(
        articulo.id,
        TipoIncidente.DANIO,
        OrigenIncidente.STOCK,
        1,
        "Golpe",
        unidad_id=unidad.id,
    )
    assert incidente.articulo_unidad_id == unidad.id
    assert servicios.unidades.obtener_unidad(unidad.id).estado is EstadoUnidad.DANADA


def test_incidente_no_puede_ser_de_origen_devolucion(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)

    with pytest.raises(ReglaNegocioError):  # RN-54
        servicios.incidentes.registrar_incidente(
            articulo.id, TipoIncidente.DANIO, OrigenIncidente.DEVOLUCION, 1, "No aplica"
        )


def test_incidente_de_prestamo_descuenta_el_pendiente(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=5)
    estudiante = _estudiante(servicios)
    prestamo = servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 3)])
    detalle = servicios.prestamos.detalles(prestamo.id)[0]

    incidente = servicios.incidentes.registrar_incidente(
        articulo.id,
        TipoIncidente.DANIO,
        OrigenIncidente.PRESTAMO,
        1,
        "Rayado",
        prestamo_id=prestamo.id,
        prestamo_detalle_id=detalle.id,
    )

    assert incidente.origen is OrigenIncidente.PRESTAMO
    assert incidente.prestamo_id == prestamo.id
    assert incidente.prestamo_detalle_id == detalle.id
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_prestada, articulo.cantidad_daniada, articulo.cantidad_total) == (
        2,
        1,
        5,
    )
    detalle = servicios.prestamos.detalles(prestamo.id)[0]
    assert detalle.cantidad_daniada == 1
    assert detalle.cantidad_pendiente == 2
    assert detalle.estado is EstadoDetalle.CON_INCIDENTE
    prestamo = servicios.prestamos.obtener_prestamo(prestamo.id)
    assert prestamo.estado is EstadoPrestamo.ACTIVO
    assert discrepancias_contadores(conn_migrada) == []


def test_incidente_de_prestamo_puede_cerrarlo(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=3)
    estudiante = _estudiante(servicios)
    prestamo = servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 2)])
    detalle = servicios.prestamos.detalles(prestamo.id)[0]

    servicios.incidentes.registrar_incidente(
        articulo.id,
        TipoIncidente.PERDIDA,
        OrigenIncidente.PRESTAMO,
        2,
        "Se perdió todo",
        prestamo_id=prestamo.id,
        prestamo_detalle_id=detalle.id,
    )

    prestamo = servicios.prestamos.obtener_prestamo(prestamo.id)
    assert prestamo.estado is EstadoPrestamo.CERRADO  # RN-35


def test_incidente_de_prestamo_sin_prestamo_se_rechaza(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)

    with pytest.raises(ReglaNegocioError):  # RN-54
        servicios.incidentes.registrar_incidente(
            articulo.id, TipoIncidente.DANIO, OrigenIncidente.PRESTAMO, 1, "Sin préstamo"
        )


def test_incidente_de_prestamo_excede_el_pendiente(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=3)
    estudiante = _estudiante(servicios)
    prestamo = servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 2)])
    detalle = servicios.prestamos.detalles(prestamo.id)[0]

    with pytest.raises(CantidadInsuficienteError):
        servicios.incidentes.registrar_incidente(
            articulo.id,
            TipoIncidente.PERDIDA,
            OrigenIncidente.PRESTAMO,
            5,
            "No hay tanto",
            prestamo_id=prestamo.id,
            prestamo_detalle_id=detalle.id,
        )
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_prestada, articulo.cantidad_faltante) == (2, 0)


def test_resolver_incidente(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)
    incidente = servicios.incidentes.registrar_incidente(
        articulo.id, TipoIncidente.DANIO, OrigenIncidente.STOCK, 1, "Golpe"
    )

    resuelto = servicios.incidentes.resolver_incidente(
        incidente.id, "Se reparó el equipo"
    )
    assert resuelto.estado is EstadoIncidente.RESUELTO
    assert resuelto.resolucion == "Se reparó el equipo"
    assert resuelto.resuelto_en is not None

    with pytest.raises(ReglaNegocioError):
        servicios.incidentes.resolver_incidente(incidente.id, "Otra vez")


def test_asignar_responsabilidad_a_estudiante(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)
    estudiante = _estudiante(servicios)
    incidente = servicios.incidentes.registrar_incidente(
        articulo.id, TipoIncidente.PERDIDA, OrigenIncidente.STOCK, 1, "Desapareció"
    )

    actualizado = servicios.incidentes.asignar_responsabilidad(
        incidente.id, estudiante.id, descripcion="Firmó el vale"
    )
    assert actualizado.responsabilidad is ResponsabilidadIncidente.ESTUDIANTE
    assert actualizado.estudiante_id == estudiante.id
    assert "Firmó el vale" in actualizado.descripcion


def test_asignar_responsabilidad_exige_motivo(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)
    estudiante = _estudiante(servicios)
    incidente = servicios.incidentes.registrar_incidente(
        articulo.id, TipoIncidente.PERDIDA, OrigenIncidente.STOCK, 1, "Desapareció"
    )

    with pytest.raises(ValidacionError):
        servicios.incidentes.asignar_responsabilidad(incidente.id, estudiante.id, descripcion="  ")


def test_incidente_sin_responsable_explicito_se_rechaza(servicios):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=2)

    with pytest.raises(ValidacionError):  # RN-56
        servicios.incidentes.registrar_incidente(
            articulo.id,
            TipoIncidente.PERDIDA,
            OrigenIncidente.STOCK,
            1,
            "Sin estudiante",
            responsabilidad=ResponsabilidadIncidente.ESTUDIANTE,
        )


def test_listados_de_incidentes(servicios):
    categoria = _categoria(servicios)
    primero = _articulo(servicios, categoria.id, nombre="Calculadora", cantidad=2)
    segundo = _articulo(servicios, categoria.id, nombre="Tablero", cantidad=2)
    abierto = servicios.incidentes.registrar_incidente(
        primero.id, TipoIncidente.DANIO, OrigenIncidente.STOCK, 1, "Golpe"
    )
    resuelto = servicios.incidentes.registrar_incidente(
        segundo.id, TipoIncidente.PERDIDA, OrigenIncidente.STOCK, 1, "Falta"
    )
    servicios.incidentes.resolver_incidente(resuelto.id, "Se repuso")

    assert [incidente.id for incidente in servicios.incidentes.listar_pendientes()] == [
        abierto.id
    ]
    assert [
        incidente.id
        for incidente in servicios.incidentes.listar_por_articulo(primero.id)
    ] == [abierto.id]
    assert len(servicios.incidentes.listar_incidentes(estado=EstadoIncidente.RESUELTO)) == 1


def test_obtener_incidente_inexistente(servicios):
    with pytest.raises(NoEncontradoError):
        servicios.incidentes.obtener_incidente(999)


# ----------------------------------------------------------- integración y cierre


def test_flujo_completo_prestamo_incidente_devolucion(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = _articulo(servicios, categoria.id, cantidad=5)
    estudiante = _estudiante(servicios)
    prestamo = servicios.prestamos.registrar_prestamo(estudiante.id, [(articulo.id, 4)])
    detalle = servicios.prestamos.detalles(prestamo.id)[0]

    servicios.incidentes.registrar_incidente(
        articulo.id,
        TipoIncidente.PERDIDA,
        OrigenIncidente.PRESTAMO,
        1,
        "Se perdió en el aula",
        prestamo_id=prestamo.id,
        prestamo_detalle_id=detalle.id,
    )
    servicios.devoluciones.registrar_devolucion(prestamo.id, [(detalle.id, 3, 0, 0)])

    articulo = servicios.inventario.obtener_articulo(articulo.id)
    estado = (
        articulo.cantidad_total,
        articulo.cantidad_disponible,
        articulo.cantidad_prestada,
        articulo.cantidad_faltante,
    )
    assert estado == (5, 4, 0, 1)
    prestamo = servicios.prestamos.obtener_prestamo(prestamo.id)
    assert prestamo.estado is EstadoPrestamo.CERRADO
    assert discrepancias_contadores(conn_migrada) == []
    assert discrepancias_unidades(conn_migrada) == []


def test_los_cambios_sobreviven_al_cierre_de_la_conexion(servicios, conn_migrada):
    prestamo, detalle, articulo, _ = _prestamo_con_detalle(servicios, cantidad=3)
    servicios.devoluciones.registrar_devolucion(
        prestamo.id,
        [LineaDevolucion(detalle.id, cantidad_devuelta=2, cantidad_daniada=1, descripcion="Golpe")],
    )
    ruta = next(
        fila[2]
        for fila in conn_migrada.execute("PRAGMA database_list")
        if fila[1] == "main"
    )

    otra = database.connect(ruta)
    try:
        from stocklend.services import DevolucionService, PrestamoService

        prestatario = PrestamoService(otra)
        prestamo_reabierto = prestatario.obtener_prestamo(prestamo.id)
        assert prestamo_reabierto.estado is EstadoPrestamo.CERRADO
        detalle_reabierto = prestatario.detalles(prestamo.id)[0]
        assert (detalle_reabierto.cantidad_devuelta, detalle_reabierto.cantidad_daniada) == (
            2,
            1,
        )
        devoluciones = DevolucionService(otra).listar_devoluciones(prestamo_id=prestamo.id)
        assert len(devoluciones) == 1
    finally:
        otra.close()
