"""Rutas de datos (ARCHITECTURE §8.1): resolución por entorno, congelado o repo."""

from __future__ import annotations

from pathlib import Path

import stocklend
from stocklend.core import paths


def _raiz_repo() -> Path:
    return Path(stocklend.__file__).resolve().parents[1]


def test_variable_de_entorno_toma_prioridad(monkeypatch, tmp_path):
    monkeypatch.setenv(paths.ENV_DATA_DIR, str(tmp_path / "datos"))
    assert paths.data_dir() == tmp_path / "datos"
    assert paths.db_path() == tmp_path / "datos" / "stocklend.sqlite"
    assert paths.config_path() == tmp_path / "datos" / "config.ini"
    assert paths.respaldos_dir() == tmp_path / "datos" / "respaldos"
    assert paths.log_dir() == tmp_path / "datos" / "registros"


def test_en_desarrollo_usa_el_repo_y_no_el_cwd(monkeypatch, tmp_path):
    monkeypatch.delenv(paths.ENV_DATA_DIR, raising=False)
    esperado = _raiz_repo() / "data"
    monkeypatch.chdir(tmp_path)
    assert paths.data_dir() == esperado
    assert paths.data_dir().is_absolute()
    assert paths.log_dir() == _raiz_repo() / "logs"
    assert paths.log_dir().is_absolute()


def test_no_depende_del_directorio_de_trabajo(monkeypatch, tmp_path):
    monkeypatch.setenv(paths.ENV_DATA_DIR, str(tmp_path / "datos"))
    primero = paths.db_path()
    monkeypatch.chdir(tmp_path)
    assert paths.db_path() == primero


def test_ensure_data_dirs_crea_las_carpetas(monkeypatch, tmp_path):
    monkeypatch.setenv(paths.ENV_DATA_DIR, str(tmp_path / "datos"))
    paths.ensure_data_dirs()
    assert (tmp_path / "datos").is_dir()
    assert (tmp_path / "datos" / "respaldos").is_dir()
    assert (tmp_path / "datos" / "registros").is_dir()
