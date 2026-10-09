"""Value objects del dominio: validaciones de formato y obligatoriedad."""

from __future__ import annotations

import pytest

from stocklend.domain import (
    Cantidad,
    CodigoUnidad,
    CodigoUniversitario,
    Folio,
    RangoFechas,
    ValidacionError,
)


def test_folio_valido_y_partes():
    folio = Folio("PRE-2026-000001")
    assert str(folio) == "PRE-2026-000001"
    assert folio.anio == 2026
    assert folio.correlativo == 1


def test_folio_desde_partes():
    assert str(Folio.desde_partes(2026, 42)) == "PRE-2026-000042"


@pytest.mark.parametrize(
    "invalido",
    ["PRE-2026-1", "2026-000001", "PRE-26-000001", "PRE-2026-0000001", "pre-2026-000001", ""],
)
def test_folio_invalido(invalido):
    with pytest.raises(ValidacionError):
        Folio(invalido)


def test_folio_correlativo_fuera_de_rango():
    with pytest.raises(ValidacionError):
        Folio.desde_partes(2026, 0)
    with pytest.raises(ValidacionError):
        Folio.desde_partes(2026, 1_000_000)


def test_codigo_universitario_normaliza_y_rechaza_vacio():
    assert CodigoUniversitario("  U100  ").valor == "U100"
    with pytest.raises(ValidacionError):
        CodigoUniversitario("   ")


def test_codigo_unidad_rechaza_vacio():
    assert CodigoUnidad(" A-01 ").valor == "A-01"
    with pytest.raises(ValidacionError):
        CodigoUnidad("")


def test_cantidad_no_negativa():
    assert Cantidad(0).valor == 0
    assert Cantidad(5).es_positiva is True
    assert Cantidad(0).es_positiva is False
    with pytest.raises(ValidacionError):
        Cantidad(-1)
    with pytest.raises(ValidacionError):
        Cantidad(1.5)  # type: ignore[arg-type]


def test_rango_fechas_exclusivo():
    rango = RangoFechas("2026-01-01", "2026-02-01")
    assert rango.contiene("2026-01-01") is True
    assert rango.contiene("2026-01-31") is True
    assert rango.contiene("2026-02-01") is False
    assert rango.contiene("2025-12-31") is False


def test_rango_fechas_sin_limite_superior():
    rango = RangoFechas("2026-01-01")
    assert rango.contiene("2099-12-31") is True
    assert rango.contiene("2025-12-31") is False


def test_rango_fechas_invalido():
    with pytest.raises(ValidacionError):
        RangoFechas("2026-02-01", "2026-01-01")
    with pytest.raises(ValidacionError):
        RangoFechas("")
