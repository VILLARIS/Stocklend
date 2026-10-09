"""Configuración clave/valor con escritura *upsert*."""

from __future__ import annotations


def test_obtener_inexistente(repos):
    assert repos.configuracion.obtener("no-existe") is None
    assert repos.configuracion.obtener_entrada("no-existe") is None


def test_establecer_y_actualizar(repos):
    repos.configuracion.establecer("tema", "claro", "2026-01-01")
    assert repos.configuracion.obtener("tema") == "claro"

    repos.configuracion.establecer("tema", "oscuro", "2026-02-01")
    entrada = repos.configuracion.obtener_entrada("tema")
    assert entrada.valor == "oscuro"
    assert entrada.actualizado_en == "2026-02-01"
    assert repos.configuracion.contar() == 1


def test_listar_ordenado(repos):
    repos.configuracion.establecer("zeta", "1", "2026-01-01")
    repos.configuracion.establecer("alfa", "2", "2026-01-01")
    assert [e.clave for e in repos.configuracion.listar()] == ["alfa", "zeta"]
