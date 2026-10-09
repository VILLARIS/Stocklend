"""Verificación explícita de la Etapa 2 (DEVELOPMENT_PLAN líneas 123-130)."""

from __future__ import annotations

import dataclasses
import sqlite3

import pytest

from stocklend.domain import Categoria


def test_crud_completo_articulo_estudiante_categoria(repos, fabrica):
    categoria = repos.categorias.crear(fabrica.categoria(nombre="Utensilios"))
    repos.categorias.actualizar(fabrica.categoria(id=categoria.id, nombre="Menaje"))
    assert repos.categorias.obtener_por_id(categoria.id).nombre == "Menaje"

    estudiante = repos.estudiantes.crear(fabrica.estudiante())
    estudiante = repos.estudiantes.obtener_por_id(estudiante.id)
    assert estudiante.codigo_universitario == "U100"

    articulo = repos.articulos.crear(fabrica.articulo(categoria.id, nombre="Olla"))
    assert repos.articulos.obtener_por_id(articulo.id).nombre == "Olla"


def test_clave_foranea_invalida_falla(repos, fabrica):
    with pytest.raises(sqlite3.IntegrityError):
        repos.articulos.crear(fabrica.articulo(categoria_id=999))


def test_check_de_cantidad_negativa_falla(repos, fabrica):
    categoria = repos.categorias.crear(fabrica.categoria())
    articulo = repos.articulos.crear(fabrica.articulo(categoria.id))
    negativo = fabrica.articulo(
        categoria.id, id=articulo.id, cantidad_total=-1, cantidad_disponible=-1
    )
    with pytest.raises(sqlite3.IntegrityError):
        repos.articulos.actualizar_contadores(negativo)


def test_like_con_comilla_simple_no_rompe(repos, fabrica):
    categoria = repos.categorias.crear(fabrica.categoria())
    repos.articulos.crear(fabrica.articulo(categoria.id, nombre="O'Reilly"))
    assert len(repos.articulos.buscar("O'Reilly")) == 1


def test_listado_de_10000_devuelve_una_pagina(repos, conn_migrada):
    conn_migrada.executemany(
        "INSERT INTO categoria (nombre, creado_en) VALUES (?, ?)",
        ((f"Categoria {i:05d}", "2026-01-01") for i in range(10000)),
    )
    assert repos.categorias.contar() == 10000
    assert len(repos.categorias.listar()) == 50


def test_servicio_con_repositorio_falso(fabrica):
    """Un consumidor puede depender de la interfaz: repositorio real o falso."""

    class RepositorioFalso:
        def __init__(self):
            self._datos: dict[int, Categoria] = {}
            self._siguiente = 1

        def crear(self, categoria):
            categoria = dataclasses.replace(categoria, id=self._siguiente)
            self._datos[self._siguiente] = categoria
            self._siguiente += 1
            return categoria

        def obtener_por_id(self, categoria_id):
            return self._datos.get(categoria_id)

    def registrar(repositorio, nombre):
        return repositorio.crear(fabrica.categoria(nombre=nombre))

    falso = RepositorioFalso()
    creada = registrar(falso, "Prueba")
    assert falso.obtener_por_id(creada.id).nombre == "Prueba"
