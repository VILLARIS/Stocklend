"""Reconciliación contra el libro de movimientos (RN-49, RN-61, DATABASE_DESIGN §8.6)."""

from __future__ import annotations

import random

from _reconciliacion import discrepancias_contadores, discrepancias_unidades

from stocklend.domain import CantidadInsuficienteError, EstadoUnidad, TipoMovimiento

_TIPOS = list(TipoMovimiento)


def test_reconciliacion_tras_operaciones_aleatorias(servicios, conn_migrada):
    categoria = servicios.inventario.registrar_categoria("Varios")
    articulo = servicios.inventario.registrar_articulo(
        "Caja", categoria.id, cantidad_inicial=200
    )
    rng = random.Random(20260101)
    exitosas = 0
    for _ in range(50):
        tipo = rng.choice(_TIPOS)
        cantidad = rng.randint(1, 4)
        try:
            servicios.inventario.aplicar_movimiento(
                articulo.id, tipo, cantidad, f"Operación {tipo.value}"
            )
        except CantidadInsuficienteError:
            continue
        exitosas += 1
    assert exitosas > 0
    assert discrepancias_contadores(conn_migrada) == []


def test_reconciliacion_de_unidades_tras_secuencia(servicios, conn_migrada):
    categoria = servicios.inventario.registrar_categoria("Equipos")
    articulo = servicios.inventario.registrar_articulo(
        "Tableta", categoria.id, control_individual=True
    )
    unidades = servicios.unidades.registrar_unidades(
        articulo.id, [f"TAB-{i:02d}" for i in range(1, 6)]
    )
    servicios.unidades.cambiar_estado(unidades[0].id, EstadoUnidad.DANADA, "Roto")
    servicios.unidades.cambiar_estado(unidades[1].id, EstadoUnidad.FALTANTE, "Perdido")
    servicios.unidades.cambiar_estado(unidades[2].id, EstadoUnidad.DANADA, "Roto")
    servicios.unidades.cambiar_estado(unidades[2].id, EstadoUnidad.BAJA, "Desechado")

    assert discrepancias_unidades(conn_migrada) == []
    assert discrepancias_contadores(conn_migrada) == []
    articulo = servicios.inventario.obtener_articulo(articulo.id)
    assert articulo.cantidad_total == 4
    assert articulo.cantidad_daniada == 1
    assert articulo.cantidad_faltante == 1
    assert articulo.cantidad_disponible == 2
