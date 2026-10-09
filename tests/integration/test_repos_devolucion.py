"""Devoluciones y renglones: solo adición e inmutables (RN-37, RN-38)."""

from __future__ import annotations

import sqlite3

import pytest


def _detalle_previo(repos, fabrica):
    estudiante = repos.estudiantes.crear(fabrica.estudiante())
    categoria = repos.categorias.crear(fabrica.categoria())
    articulo = repos.articulos.crear(fabrica.articulo(categoria.id))
    prestamo = repos.prestamos.crear(fabrica.prestamo(estudiante.id))
    detalle = repos.prestamos.crear_detalle(
        fabrica.prestamo_detalle(prestamo.id, articulo.id, cantidad_prestada=2)
    )
    return prestamo, detalle


def test_crear_y_obtener(repos, fabrica):
    prestamo, _ = _detalle_previo(repos, fabrica)
    creada = repos.devoluciones.crear(fabrica.devolucion(prestamo.id))
    assert creada.id is not None
    assert repos.devoluciones.obtener_por_id(creada.id) == creada
    assert repos.devoluciones.obtener_por_id(999) is None


def test_clave_foranea_invalida_falla(repos, fabrica):
    with pytest.raises(sqlite3.IntegrityError):
        repos.devoluciones.crear(fabrica.devolucion(prestamo_id=999))


def test_listar_por_prestamo_y_filtros(repos, fabrica):
    prestamo, _ = _detalle_previo(repos, fabrica)
    repos.devoluciones.crear(
        fabrica.devolucion(prestamo.id, fecha_devolucion="2026-01-05")
    )
    repos.devoluciones.crear(
        fabrica.devolucion(prestamo.id, fecha_devolucion="2026-02-05")
    )
    assert repos.devoluciones.contar(prestamo_id=prestamo.id) == 2
    assert [
        d.fecha_devolucion
        for d in repos.devoluciones.listar(desde="2026-02-01", hasta="2026-03-01")
    ] == ["2026-02-05"]
    assert repos.devoluciones.listar_por_prestamo(prestamo.id)[0].fecha_devolucion == (
        "2026-01-05"
    )


def test_renglones_y_unique(repos, fabrica):
    prestamo, detalle = _detalle_previo(repos, fabrica)
    devolucion = repos.devoluciones.crear(fabrica.devolucion(prestamo.id))
    creado = repos.devoluciones.crear_detalle(
        fabrica.devolucion_detalle(devolucion.id, detalle.id, cantidad_devuelta=2)
    )
    assert creado.id is not None
    assert repos.devoluciones.listar_detalles(devolucion.id) == [creado]
    assert (
        repos.devoluciones.obtener_detalle_por_renglon(devolucion.id, detalle.id)
        == creado
    )
    with pytest.raises(sqlite3.IntegrityError):
        repos.devoluciones.crear_detalle(
            fabrica.devolucion_detalle(devolucion.id, detalle.id, cantidad_devuelta=1)
        )


def test_es_inmutable(repos):
    assert not hasattr(repos.devoluciones, "actualizar")
    assert not hasattr(repos.devoluciones, "eliminar")
    assert not hasattr(repos.devoluciones, "borrar")
