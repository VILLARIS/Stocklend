"""Utilidades compartidas por los repositorios (paginación).

La paginación es obligatoria en las consultas de listado (ARCHITECTURE §3.2,
DEVELOPMENT_PLAN Etapa 2): ninguna lectura que alimente una tabla devuelve la tabla
completa. ``LIMITE_MAXIMO`` evita que un llamador desactive la paginación por error.
"""

from __future__ import annotations

LIMITE_POR_DEFECTO = 50
LIMITE_MAXIMO = 1000


def validar_pagina(limite: int, desplazamiento: int) -> tuple[int, int]:
    """Valida los parámetros de paginación y los devuelve normalizados."""
    if not isinstance(limite, int) or isinstance(limite, bool) or limite < 1:
        raise ValueError("El límite debe ser un entero mayor o igual a 1")
    if limite > LIMITE_MAXIMO:
        raise ValueError(f"El límite no puede superar {LIMITE_MAXIMO}")
    if not isinstance(desplazamiento, int) or isinstance(desplazamiento, bool):
        raise ValueError("El desplazamiento debe ser un entero")
    if desplazamiento < 0:
        raise ValueError("El desplazamiento no puede ser negativo")
    return limite, desplazamiento
