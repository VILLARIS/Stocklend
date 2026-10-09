"""Paginación: los listados nunca devuelven la tabla completa (Etapa 2)."""

from __future__ import annotations

import pytest


def _poblar(conn_migrada, cuantas=10000):
    conn_migrada.executemany(
        "INSERT INTO categoria (nombre, creado_en) VALUES (?, ?)",
        ((f"Categoria {i:05d}", "2026-01-01") for i in range(cuantas)),
    )


def test_listado_devuelve_una_pagina_no_todo(repos, conn_migrada):
    _poblar(conn_migrada)
    assert repos.categorias.contar() == 10000
    assert len(repos.categorias.listar()) == 50
    assert len(repos.categorias.listar(limite=10)) == 10
    assert len(repos.categorias.listar(limite=1000)) == 1000


def test_paginas_consecutivas_no_se_solapan(repos, conn_migrada):
    _poblar(conn_migrada, 100)
    primera = repos.categorias.listar(limite=10)
    segunda = repos.categorias.listar(limite=10, desplazamiento=10)
    assert len(primera) == len(segunda) == 10
    assert {c.id for c in primera}.isdisjoint({c.id for c in segunda})


@pytest.mark.parametrize(
    ("limite", "desplazamiento"),
    [(0, 0), (-1, 0), (1, -1), (1001, 0)],
)
def test_parametros_de_paginacion_invalidos(repos, limite, desplazamiento):
    with pytest.raises(ValueError):
        repos.categorias.listar(limite=limite, desplazamiento=desplazamiento)
