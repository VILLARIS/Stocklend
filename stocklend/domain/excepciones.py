"""Jerarquía de excepciones del dominio (ARCHITECTURE §3.1, REQUIREMENTS §4.10).

Toda excepción propia hereda de :class:`StockLendError` para que la capa de
servicios pueda traducirla a un mensaje en español sin filtrar detalles técnicos.
"""

from __future__ import annotations


class StockLendError(Exception):
    """Raíz de todos los errores controlados de StockLend."""


class ValidacionError(StockLendError):
    """Un dato de entrada no cumple el formato o la obligatoriedad exigida."""


class CantidadInsuficienteError(StockLendError):
    """No hay existencias suficientes para la operación solicitada."""

    def __init__(self, mensaje: str, *, disponible: int | None = None) -> None:
        super().__init__(mensaje)
        self.disponible = disponible


class ReglaNegocioError(StockLendError):
    """La operación incumple una regla de negocio."""


class NoEncontradoError(StockLendError):
    """La entidad solicitada no existe."""


class PersistenciaError(StockLendError):
    """La operación falló al escribir en la base de datos."""
