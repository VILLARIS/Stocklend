"""Resolución de rutas de datos (ARCHITECTURE §8.1, estructura §5).

Orden de resolución, sin depender nunca del directorio de trabajo actual:

1. La variable de entorno ``STOCKLEND_DATA_DIR`` (la usan las pruebas).
2. Aplicación congelada (PyInstaller): ``%LOCALAPPDATA%\\StockLend``.
3. Desarrollo: ``<repo>/data`` y ``<repo>/logs``.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from .constants import (
    APP_DIR_NAME,
    CONFIG_FILENAME,
    DB_FILENAME,
    LOG_FILENAME,
    REGISTROS_DIRNAME,
    RESPALDOS_DIRNAME,
)

ENV_DATA_DIR = "STOCKLEND_DATA_DIR"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def _env_override() -> Path | None:
    valor = os.environ.get(ENV_DATA_DIR)
    if valor:
        return Path(valor)
    return None


def data_dir() -> Path:
    override = _env_override()
    if override is not None:
        return override
    if is_frozen():
        base = os.environ.get("LOCALAPPDATA")
        return (Path(base) if base else Path.home()) / APP_DIR_NAME
    return _repo_root() / "data"


def db_path() -> Path:
    return data_dir() / DB_FILENAME


def config_path() -> Path:
    return data_dir() / CONFIG_FILENAME


def respaldos_dir() -> Path:
    return data_dir() / RESPALDOS_DIRNAME


def log_dir() -> Path:
    if _env_override() is not None or is_frozen():
        return data_dir() / REGISTROS_DIRNAME
    return _repo_root() / "logs"


def log_file() -> Path:
    return log_dir() / LOG_FILENAME


def ensure_data_dirs() -> None:
    data_dir().mkdir(parents=True, exist_ok=True)
    respaldos_dir().mkdir(parents=True, exist_ok=True)
    log_dir().mkdir(parents=True, exist_ok=True)
