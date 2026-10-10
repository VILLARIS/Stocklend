"""Casos de uso de inventario (RN-01, RN-02, RN-05, RN-06, RN-09, RN-10, RN-47, RN-60)."""

from __future__ import annotations

import pytest
from _reconciliacion import discrepancias_contadores, discrepancias_unidades

from stocklend.domain import (
    CantidadInsuficienteError,
    NoEncontradoError,
    ReglaNegocioError,
    TipoMovimiento,
    ValidacionError,
)


def _categoria(servicios, nombre="Utensilios"):
    return servicios.inventario.registrar_categoria(nombre)


def test_registrar_categoria_nombre_unico_y_obligatorio(servicios):
    categoria = _categoria(servicios)
    assert categoria.id is not None
    with pytest.raises(ReglaNegocioError):  # RN-10
        servicios.inventario.registrar_categoria("utensilios")
    with pytest.raises(ValidacionError):  # RN-10
        servicios.inventario.registrar_categoria("   ")


def test_registrar_articulo_genera_movimiento_alta(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = servicios.inventario.registrar_articulo(
        "Olla", categoria.id, cantidad_inicial=5
    )
    assert (articulo.cantidad_total, articulo.cantidad_disponible) == (5, 5)
    movimientos = servicios.inventario.listar_movimientos(articulo.id)
    assert len(movimientos) == 1
    assert movimientos[0].tipo is TipoMovimiento.ALTA
    assert movimientos[0].cantidad == 5
    assert articulo.id not in {f["id"] for f in discrepancias_contadores(conn_migrada)}


def test_registrar_articulo_sin_cantidad_no_genera_movimiento(servicios):
    categoria = _categoria(servicios)
    articulo = servicios.inventario.registrar_articulo("Escoba", categoria.id)
    assert articulo.cantidad_total == 0
    assert servicios.inventario.listar_movimientos(articulo.id) == []


def test_articulo_nombre_obligatorio_y_unico_por_categoria(servicios):
    categoria = _categoria(servicios)
    servicios.inventario.registrar_articulo("Olla", categoria.id)
    with pytest.raises(ReglaNegocioError):  # RN-09
        servicios.inventario.registrar_articulo("olla", categoria.id)
    with pytest.raises(ValidacionError):  # RN-09
        servicios.inventario.registrar_articulo("  ", categoria.id)
    with pytest.raises(NoEncontradoError):
        servicios.inventario.registrar_articulo("Olla", 999)


def test_articulo_control_individual_no_acepta_cantidad(servicios):
    categoria = _categoria(servicios)
    with pytest.raises(ReglaNegocioError):  # RN-50
        servicios.inventario.registrar_articulo(
            "Laptop", categoria.id, control_individual=True, cantidad_inicial=1
        )


def test_ajustar_cantidad_al_alza_y_baja(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = servicios.inventario.registrar_articulo(
        "Martillo", categoria.id, cantidad_inicial=2
    )
    articulo = servicios.inventario.ajustar_cantidad(articulo.id, 5, "Conteo físico")
    assert (articulo.cantidad_total, articulo.cantidad_disponible) == (5, 5)
    articulo = servicios.inventario.ajustar_cantidad(articulo.id, 3, "Conteo físico")
    assert (articulo.cantidad_total, articulo.cantidad_disponible) == (3, 3)
    assert discrepancias_contadores(conn_migrada) == []


def test_ajuste_sin_motivo_se_rechaza(servicios):
    categoria = _categoria(servicios)
    articulo = servicios.inventario.registrar_articulo("Sierra", categoria.id)
    with pytest.raises(ValidacionError):  # RN-05
        servicios.inventario.ajustar_cantidad(articulo.id, 4, "   ")


def test_ajuste_negativo_sin_disponible_se_rechaza_y_no_cambia_nada(
    servicios, repos, fabrica
):
    categoria = _categoria(servicios)
    articulo = servicios.inventario.registrar_articulo(
        "Taladro", categoria.id, cantidad_inicial=1
    )
    # Simula una unidad prestada: queda disponible 0.
    repos.articulos.actualizar_contadores(
        fabrica.articulo(
            id=articulo.id,
            categoria_id=categoria.id,
            cantidad_total=1,
            cantidad_disponible=0,
            cantidad_prestada=1,
        )
    )
    estado_antes = repos.articulos.obtener_por_id(articulo.id)
    movimientos_antes = repos.movimientos.contar_por_articulo(articulo.id)
    with pytest.raises(CantidadInsuficienteError):  # RN-06
        servicios.inventario.ajustar_cantidad(articulo.id, 0, "Baja de existencias")
    assert repos.articulos.obtener_por_id(articulo.id) == estado_antes  # no se modificó
    assert repos.movimientos.contar_por_articulo(articulo.id) == movimientos_antes


def test_ajuste_a_cero_sin_cambios_no_genera_movimiento(servicios):
    categoria = _categoria(servicios)
    articulo = servicios.inventario.registrar_articulo("Nivel", categoria.id)
    assert servicios.inventario.ajustar_cantidad(articulo.id, 0, "Sin cambios") == articulo
    assert servicios.inventario.listar_movimientos(articulo.id) == []


def test_ajustar_articulo_con_control_individual_se_rechaza(servicios):
    categoria = _categoria(servicios)
    articulo = servicios.inventario.registrar_articulo(
        "Proyector", categoria.id, control_individual=True
    )
    with pytest.raises(ReglaNegocioError):  # RN-61
        servicios.inventario.ajustar_cantidad(articulo.id, 1, "No aplica")


def test_danio_y_perdida_por_tipo_de_movimiento(servicios, conn_migrada):
    categoria = _categoria(servicios)
    articulo = servicios.inventario.registrar_articulo(
        "Balanza", categoria.id, cantidad_inicial=3
    )
    # RN-58, RN-59: el cubo de origen lo declara el tipo.
    articulo = servicios.inventario.aplicar_movimiento(
        articulo.id, TipoMovimiento.DANIO_DISPONIBLE, 1, "Se golpeó"
    )
    assert (articulo.cantidad_disponible, articulo.cantidad_daniada) == (2, 1)
    articulo = servicios.inventario.aplicar_movimiento(
        articulo.id, TipoMovimiento.PERDIDA_DISPONIBLE, 1, "Desapareció"
    )
    assert articulo.cantidad_total == 3  # RN-60
    assert (articulo.cantidad_disponible, articulo.cantidad_faltante) == (1, 1)
    assert discrepancias_contadores(conn_migrada) == []
    assert discrepancias_unidades(conn_migrada) == []


def test_aplicar_movimiento_cantidad_invalida(servicios):
    categoria = _categoria(servicios)
    articulo = servicios.inventario.registrar_articulo("Regla", categoria.id)
    with pytest.raises(ValidacionError):
        servicios.inventario.aplicar_movimiento(
            articulo.id, TipoMovimiento.ALTA, 0, "Motivo"
        )


def test_error_de_registro_se_corrige_con_ajuste(servicios):
    categoria = _categoria(servicios)
    articulo = servicios.inventario.registrar_articulo(
        "Cinta", categoria.id, cantidad_inicial=10
    )
    articulo = servicios.inventario.ajustar_cantidad(
        articulo.id, 8, "Se contaron 8, no 10 (RN-47)"
    )
    movimientos = servicios.inventario.listar_movimientos(articulo.id)
    assert [m.tipo for m in movimientos] == [
        TipoMovimiento.AJUSTE_NEGATIVO,
        TipoMovimiento.ALTA,
    ]


def test_editar_articulo_no_toca_contadores(servicios):
    categoria = _categoria(servicios)
    articulo = servicios.inventario.registrar_articulo(
        "Llave", categoria.id, cantidad_inicial=4, codigo="LL-1"
    )
    editado = servicios.inventario.editar_articulo(
        articulo.id, nombre="Llave inglesa", notas="Nueva"
    )
    assert editado.nombre == "Llave inglesa"
    assert editado.notas == "Nueva"
    assert editado.cantidad_disponible == 4
    assert editado.codigo == "LL-1"


def test_buscar_y_listar_articulos(servicios):
    categoria = _categoria(servicios)
    servicios.inventario.registrar_articulo("Martillo", categoria.id)
    servicios.inventario.registrar_articulo("Mazo", categoria.id, codigo="MZ-1")
    assert [a.nombre for a in servicios.inventario.buscar_articulos("maz")] == ["Mazo"]
    assert servicios.inventario.buscar_articulos("Utensilios")  # por categoría
    assert len(servicios.inventario.listar_articulos()) == 2


def test_resumen_inventario_base_vacia(servicios):
    resumen = servicios.inventario.resumen()
    assert (resumen.articulos, resumen.unidades_total) == (0, 0)
    assert (resumen.disponibles, resumen.prestadas) == (0, 0)


def test_resumen_inventario_agrega_contadores_reales(servicios):
    categoria = _categoria(servicios)
    servicios.inventario.registrar_articulo("Olla", categoria.id, cantidad_inicial=5)
    servicios.inventario.registrar_articulo("Sartén", categoria.id, cantidad_inicial=3)
    resumen = servicios.inventario.resumen()
    assert resumen.articulos == 2
    assert resumen.unidades_total == 8
    assert resumen.disponibles == 8
    assert resumen.prestadas == 0


def test_resumen_inventario_refleja_movimientos(servicios):
    categoria = _categoria(servicios)
    articulo = servicios.inventario.registrar_articulo(
        "Cinta", categoria.id, cantidad_inicial=4
    )
    servicios.inventario.aplicar_movimiento(
        articulo.id, TipoMovimiento.PRESTAMO, 2, "Préstamo de prueba"
    )
    resumen = servicios.inventario.resumen()
    assert resumen.unidades_total == 4
    assert resumen.disponibles == 2
    assert resumen.prestadas == 2
