"""Libro de movimientos: solo adición, CHECK e historial (RN-05, RN-46, RN-47)."""

from __future__ import annotations

import sqlite3

import pytest

from stocklend.domain import TipoMovimiento


def _articulo(repos, fabrica):
    categoria = repos.categorias.crear(fabrica.categoria())
    return repos.articulos.crear(fabrica.articulo(categoria.id))


def test_crear_y_obtener(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    creado = repos.movimientos.crear(fabrica.movimiento(articulo.id))
    assert creado.id is not None
    assert creado.tipo is TipoMovimiento.ALTA
    assert repos.movimientos.obtener_por_id(creado.id) == creado


def test_cantidad_debe_ser_positiva(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    with pytest.raises(sqlite3.IntegrityError):
        repos.movimientos.crear(fabrica.movimiento(articulo.id, cantidad=0))


def test_motivo_obligatorio(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    with pytest.raises(sqlite3.IntegrityError):
        repos.movimientos.crear(fabrica.movimiento(articulo.id, motivo="  "))


def test_historial_ordenado_y_filtros(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    repos.movimientos.crear(
        fabrica.movimiento(articulo.id, fecha="2026-01-01", motivo="Alta")
    )
    repos.movimientos.crear(
        fabrica.movimiento(
            articulo.id,
            fecha="2026-02-01",
            tipo=TipoMovimiento.AJUSTE_NEGATIVO,
            motivo="Ajuste",
            cantidad=1,
            cantidad_resultante_total=0,
            cantidad_resultante_disponible=0,
        )
    )
    historial = repos.movimientos.listar_por_articulo(articulo.id)
    assert [m.fecha for m in historial] == ["2026-02-01", "2026-01-01"]
    assert repos.movimientos.contar_por_articulo(articulo.id) == 2
    assert [
        m.fecha
        for m in repos.movimientos.listar_por_articulo(
            articulo.id, desde="2026-01-15"
        )
    ] == ["2026-02-01"]


def test_listar_por_referencia_y_unidad(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    repos.movimientos.crear(
        fabrica.movimiento(
            articulo.id, referencia_tipo="prestamo", referencia_id=7
        )
    )
    repos.movimientos.crear(
        fabrica.movimiento(
            articulo.id,
            tipo=TipoMovimiento.ALTA,
            motivo="Otra",
            referencia_tipo=None,
            referencia_id=None,
        )
    )
    assert len(repos.movimientos.listar_por_referencia("prestamo", 7)) == 1
    assert len(repos.movimientos.listar_por_referencia("prestamo", 8)) == 0


def test_es_solo_adicion(repos):
    assert not hasattr(repos.movimientos, "actualizar")
    assert not hasattr(repos.movimientos, "eliminar")
    assert not hasattr(repos.movimientos, "borrar")
