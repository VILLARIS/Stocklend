"""CRUD y restricciones del repositorio de categorías (RN-10, RN-46)."""

from __future__ import annotations

import sqlite3

import pytest

from stocklend.domain import NoEncontradoError


def test_crear_y_obtener(repos, fabrica):
    creada = repos.categorias.crear(fabrica.categoria(nombre="Herramientas"))
    assert creada.id is not None
    assert repos.categorias.obtener_por_id(creada.id) == creada


def test_obtener_por_nombre_ignora_mayusculas(repos, fabrica):
    repos.categorias.crear(fabrica.categoria(nombre="Herramientas"))
    assert repos.categorias.obtener_por_nombre("herramientas") is not None
    assert repos.categorias.obtener_por_id(999) is None


def test_nombre_duplicado_falla(repos, fabrica):
    repos.categorias.crear(fabrica.categoria(nombre="Herramientas"))
    with pytest.raises(sqlite3.IntegrityError):
        repos.categorias.crear(fabrica.categoria(nombre="HERRAMIENTAS"))


def test_listar_y_contar(repos, fabrica):
    for nombre in ("Zeta", "Alfa", "Beta"):
        repos.categorias.crear(fabrica.categoria(nombre=nombre))
    repos.categorias.crear(fabrica.categoria(nombre="Inactiva", activo=False))

    nombres = [c.nombre for c in repos.categorias.listar()]
    assert nombres == ["Alfa", "Beta", "Inactiva", "Zeta"]
    assert repos.categorias.contar() == 4
    assert repos.categorias.contar(solo_activas=True) == 3
    assert [c.nombre for c in repos.categorias.listar(solo_activas=True)] == [
        "Alfa",
        "Beta",
        "Zeta",
    ]


def test_actualizar(repos, fabrica):
    creada = repos.categorias.crear(fabrica.categoria())
    cambiada = fabrica.categoria(
        id=creada.id, nombre="Menaje", descripcion="Cocina", activo=False
    )
    repos.categorias.actualizar(cambiada)
    recuperada = repos.categorias.obtener_por_id(creada.id)
    assert recuperada == cambiada


def test_actualizar_inexistente_falla(repos, fabrica):
    with pytest.raises(NoEncontradoError):
        repos.categorias.actualizar(fabrica.categoria(id=999))


def test_no_expone_borrado(repos):
    assert not hasattr(repos.categorias, "eliminar")
    assert not hasattr(repos.categorias, "borrar")
    assert not hasattr(repos.categorias, "delete")
