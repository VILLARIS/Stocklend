"""Cálculo puro de contadores y validaciones comunes de servicios (RN-01, RN-58)."""

from __future__ import annotations

import pytest

from stocklend.domain import CantidadInsuficienteError, TipoMovimiento, ValidacionError
from stocklend.services._comun import calcular_contadores, entero_no_negativo, validar_motivo


def _articulo(fabrica, **kw):
    base = {
        "id": 1,
        "cantidad_total": 0,
        "cantidad_disponible": 0,
        "cantidad_prestada": 0,
        "cantidad_daniada": 0,
        "cantidad_faltante": 0,
    }
    base.update(kw)
    return fabrica.articulo(**base)


def test_alta_suma_al_total_y_a_disponible(fabrica):
    nuevo = calcular_contadores(_articulo(fabrica), TipoMovimiento.ALTA, 5)
    assert (nuevo.cantidad_total, nuevo.cantidad_disponible) == (5, 5)


def test_prestamo_mueve_disponible_a_prestada_sin_cambiar_total(fabrica):
    articulo = _articulo(fabrica, cantidad_total=3, cantidad_disponible=3)
    nuevo = calcular_contadores(articulo, TipoMovimiento.PRESTAMO, 2)
    assert (nuevo.cantidad_total, nuevo.cantidad_disponible, nuevo.cantidad_prestada) == (
        3,
        1,
        2,
    )


def test_danio_en_deposito_descuenta_de_disponible(fabrica):
    articulo = _articulo(fabrica, cantidad_total=2, cantidad_disponible=2)
    nuevo = calcular_contadores(articulo, TipoMovimiento.DANIO_DISPONIBLE, 1)
    assert (nuevo.cantidad_disponible, nuevo.cantidad_daniada) == (1, 1)
    assert nuevo.cantidad_total == 2


def test_danio_en_prestamo_descuenta_de_prestada(fabrica):
    articulo = _articulo(fabrica, cantidad_total=2, cantidad_prestada=2)
    nuevo = calcular_contadores(articulo, TipoMovimiento.DANIO_PRESTADO, 1)
    assert (nuevo.cantidad_prestada, nuevo.cantidad_daniada) == (1, 1)
    assert nuevo.cantidad_disponible == 0


def test_perdida_no_reduce_el_total(fabrica):
    articulo = _articulo(fabrica, cantidad_total=1, cantidad_disponible=1)
    nuevo = calcular_contadores(articulo, TipoMovimiento.PERDIDA_DISPONIBLE, 1)
    assert nuevo.cantidad_total == 1
    assert (nuevo.cantidad_disponible, nuevo.cantidad_faltante) == (0, 1)


def test_baja_reduce_el_total(fabrica):
    articulo = _articulo(fabrica, cantidad_total=1, cantidad_daniada=1)
    nuevo = calcular_contadores(articulo, TipoMovimiento.BAJA_DANIADA, 1)
    assert (nuevo.cantidad_total, nuevo.cantidad_daniada) == (0, 0)


def test_cubo_negativo_se_rechaza(fabrica):
    articulo = _articulo(fabrica, cantidad_total=1, cantidad_disponible=1)
    with pytest.raises(CantidadInsuficienteError):
        calcular_contadores(articulo, TipoMovimiento.AJUSTE_NEGATIVO, 2)


def test_cantidad_no_positiva_se_rechaza(fabrica):
    with pytest.raises(ValidacionError):
        calcular_contadores(_articulo(fabrica), TipoMovimiento.ALTA, 0)


def test_validar_motivo_rechaza_vacio():
    with pytest.raises(ValidacionError):
        validar_motivo("   ")


def test_entero_no_negativo_rechaza_negativo_y_bool():
    assert entero_no_negativo(0, "x") == 0
    with pytest.raises(ValidacionError):
        entero_no_negativo(-1, "x")
    with pytest.raises(ValidacionError):
        entero_no_negativo(True, "x")
