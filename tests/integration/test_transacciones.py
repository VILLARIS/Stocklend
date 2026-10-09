"""Transacciones (DATABASE_DESIGN §9.1): BEGIN IMMEDIATE, commit y rollback."""

from __future__ import annotations

import pytest

from stocklend.data.database import transaction


@pytest.fixture
def demo(conn):
    conn.execute("CREATE TABLE demo (x INTEGER NOT NULL UNIQUE)")
    return conn


def _cuenta(conn) -> int:
    return conn.execute("SELECT count(*) FROM demo").fetchone()[0]


def test_transaccion_confirma_los_cambios(demo):
    with transaction(demo) as conn:
        conn.execute("INSERT INTO demo (x) VALUES (1)")
        assert conn.in_transaction
    assert _cuenta(demo) == 1


def test_transaccion_revoca_en_excepcion(demo):
    with pytest.raises(RuntimeError, match="falla deliberada"):
        with transaction(demo) as conn:
            conn.execute("INSERT INTO demo (x) VALUES (1)")
            raise RuntimeError("falla deliberada")
    assert _cuenta(demo) == 0
    assert not demo.in_transaction
    assert _cuenta(demo) == 0


def test_error_de_base_se_propaga_y_revoca(demo):
    with pytest.raises(Exception):
        with transaction(demo) as conn:
            conn.execute("INSERT INTO demo (x) VALUES (1)")
            conn.execute("INSERT INTO demo (x) VALUES (1)")
    assert _cuenta(demo) == 0
    assert not demo.in_transaction


def test_no_se_admite_transaccion_anidada(demo):
    with transaction(demo) as conn:
        with pytest.raises(RuntimeError, match="ya hay una transacción"):
            with transaction(conn):
                pass
    assert _cuenta(demo) == 0


def test_la_conexion_sigue_usable_tras_el_rollback(demo):
    with pytest.raises(RuntimeError):
        with transaction(demo) as conn:
            conn.execute("INSERT INTO demo (x) VALUES (7)")
            raise RuntimeError("fallo")
    assert _cuenta(demo) == 0
    with transaction(demo) as conn:
        conn.execute("INSERT INTO demo (x) VALUES (8)")
    assert _cuenta(demo) == 1
