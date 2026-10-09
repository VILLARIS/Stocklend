"""Migraciones: esquema completo, orden, idempotencia, atomicidad y copias previas."""

from __future__ import annotations

import shutil
import sqlite3

import pytest

from stocklend.data import database, migrator
from stocklend.data.migrator import MIGRATIONS_DIR

TABLAS = {
    "categoria",
    "articulo",
    "estudiante",
    "prestamo",
    "prestamo_detalle",
    "articulo_unidad",
    "devolucion",
    "devolucion_detalle",
    "incidente",
    "movimiento_inventario",
    "configuracion",
}
VISTAS = {"v_prestamo_detalle", "v_prestamo_resumen"}
INDICES = {
    "ix_articulo_nombre",
    "ix_articulo_categoria",
    "ix_articulo_unidad_articulo",
    "ix_articulo_unidad_prestamo",
    "ix_estudiante_apellidos",
    "ix_prestamo_estudiante",
    "ix_prestamo_estado_fecha",
    "ix_prestamo_fecha",
    "ix_prestamo_detalle_articulo",
    "ix_devolucion_prestamo",
    "ix_devolucion_fecha",
    "ix_incidente_estado",
    "ix_incidente_articulo",
}


def _objetos(conn, tipo):
    filas = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%'",
        (tipo,),
    )
    return {fila[0] for fila in filas}


def _directorio_con(directory, nombres):
    directory.mkdir(parents=True, exist_ok=True)
    for nombre in nombres:
        shutil.copy(MIGRATIONS_DIR / nombre, directory / nombre)
    return directory


def test_migracion_crea_esquema_completo(conn):
    aplicadas = migrator.migrate(conn)
    assert aplicadas == [1]
    assert migrator.current_version(conn) == 1
    assert _objetos(conn, "table") == TABLAS
    assert _objetos(conn, "view") == VISTAS
    assert _objetos(conn, "index") == INDICES
    assert conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    assert conn.execute("PRAGMA foreign_key_check").fetchall() == []


def test_user_version_persiste_al_reabrir(tmp_path):
    ruta = tmp_path / "reabrir.sqlite"
    conn1 = database.connect(ruta)
    migrator.migrate(conn1)
    conn1.close()

    conn2 = database.connect(ruta)
    try:
        assert migrator.current_version(conn2) == 1
        assert migrator.migrate(conn2) == []
        assert len(_objetos(conn2, "table")) == 11
    finally:
        conn2.close()


def test_abrir_y_cerrar_no_recrea_la_base(tmp_path):
    ruta = tmp_path / "persistente.sqlite"
    conn1 = database.connect(ruta)
    migrator.migrate(conn1)
    conn1.execute(
        "INSERT INTO categoria (nombre, creado_en) VALUES (?, ?)",
        ("Utensilios", "2026-01-01"),
    )
    conn1.close()

    conn2 = database.connect(ruta)
    try:
        assert migrator.migrate(conn2) == []
        nombres = [fila[0] for fila in conn2.execute("SELECT nombre FROM categoria")]
        assert nombres == ["Utensilios"]
        assert len(_objetos(conn2, "table")) == 11
    finally:
        conn2.close()


def test_las_migraciones_se_aplican_en_orden_ascendente(conn, tmp_path):
    directory = tmp_path / "migraciones"
    directory.mkdir()
    (directory / "0001_alpha.sql").write_text("CREATE TABLE alpha(x INTEGER);", encoding="utf-8")
    (directory / "0002_beta.sql").write_text("CREATE TABLE beta(x INTEGER);", encoding="utf-8")

    aplicadas = migrator.migrate(conn, directory=directory)
    assert aplicadas == [1, 2]
    assert migrator.current_version(conn) == 2
    assert {"alpha", "beta"} <= _objetos(conn, "table")


def test_solo_se_aplican_las_versiones_superiores(conn, tmp_path):
    directory = tmp_path / "migraciones"
    directory.mkdir()
    (directory / "0001_alpha.sql").write_text("CREATE TABLE alpha(x INTEGER);", encoding="utf-8")
    assert migrator.migrate(conn, directory=directory) == [1]

    (directory / "0002_beta.sql").write_text("CREATE TABLE beta(x INTEGER);", encoding="utf-8")
    assert migrator.migrate(conn, directory=directory) == [2]
    assert migrator.current_version(conn) == 2


def test_migracion_fallida_no_deja_cambios(conn, tmp_path):
    directory = _directorio_con(tmp_path / "migraciones", ["0001_inicial.sql"])
    (directory / "0002_rota.sql").write_text(
        "CREATE TABLE rota(x INTEGER);\nSENTENCIA INVALIDA;\n", encoding="utf-8"
    )

    with pytest.raises(sqlite3.Error):
        migrator.migrate(conn, directory=directory)

    assert migrator.current_version(conn) == 1
    assert TABLAS <= _objetos(conn, "table")
    assert "rota" not in _objetos(conn, "table")


def test_copia_de_seguridad_previa_a_migrar(conn, tmp_path):
    migrator.migrate(conn)
    conn.execute(
        "INSERT INTO categoria (nombre, creado_en) VALUES (?, ?)",
        ("Utensilios", "2026-01-01"),
    )

    directory = _directorio_con(tmp_path / "migraciones", ["0001_inicial.sql"])
    (directory / "0002_nueva.sql").write_text("CREATE TABLE nueva(x INTEGER);", encoding="utf-8")
    backup_dir = tmp_path / "respaldos"

    aplicadas = migrator.migrate(conn, directory=directory, backup_dir=backup_dir)
    assert aplicadas == [2]

    copias = list(backup_dir.glob("respaldo_migracion_*.sqlite"))
    assert len(copias) == 1
    copia = sqlite3.connect(copias[0])
    try:
        nombres = [fila[0] for fila in copia.execute("SELECT nombre FROM categoria")]
        assert nombres == ["Utensilios"]
        assert int(copia.execute("PRAGMA user_version").fetchone()[0]) == 1
    finally:
        copia.close()


def test_no_se_regraza_a_versiones_anteriores(conn):
    conn.execute("PRAGMA user_version = 5")
    assert migrator.migrate(conn) == []
    assert migrator.current_version(conn) == 5
