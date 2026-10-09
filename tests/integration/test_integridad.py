"""Garantías de integridad en la base: claves foráneas, CHECK y RN-02 (§9.4)."""

from __future__ import annotations

import sqlite3

import pytest

from stocklend.data.database import transaction


def _insertar_renglon(conn, datos, articulo_id, estado, prestada, devuelta=0, daniada=0, perdida=0):
    conn.execute(
        "INSERT INTO prestamo_detalle (prestamo_id, articulo_id, cantidad_prestada,"
        " cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        (datos["prestamo"], articulo_id, prestada, devuelta, daniada, perdida, estado),
    )


def test_fk_rechaza_estudiante_inexistente(conn_migrada):
    with pytest.raises(sqlite3.IntegrityError, match="FOREIGN KEY"):
        conn_migrada.execute(
            "INSERT INTO prestamo (folio, estudiante_id, fecha_prestamo, estado, creado_en)"
            " VALUES (?, ?, ?, ?, ?)",
            ("PRE-2026-999999", 999999, "2026-01-02", "activo", "2026-01-02"),
        )


def test_fk_restringe_borrar_estudiante_referenciado(datos_previos, conn_migrada):
    with pytest.raises(sqlite3.IntegrityError, match="FOREIGN KEY"):
        conn_migrada.execute("DELETE FROM estudiante WHERE id = ?", (datos_previos["estudiante"],))


def test_check_rechaza_contador_negativo(crear_articulo, datos_previos, conn_migrada):
    articulo = crear_articulo(datos_previos["categoria"], total=5, disponible=5)
    with pytest.raises(sqlite3.IntegrityError, match="cantidad_disponible"):
        conn_migrada.execute(
            "UPDATE articulo SET cantidad_disponible = -1 WHERE id = ?", (articulo,)
        )


def test_rn02_rechaza_fila_descuadrada(crear_articulo, datos_previos):
    with pytest.raises(sqlite3.IntegrityError, match="cantidad_total"):
        crear_articulo(datos_previos["categoria"], nombre="Descuadrada", total=5, disponible=4)


def test_rn02_rechaza_actualizacion_parcial(crear_articulo, datos_previos, conn_migrada):
    articulo = crear_articulo(datos_previos["categoria"], total=5, disponible=5)
    with pytest.raises(sqlite3.IntegrityError, match="cantidad_total"):
        conn_migrada.execute(
            "UPDATE articulo SET cantidad_disponible = 4 WHERE id = ?", (articulo,)
        )


def test_rn02_no_bloquea_operaciones_validas(crear_articulo, datos_previos, conn_migrada):
    categoria = datos_previos["categoria"]
    with transaction(conn_migrada):
        articulo = crear_articulo(categoria, nombre="Olla", total=5, disponible=5)
        conn_migrada.execute(
            "INSERT INTO movimiento_inventario (articulo_id, tipo, cantidad,"
            " cantidad_resultante_total, cantidad_resultante_disponible, motivo, fecha)"
            " VALUES (?, 'alta', 5, 5, 5, 'Alta inicial', '2026-01-01')",
            (articulo,),
        )

    with transaction(conn_migrada):
        conn_migrada.execute(
            "UPDATE articulo SET cantidad_disponible = 3, cantidad_prestada = 2,"
            " actualizado_en = ? WHERE id = ?",
            ("2026-01-02", articulo),
        )

    with transaction(conn_migrada):
        conn_migrada.execute(
            "UPDATE articulo SET cantidad_prestada = 1, cantidad_daniada = 1,"
            " actualizado_en = ? WHERE id = ?",
            ("2026-01-03", articulo),
        )

    with transaction(conn_migrada):
        conn_migrada.execute(
            "UPDATE articulo SET cantidad_disponible = 2, cantidad_faltante = 1,"
            " actualizado_en = ? WHERE id = ?",
            ("2026-01-04", articulo),
        )

    fila = conn_migrada.execute(
        "SELECT cantidad_total, cantidad_disponible, cantidad_prestada,"
        " cantidad_daniada, cantidad_faltante FROM articulo WHERE id = ?",
        (articulo,),
    ).fetchone()
    assert tuple(fila) == (5, 2, 1, 1, 1)


@pytest.mark.parametrize(
    ("estado", "prestada", "devuelta", "daniada", "perdida"),
    [
        ("pendiente", 5, 0, 0, 0),
        ("parcial", 5, 3, 0, 0),
        ("devuelto", 5, 5, 0, 0),
        ("con_incidente", 5, 4, 1, 0),
        ("con_incidente", 5, 3, 0, 2),
        ("con_incidente", 5, 0, 2, 0),
    ],
)
def test_estados_validos_del_renglon_son_aceptados(
    datos_previos, crear_articulo, conn_migrada, estado, prestada, devuelta, daniada, perdida
):
    articulo = crear_articulo(datos_previos["categoria"], total=1)
    _insertar_renglon(
        conn_migrada, datos_previos, articulo, estado, prestada, devuelta, daniada, perdida
    )


@pytest.mark.parametrize(
    ("estado", "prestada", "devuelta", "daniada", "perdida"),
    [
        ("pendiente", 5, 1, 0, 0),
        ("devuelto", 5, 4, 0, 0),
        ("parcial", 5, 0, 0, 0),
        ("devuelto", 5, 5, 1, 0),
        ("regresado", 5, 0, 0, 0),
    ],
)
def test_estados_incoherentes_son_rechazados(
    datos_previos, crear_articulo, conn_migrada, estado, prestada, devuelta, daniada, perdida
):
    articulo = crear_articulo(datos_previos["categoria"], total=1)
    with pytest.raises(sqlite3.IntegrityError):
        _insertar_renglon(
            conn_migrada, datos_previos, articulo, estado, prestada, devuelta, daniada, perdida
        )


def test_devolucion_en_exceso_no_corresponde_a_ningun_estado(
    datos_previos, crear_articulo, conn_migrada
):
    articulo = crear_articulo(datos_previos["categoria"], total=3)
    with pytest.raises(sqlite3.IntegrityError):
        _insertar_renglon(conn_migrada, datos_previos, articulo, "devuelto", 3, devuelta=4)


def test_unidad_prestada_requiere_renglon(datos_previos, crear_articulo, conn_migrada):
    articulo = crear_articulo(
        datos_previos["categoria"], total=1, disponible=1, control_individual=1
    )
    with pytest.raises(sqlite3.IntegrityError):
        conn_migrada.execute(
            "INSERT INTO articulo_unidad (articulo_id, codigo, estado, creado_en, actualizado_en)"
            " VALUES (?, 'LIC-001', 'prestada', '2026-01-01', '2026-01-01')",
            (articulo,),
        )


def test_unidad_disponible_sin_renglon_es_aceptada(datos_previos, crear_articulo, conn_migrada):
    articulo = crear_articulo(
        datos_previos["categoria"], total=1, disponible=1, control_individual=1
    )
    conn_migrada.execute(
        "INSERT INTO articulo_unidad (articulo_id, codigo, estado, creado_en, actualizado_en)"
        " VALUES (?, 'LIC-001', 'disponible', '2026-01-01', '2026-01-01')",
        (articulo,),
    )


def test_incidente_no_atribuye_al_estudiante_sin_registro(
    datos_previos, crear_articulo, conn_migrada
):
    articulo = crear_articulo(datos_previos["categoria"], total=1)
    with pytest.raises(sqlite3.IntegrityError):
        conn_migrada.execute(
            "INSERT INTO incidente (tipo, origen, articulo_id, responsabilidad, cantidad,"
            " descripcion, creado_en) VALUES ('perdida', 'stock', ?, 'estudiante', 1,"
            " 'No aparece', '2026-01-01')",
            (articulo,),
        )


def test_movimiento_rechaza_motivo_vacio(datos_previos, crear_articulo, conn_migrada):
    articulo = crear_articulo(datos_previos["categoria"], total=1, disponible=1)
    with pytest.raises(sqlite3.IntegrityError):
        conn_migrada.execute(
            "INSERT INTO movimiento_inventario (articulo_id, tipo, cantidad,"
            " cantidad_resultante_total, cantidad_resultante_disponible, motivo, fecha)"
            " VALUES (?, 'ajuste_negativo', 1, 1, 0, '   ', '2026-01-01')",
            (articulo,),
        )


def test_movimiento_rechaza_cantidad_no_positiva(datos_previos, crear_articulo, conn_migrada):
    articulo = crear_articulo(datos_previos["categoria"], total=1, disponible=1)
    with pytest.raises(sqlite3.IntegrityError):
        conn_migrada.execute(
            "INSERT INTO movimiento_inventario (articulo_id, tipo, cantidad,"
            " cantidad_resultante_total, cantidad_resultante_disponible, motivo, fecha)"
            " VALUES (?, 'ajuste_negativo', 0, 1, 0, 'Sin unidades', '2026-01-01')",
            (articulo,),
        )


def test_categoria_distinta_en_minusculas_es_rechazada(conn_migrada):
    conn_migrada.execute(
        "INSERT INTO categoria (nombre, creado_en) VALUES (?, ?)",
        ("Utensilios", "2026-01-01"),
    )
    with pytest.raises(sqlite3.IntegrityError):
        conn_migrada.execute(
            "INSERT INTO categoria (nombre, creado_en) VALUES (?, ?)",
            ("utensilios", "2026-01-01"),
        )
