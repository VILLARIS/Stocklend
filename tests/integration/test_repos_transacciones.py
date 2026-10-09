"""Transacciones: varios repositorios comparten una conexión y una transacción."""

from __future__ import annotations

import sqlite3

import pytest

from stocklend.data import database


def test_varios_repositorios_en_una_transaccion(repos, conn_migrada, fabrica):
    with database.transaction(conn_migrada):
        categoria = repos.categorias.crear(fabrica.categoria())
        repos.estudiantes.crear(fabrica.estudiante())
        repos.articulos.crear(fabrica.articulo(categoria.id))

    assert repos.categorias.contar() == 1
    assert repos.estudiantes.contar() == 1
    assert repos.articulos.contar() == 1
    assert conn_migrada.in_transaction is False


def test_rollback_completo_ante_error(repos, conn_migrada, fabrica):
    with pytest.raises(sqlite3.IntegrityError):
        with database.transaction(conn_migrada):
            repos.categorias.crear(fabrica.categoria(nombre="Primera"))
            repos.estudiantes.crear(fabrica.estudiante())
            repos.articulos.crear(fabrica.articulo(categoria_id=999))

    assert repos.categorias.contar() == 0
    assert repos.estudiantes.contar() == 0
    assert conn_migrada.in_transaction is False


def test_los_repositorios_no_hacen_commit(repos, conn_migrada, fabrica):
    with database.transaction(conn_migrada):
        repos.categorias.crear(fabrica.categoria())
        assert conn_migrada.in_transaction is True
    assert conn_migrada.in_transaction is False


def test_la_conexion_sigue_util_tras_el_error(repos, conn_migrada, fabrica):
    with pytest.raises(sqlite3.IntegrityError):
        repos.articulos.crear(fabrica.articulo(categoria_id=999))
    assert repos.categorias.crear(fabrica.categoria()).id is not None
