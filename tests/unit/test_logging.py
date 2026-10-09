"""Registro en disco: rotación configurada, UTF-8 e idempotencia."""

from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler

from stocklend.core.logging_setup import setup_logging


def _escribir(logger: logging.Logger) -> None:
    logger.info("mensaje de prueba")


def test_escribe_en_el_archivo_especificado(tmp_path):
    destino = tmp_path / "registros" / "stocklend.log"
    logger = setup_logging(log_file=destino, console_level=logging.CRITICAL)
    _escribir(logger)
    for handler in logger.handlers:
        handler.flush()
    assert destino.exists()
    assert "mensaje de prueba" in destino.read_text(encoding="utf-8")


def test_setup_repetido_no_duplica_handlers(tmp_path):
    destino = tmp_path / "stocklend.log"
    logger = setup_logging(log_file=destino, console_level=logging.CRITICAL)
    cantidad = len(logger.handlers)
    logger = setup_logging(log_file=destino, console_level=logging.CRITICAL)
    assert len(logger.handlers) == cantidad
    assert cantidad == 2


def test_rotacion_esta_configurada(tmp_path):
    logger = setup_logging(log_file=tmp_path / "rotacion.log", console_level=logging.CRITICAL)
    archivos = [h for h in logger.handlers if isinstance(h, RotatingFileHandler)]
    assert len(archivos) == 1
    assert archivos[0].maxBytes == 5 * 1024 * 1024
    assert archivos[0].backupCount == 5
    assert archivos[0].encoding == "utf-8"


def test_por_defecto_escribe_en_logs_del_entorno(tmp_path, monkeypatch):
    from stocklend.core import paths

    monkeypatch.setenv(paths.ENV_DATA_DIR, str(tmp_path / "datos"))
    logger = setup_logging(console_level=logging.CRITICAL)
    _escribir(logger)
    for handler in logger.handlers:
        handler.flush()
    esperado = tmp_path / "datos" / "registros" / "stocklend.log"
    assert esperado.exists()
    assert "mensaje de prueba" in esperado.read_text(encoding="utf-8")
