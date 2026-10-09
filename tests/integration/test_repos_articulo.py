"""CRUD, filtros y CHECK del repositorio de artículos (RN-02, RN-09)."""

from __future__ import annotations

import sqlite3

import pytest

from stocklend.domain import NoEncontradoError


def _categoria(repos, fabrica, nombre="Utensilios"):
    return repos.categorias.crear(fabrica.categoria(nombre=nombre))


def test_crear_y_obtener(repos, fabrica):
    categoria = _categoria(repos, fabrica)
    creado = repos.articulos.crear(
        fabrica.articulo(categoria.id, nombre="Olla", codigo="OLA-01")
    )
    assert creado.id is not None
    assert repos.articulos.obtener_por_id(creado.id) == creado
    assert repos.articulos.obtener_por_codigo("OLA-01") == creado
    assert repos.articulos.obtener_por_codigo(None) is None
    assert repos.articulos.obtener_por_id(999) is None


def test_codigo_duplicado_falla(repos, fabrica):
    categoria = _categoria(repos, fabrica)
    repos.articulos.crear(fabrica.articulo(categoria.id, codigo="OLA-01"))
    with pytest.raises(sqlite3.IntegrityError):
        repos.articulos.crear(fabrica.articulo(categoria.id, codigo="ola-01"))


def test_clave_foranea_invalida_falla(repos, fabrica):
    with pytest.raises(sqlite3.IntegrityError):
        repos.articulos.crear(fabrica.articulo(categoria_id=999))


def test_listar_por_categoria_y_activos(repos, fabrica):
    utensilios = _categoria(repos, fabrica, "Utensilios")
    otros = _categoria(repos, fabrica, "Otros")
    repos.articulos.crear(fabrica.articulo(utensilios.id, nombre="Olla"))
    repos.articulos.crear(fabrica.articulo(utensilios.id, nombre="Sartén", activo=False))
    repos.articulos.crear(fabrica.articulo(otros.id, nombre="Taladro"))

    assert repos.articulos.contar() == 3
    assert repos.articulos.contar(solo_activos=True) == 2
    assert repos.articulos.contar(categoria_id=utensilios.id) == 2
    nombres = [
        a.nombre for a in repos.articulos.listar_por_categoria(utensilios.id)
    ]
    assert nombres == ["Olla", "Sartén"]
    assert [a.nombre for a in repos.articulos.listar(solo_activos=True)] == [
        "Olla",
        "Taladro",
    ]


def test_buscar_por_nombre_codigo_y_categoria(repos, fabrica):
    utensilios = _categoria(repos, fabrica, "Utensilios")
    repos.articulos.crear(
        fabrica.articulo(utensilios.id, nombre="Olla", codigo="OLA-01")
    )
    repos.articulos.crear(fabrica.articulo(utensilios.id, nombre="Sartén"))

    assert [a.nombre for a in repos.articulos.buscar("Oll")] == ["Olla"]
    assert [a.nombre for a in repos.articulos.buscar("OLA-01")] == ["Olla"]
    assert {a.nombre for a in repos.articulos.buscar("Utens")} == {"Olla", "Sartén"}


def test_buscar_con_comilla_simple_no_rompe_la_consulta(repos, fabrica):
    categoria = _categoria(repos, fabrica)
    repos.articulos.crear(fabrica.articulo(categoria.id, nombre="O'Reilly"))
    repos.articulos.crear(fabrica.articulo(categoria.id, nombre="Sartén"))

    resultados = repos.articulos.buscar("O'Reilly")
    assert [a.nombre for a in resultados] == ["O'Reilly"]
    assert repos.articulos.buscar("'; DROP TABLE articulo; --") == []


def test_actualizar_datos(repos, fabrica):
    categoria = _categoria(repos, fabrica)
    creado = repos.articulos.crear(fabrica.articulo(categoria.id, codigo="OLA-01"))
    cambiado = fabrica.articulo(
        categoria.id,
        id=creado.id,
        codigo="OLA-02",
        nombre="Olla grande",
        prestable=False,
        actualizado_en="2026-02-01",
    )
    repos.articulos.actualizar_datos(cambiado)
    assert repos.articulos.obtener_por_id(creado.id) == cambiado


def test_actualizar_contadores_coherentes(repos, fabrica):
    categoria = _categoria(repos, fabrica)
    creado = repos.articulos.crear(fabrica.articulo(categoria.id))
    cambiado = fabrica.articulo(
        categoria.id,
        id=creado.id,
        cantidad_total=10,
        cantidad_disponible=7,
        cantidad_prestada=2,
        cantidad_daniada=1,
        cantidad_faltante=0,
        actualizado_en="2026-02-01",
    )
    repos.articulos.actualizar_contadores(cambiado)
    assert repos.articulos.obtener_por_id(creado.id).cantidad_disponible == 7


def test_check_de_coherencia_rn_02(repos, fabrica):
    categoria = _categoria(repos, fabrica)
    creado = repos.articulos.crear(fabrica.articulo(categoria.id))
    descuadrado = fabrica.articulo(
        categoria.id, id=creado.id, cantidad_total=10, cantidad_disponible=3
    )
    with pytest.raises(sqlite3.IntegrityError):
        repos.articulos.actualizar_contadores(descuadrado)


def test_check_de_cantidad_negativa(repos, fabrica):
    categoria = _categoria(repos, fabrica)
    creado = repos.articulos.crear(fabrica.articulo(categoria.id))
    negativo = fabrica.articulo(
        categoria.id,
        id=creado.id,
        cantidad_total=-1,
        cantidad_disponible=-1,
    )
    with pytest.raises(sqlite3.IntegrityError):
        repos.articulos.actualizar_contadores(negativo)


def test_actualizar_inexistente_falla(repos, fabrica):
    with pytest.raises(NoEncontradoError):
        repos.articulos.actualizar_datos(fabrica.articulo(id=999))


def test_no_expone_borrado(repos):
    assert not hasattr(repos.articulos, "eliminar")
    assert not hasattr(repos.articulos, "borrar")
