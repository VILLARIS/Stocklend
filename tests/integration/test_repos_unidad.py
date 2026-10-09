"""Unidades individuales: CRUD, filtros y CHECK de préstamo (RN-51 a RN-53)."""

from __future__ import annotations

import sqlite3

import pytest

from stocklend.domain import EstadoUnidad


def _articulo(repos, fabrica, control_individual=True):
    categoria = repos.categorias.crear(fabrica.categoria())
    return repos.articulos.crear(
        fabrica.articulo(categoria.id, control_individual=control_individual)
    )


def test_crear_y_obtener(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    creada = repos.unidades.crear(fabrica.unidad(articulo.id, codigo="A-01"))
    assert creada.id is not None
    assert repos.unidades.obtener_por_id(creada.id) == creada
    assert repos.unidades.obtener_por_codigo("a-01") == creada


def test_codigo_duplicado_falla(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    repos.unidades.crear(fabrica.unidad(articulo.id, codigo="A-01"))
    with pytest.raises(sqlite3.IntegrityError):
        repos.unidades.crear(fabrica.unidad(articulo.id, codigo="a-01"))


def test_unidad_prestada_exige_renglon(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    with pytest.raises(sqlite3.IntegrityError):
        repos.unidades.crear(
            fabrica.unidad(articulo.id, estado=EstadoUnidad.PRESTADA)
        )


def test_listar_y_contar(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    repos.unidades.crear(fabrica.unidad(articulo.id, codigo="A-01"))
    repos.unidades.crear(
        fabrica.unidad(articulo.id, codigo="A-02", estado=EstadoUnidad.DANADA)
    )
    assert [u.codigo for u in repos.unidades.listar_por_articulo(articulo.id)] == [
        "A-01",
        "A-02",
    ]
    assert [
        u.codigo
        for u in repos.unidades.listar_por_articulo(
            articulo.id, estado=EstadoUnidad.DANADA
        )
    ] == ["A-02"]
    assert [u.codigo for u in repos.unidades.listar_por_estado(EstadoUnidad.DISPONIBLE)] == [
        "A-01"
    ]
    assert repos.unidades.contar_por_articulo(articulo.id) == 2
    assert repos.unidades.contar_por_articulo(articulo.id, estado=EstadoUnidad.DANADA) == 1


def test_unidad_asociada_a_renglon(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    estudiante = repos.estudiantes.crear(fabrica.estudiante())
    prestamo = repos.prestamos.crear(fabrica.prestamo(estudiante.id))
    detalle = repos.prestamos.crear_detalle(
        fabrica.prestamo_detalle(prestamo.id, articulo.id)
    )
    unidad = repos.unidades.crear(
        fabrica.unidad(
            articulo.id,
            estado=EstadoUnidad.PRESTADA,
            prestamo_detalle_id=detalle.id,
        )
    )
    assert [u.id for u in repos.unidades.listar_por_prestamo_detalle(detalle.id)] == [
        unidad.id
    ]


def test_actualizar_estado(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    creada = repos.unidades.crear(fabrica.unidad(articulo.id))
    cambiada = fabrica.unidad(
        articulo.id,
        id=creada.id,
        estado=EstadoUnidad.BAJA,
        notas="Rota",
        actualizado_en="2026-02-01",
    )
    repos.unidades.actualizar(cambiada)
    assert repos.unidades.obtener_por_id(creada.id) == cambiada
