"""Unidades individuales (RN-50 a RN-53, RN-61) y reconciliación."""

from __future__ import annotations

import pytest
from _reconciliacion import discrepancias_contadores, discrepancias_unidades

from stocklend.domain import (
    EstadoUnidad,
    NoEncontradoError,
    ReglaNegocioError,
    ValidacionError,
)


def _articulo_individual(servicios, nombre="Proyector"):
    categoria = servicios.inventario.registrar_categoria("Equipos")
    return servicios.inventario.registrar_articulo(
        nombre, categoria.id, control_individual=True
    )


def test_alta_de_unidad_actualiza_contadores_y_libro(servicios, conn_migrada):
    articulo = _articulo_individual(servicios)
    unidad = servicios.unidades.registrar_unidad(articulo.id, "PROY-01")
    assert unidad.estado is EstadoUnidad.DISPONIBLE
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_total, articulo.cantidad_disponible) == (1, 1)
    assert discrepancias_contadores(conn_migrada) == []
    assert discrepancias_unidades(conn_migrada) == []


def test_solo_articulos_con_control_individual_tienen_unidades(servicios):
    categoria = servicios.inventario.registrar_categoria("Papelería")
    articulo = servicios.inventario.registrar_articulo("Lápiz", categoria.id)
    with pytest.raises(ReglaNegocioError):  # RN-50
        servicios.unidades.registrar_unidad(articulo.id, "LAP-01")


def test_codigo_de_unidad_unico_y_obligatorio(servicios):
    articulo = _articulo_individual(servicios)
    servicios.unidades.registrar_unidad(articulo.id, "PROY-01")
    with pytest.raises(ReglaNegocioError):  # RN-51
        servicios.unidades.registrar_unidad(articulo.id, "proy-01")
    with pytest.raises(ValidacionError):  # RN-51
        servicios.unidades.registrar_unidad(articulo.id, "   ")


def test_alta_con_estado_inicial_danada_o_faltante(servicios, conn_migrada):
    articulo = _articulo_individual(servicios)
    danada = servicios.unidades.registrar_unidad(
        articulo.id, "PROY-01", estado=EstadoUnidad.DANADA
    )
    faltante = servicios.unidades.registrar_unidad(
        articulo.id, "PROY-02", estado=EstadoUnidad.FALTANTE
    )
    assert danada.estado is EstadoUnidad.DANADA
    assert faltante.estado is EstadoUnidad.FALTANTE
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_total, articulo.cantidad_daniada, articulo.cantidad_faltante) == (
        2,
        1,
        1,
    )
    assert discrepancias_contadores(conn_migrada) == []
    assert discrepancias_unidades(conn_migrada) == []


def test_alta_no_admite_prestada_ni_baja(servicios):
    articulo = _articulo_individual(servicios)
    for estado in (EstadoUnidad.PRESTADA, EstadoUnidad.BAJA):
        with pytest.raises(ReglaNegocioError):
            servicios.unidades.registrar_unidad(articulo.id, "PROY-99", estado=estado)


def test_cambiar_estado_disponible_a_danada(servicios, conn_migrada):
    articulo = _articulo_individual(servicios)
    unidad = servicios.unidades.registrar_unidad(articulo.id, "PROY-01")
    unidad = servicios.unidades.cambiar_estado(
        unidad.id, EstadoUnidad.DANADA, "Se golpeó"
    )
    assert unidad.estado is EstadoUnidad.DANADA
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_disponible, articulo.cantidad_daniada) == (0, 1)
    assert articulo.cantidad_total == 1
    assert discrepancias_contadores(conn_migrada) == []
    assert discrepancias_unidades(conn_migrada) == []


def test_baja_de_unidad_reduce_el_total(servicios, conn_migrada):
    articulo = _articulo_individual(servicios)
    unidad = servicios.unidades.registrar_unidad(articulo.id, "PROY-01")
    servicios.unidades.cambiar_estado(unidad.id, EstadoUnidad.DANADA, "Roto")
    baja = servicios.unidades.cambiar_estado(
        unidad.id, EstadoUnidad.BAJA, "Se desechó (RN-60)"
    )
    assert baja.estado is EstadoUnidad.BAJA
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_total, articulo.cantidad_daniada) == (0, 0)
    assert discrepancias_unidades(conn_migrada) == []
    assert discrepancias_contadores(conn_migrada) == []


def test_reingreso_por_reparacion(servicios, conn_migrada):
    articulo = _articulo_individual(servicios)
    unidad = servicios.unidades.registrar_unidad(
        articulo.id, "PROY-01", estado=EstadoUnidad.DANADA
    )
    reparada = servicios.unidades.cambiar_estado(
        unidad.id, EstadoUnidad.DISPONIBLE, "Reparado"
    )
    assert reparada.estado is EstadoUnidad.DISPONIBLE
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert (articulo.cantidad_disponible, articulo.cantidad_daniada) == (1, 0)
    assert discrepancias_contadores(conn_migrada) == []


def test_transiciones_no_permitidas(servicios):
    articulo = _articulo_individual(servicios)
    unidad = servicios.unidades.registrar_unidad(articulo.id, "PROY-01")
    with pytest.raises(ReglaNegocioError):  # no-op
        servicios.unidades.cambiar_estado(unidad.id, EstadoUnidad.DISPONIBLE, "Igual")
    with pytest.raises(ReglaNegocioError):  # disponible -> baja directo
        servicios.unidades.cambiar_estado(unidad.id, EstadoUnidad.BAJA, "No")
    with pytest.raises(ReglaNegocioError):  # hacia prestada: Etapa 4
        servicios.unidades.cambiar_estado(unidad.id, EstadoUnidad.PRESTADA, "No")


def test_cambiar_estado_exige_motivo(servicios):
    articulo = _articulo_individual(servicios)
    unidad = servicios.unidades.registrar_unidad(articulo.id, "PROY-01")
    with pytest.raises(ValidacionError):  # RN-05
        servicios.unidades.cambiar_estado(unidad.id, EstadoUnidad.DANADA, "  ")


def test_cinco_unidades_coinciden_con_los_contadores(servicios, conn_migrada):
    articulo = _articulo_individual(servicios)
    codigos = [f"PROY-{i:02d}" for i in range(1, 6)]
    unidades = servicios.unidades.registrar_unidades(articulo.id, codigos)
    assert len(unidades) == 5
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert articulo.cantidad_total == 5
    assert servicios.unidades.contar_por_estado(
        articulo.id, estado=EstadoUnidad.DISPONIBLE
    ) == 5
    assert discrepancias_unidades(conn_migrada) == []
    assert discrepancias_contadores(conn_migrada) == []


def test_alta_en_bloque_es_todo_o_nada(servicios, conn_migrada):
    articulo = _articulo_individual(servicios)
    with pytest.raises(ReglaNegocioError):  # código repetido en la lista
        servicios.unidades.registrar_unidades(
            articulo.id, ["PROY-01", "PROY-02", "proy-01"]
        )
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert articulo.cantidad_total == 0
    assert servicios.unidades.contar_por_estado(articulo.id) == 0
    assert servicios.inventario.listar_movimientos(articulo.id) == []


def test_editar_unidad_no_cambia_estado_ni_duplica_codigo(servicios):
    articulo = _articulo_individual(servicios)
    primera = servicios.unidades.registrar_unidad(articulo.id, "PROY-01")
    segunda = servicios.unidades.registrar_unidad(articulo.id, "PROY-02")
    editada = servicios.unidades.editar_unidad(
        primera.id, codigo="PROY-01B", descripcion="Con maletín"
    )
    assert editada.codigo == "PROY-01B"
    assert editada.estado is EstadoUnidad.DISPONIBLE
    assert editada.descripcion == "Con maletín"
    with pytest.raises(ReglaNegocioError):  # RN-51
        servicios.unidades.editar_unidad(segunda.id, codigo="PROY-01B")


def test_obtener_unidad_inexistente(servicios):
    with pytest.raises(NoEncontradoError):
        servicios.unidades.obtener_unidad(999)
