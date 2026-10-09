"""Arranque real de la aplicación: `python -m stocklend --check`."""

from __future__ import annotations

import os
import subprocess
import sys


def _ejecutar(tmp_path, datos):
    entorno = os.environ.copy()
    entorno["STOCKLEND_DATA_DIR"] = str(datos)
    entorno["PYTHONIOENCODING"] = "utf-8"
    return subprocess.run(
        [sys.executable, "-m", "stocklend", "--check"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=entorno,
        cwd=str(tmp_path),
        check=False,
    )


def test_check_arranca_contra_una_base_temporal(tmp_path):
    datos = tmp_path / "datos"
    resultado = _ejecutar(tmp_path, datos)

    assert resultado.returncode == 0, resultado.stderr
    assert "user_version=1" in resultado.stdout
    assert "foreign_keys=1" in resultado.stdout
    assert (datos / "stocklend.sqlite").exists()


def test_segunda_ejecucion_no_vuelve_a_migrar(tmp_path):
    datos = tmp_path / "datos"
    primera = _ejecutar(tmp_path, datos)
    segunda = _ejecutar(tmp_path, datos)

    assert primera.returncode == 0, primera.stderr
    assert segunda.returncode == 0, segunda.stderr
    assert "migraciones aplicadas" in primera.stdout
    assert "migraciones aplicadas" not in segunda.stdout
