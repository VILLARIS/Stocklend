"""Preferencias locales en ``config.ini`` (configparser, sin dependencias externas)."""

from __future__ import annotations

import configparser
from pathlib import Path

from . import paths


class Config:
    """Lectura y escritura del archivo de configuración de la aplicación."""

    def __init__(self, path: Path | None = None) -> None:
        self._path = path if path is not None else paths.config_path()
        self._parser = configparser.ConfigParser()
        self._dirty = False

    @property
    def path(self) -> Path:
        return self._path

    def load(self) -> None:
        if self._path.exists():
            self._parser.read(self._path, encoding="utf-8")
        self._dirty = False

    def get(self, section: str, key: str, fallback: str | None = None) -> str | None:
        return self._parser.get(section, key, fallback=fallback)

    def get_int(self, section: str, key: str, fallback: int | None = None) -> int | None:
        valor = self._parser.get(section, key, fallback=None)
        if valor is None:
            return fallback
        return int(valor)

    def get_bool(self, section: str, key: str, fallback: bool | None = None) -> bool | None:
        valor = self._parser.get(section, key, fallback=None)
        if valor is None:
            return fallback
        clave = valor.strip().lower()
        if clave not in configparser.ConfigParser.BOOLEAN_STATES:
            raise ValueError(f"valor booleano inválido en [{section}] {key}: {valor!r}")
        return configparser.ConfigParser.BOOLEAN_STATES[clave]

    def set(self, section: str, key: str, value: object) -> None:
        if not self._parser.has_section(section):
            self._parser.add_section(section)
        self._parser.set(section, key, str(value))
        self._dirty = True

    def save(self) -> None:
        if not self._dirty:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temporal = self._path.with_name(self._path.name + ".tmp")
        with temporal.open("w", encoding="utf-8") as archivo:
            self._parser.write(archivo)
        temporal.replace(self._path)
        self._dirty = False
