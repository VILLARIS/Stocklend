"""Fixtures compartidas: entorno aislado, conexiones temporales y datos mínimos."""

from __future__ import annotations

import os

import pytest

from stocklend.data import database, migrator


@pytest.fixture(scope="session", autouse=True)
def _entorno_aislado(tmp_path_factory: pytest.TempPathFactory):
    """Ninguna prueba toca datos reales: STOCKLEND_DATA_DIR apunta a un temporal."""
    raiz = tmp_path_factory.mktemp("stocklend_datos")
    anterior = os.environ.get("STOCKLEND_DATA_DIR")
    os.environ["STOCKLEND_DATA_DIR"] = str(raiz)
    yield
    if anterior is None:
        os.environ.pop("STOCKLEND_DATA_DIR", None)
    else:
        os.environ["STOCKLEND_DATA_DIR"] = anterior


@pytest.fixture
def conn(tmp_path):
    conexion = database.connect(tmp_path / "prueba.sqlite")
    yield conexion
    conexion.close()


@pytest.fixture
def conn_migrada(conn):
    migrator.migrate(conn)
    return conn


@pytest.fixture
def datos_previos(conn_migrada):
    """Categoría, estudiante y préstamo mínimos para las pruebas de integridad."""
    categoria = conn_migrada.execute(
        "INSERT INTO categoria (nombre, creado_en) VALUES (?, ?)",
        ("Utensilios", "2026-01-01"),
    ).lastrowid
    estudiante = conn_migrada.execute(
        "INSERT INTO estudiante (codigo_universitario, nombres, apellidos,"
        " creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?)",
        ("U100", "Ana", "Pérez", "2026-01-01", "2026-01-01"),
    ).lastrowid
    prestamo = conn_migrada.execute(
        "INSERT INTO prestamo (folio, estudiante_id, fecha_prestamo, estado, creado_en)"
        " VALUES (?, ?, ?, ?, ?)",
        ("PRE-2026-000001", estudiante, "2026-01-02", "activo", "2026-01-02"),
    ).lastrowid
    return {"categoria": categoria, "estudiante": estudiante, "prestamo": prestamo}


def insertar_articulo(conn, categoria_id, nombre="Olla", control_individual=0, **contadores):
    valores = {
        "total": 0,
        "disponible": None,
        "prestada": 0,
        "daniada": 0,
        "faltante": 0,
    }
    valores.update(contadores)
    if valores["disponible"] is None:
        valores["disponible"] = (
            valores["total"] - valores["prestada"] - valores["daniada"] - valores["faltante"]
        )
    return conn.execute(
        "INSERT INTO articulo (nombre, categoria_id, control_individual, creado_en,"
        " actualizado_en, cantidad_total, cantidad_disponible, cantidad_prestada,"
        " cantidad_daniada, cantidad_faltante) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            nombre,
            categoria_id,
            control_individual,
            "2026-01-01",
            "2026-01-01",
            valores["total"],
            valores["disponible"],
            valores["prestada"],
            valores["daniada"],
            valores["faltante"],
        ),
    ).lastrowid


@pytest.fixture
def crear_articulo(conn_migrada):
    def _crear(categoria_id, **kwargs):
        return insertar_articulo(conn_migrada, categoria_id, **kwargs)

    return _crear
