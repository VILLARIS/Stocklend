"""Registro en disco con rotación (ARCHITECTURE §9: 5 MB × 5, UTF-8)."""

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from . import paths
from .constants import LOG_BACKUP_COUNT, LOG_MAX_BYTES

_FORMATO = "%(asctime)s %(levelname)s %(name)s: %(message)s"
_FECHA = "%Y-%m-%d %H:%M:%S"
_LOGGER_ROOT = "stocklend"


def setup_logging(
    level: int = logging.INFO,
    *,
    console_level: int = logging.WARNING,
    log_file: Path | None = None,
) -> logging.Logger:
    """Prepara el logger raíz del paquete. Es idempotente."""
    logger = logging.getLogger(_LOGGER_ROOT)
    logger.setLevel(level)
    logger.propagate = False
    for handler in list(logger.handlers):
        logger.removeHandler(handler)
        handler.close()

    destino = log_file if log_file is not None else paths.log_file()
    destino.parent.mkdir(parents=True, exist_ok=True)
    formato = logging.Formatter(_FORMATO, _FECHA)

    archivo = RotatingFileHandler(
        destino,
        maxBytes=LOG_MAX_BYTES,
        backupCount=LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    archivo.setLevel(level)
    archivo.setFormatter(formato)
    logger.addHandler(archivo)

    consola = logging.StreamHandler(sys.stderr)
    consola.setLevel(console_level)
    consola.setFormatter(formato)
    logger.addHandler(consola)

    logger.debug("registro preparado en %s", destino)
    return logger
