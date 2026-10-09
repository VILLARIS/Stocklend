"""Incidentes: creación, filtros, resolución y CHECK (RN-40 a RN-45, RN-54 a RN-57)."""

from __future__ import annotations

import sqlite3

import pytest

from stocklend.domain import (
    EstadoIncidente,
    OrigenIncidente,
    ResponsabilidadIncidente,
    TipoIncidente,
)


def _articulo(repos, fabrica):
    categoria = repos.categorias.crear(fabrica.categoria())
    return repos.articulos.crear(fabrica.articulo(categoria.id))


def test_crear_y_obtener(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    creado = repos.incidentes.crear(fabrica.incidente(articulo.id))
    assert creado.id is not None
    assert creado.origen is OrigenIncidente.STOCK
    assert repos.incidentes.obtener_por_id(creado.id) == creado


def test_clave_foranea_invalida_falla(repos, fabrica):
    with pytest.raises(sqlite3.IntegrityError):
        repos.incidentes.crear(fabrica.incidente(articulo_id=999))


def test_descripcion_obligatoria(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    with pytest.raises(sqlite3.IntegrityError):
        repos.incidentes.crear(fabrica.incidente(articulo.id, descripcion="   "))


def test_responsabilidad_estudiante_exige_estudiante(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    with pytest.raises(sqlite3.IntegrityError):
        repos.incidentes.crear(
            fabrica.incidente(
                articulo.id, responsabilidad=ResponsabilidadIncidente.ESTUDIANTE
            )
        )


def test_origen_devolucion_exige_devolucion(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    with pytest.raises(sqlite3.IntegrityError):
        repos.incidentes.crear(
            fabrica.incidente(articulo.id, origen=OrigenIncidente.DEVOLUCION)
        )


def test_listar_pendientes_y_filtros(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    abierto = repos.incidentes.crear(fabrica.incidente(articulo.id))
    resuelto = repos.incidentes.crear(
        fabrica.incidente(
            articulo.id,
            tipo=TipoIncidente.DANIO,
            estado=EstadoIncidente.RESUELTO,
            descripcion="Daño en depósito",
        )
    )
    assert [i.id for i in repos.incidentes.listar_pendientes()] == [abierto.id]
    assert repos.incidentes.contar(estado=EstadoIncidente.RESUELTO) == 1
    assert repos.incidentes.contar(tipo=TipoIncidente.DANIO) == 1
    assert [i.id for i in repos.incidentes.listar_por_articulo(articulo.id)] == [
        resuelto.id,
        abierto.id,
    ]


def test_resolver_incidente(repos, fabrica):
    articulo = _articulo(repos, fabrica)
    incidente = repos.incidentes.crear(fabrica.incidente(articulo.id))
    resuelto = fabrica.incidente(
        articulo.id,
        id=incidente.id,
        estado=EstadoIncidente.RESUELTO,
        resolucion="Se repuso la unidad",
        resuelto_en="2026-02-01",
    )
    repos.incidentes.actualizar(resuelto)
    assert repos.incidentes.obtener_por_id(incidente.id) == resuelto


def test_no_expone_borrado(repos):
    assert not hasattr(repos.incidentes, "eliminar")
    assert not hasattr(repos.incidentes, "borrar")
