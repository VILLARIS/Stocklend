"""Traducción de excepciones a mensajes en español (ARCHITECTURE §3.4, RNF-01).

La interfaz nunca muestra nombres de tabla, de columna, de clase SQL ni trazas. Los
errores de negocio ya llegan en español desde `services/`; los inesperados se
envuelven aquí. El módulo **no importa sqlite3** (RNF-15): reconoce los errores de
la base por el módulo de su clase.
"""

from __future__ import annotations

from ..domain.excepciones import StockLendError

_INESPERADO = "Ocurrió un error inesperado. Vuelve a intentarlo."
_NO_CARGA = "No se pudieron cargar los datos. Vuelve a intentarlo."
_BLOQUEADA = "StockLend ya está abierto en otra ventana. Ciérrala antes de continuar."
_SIN_ACCESO = "No se pudo acceder a los datos. Comprueba la carpeta de StockLend."


def es_de_negocio(exc: BaseException) -> bool:
    """True si la excepción es una regla de negocio controlada."""
    return isinstance(exc, StockLendError)


def mensaje_error(exc: BaseException) -> str:
    """Devuelve una frase comprensible, sin detalle técnico."""
    if isinstance(exc, StockLendError):
        return str(exc) or _INESPERADO
    if type(exc).__module__.startswith("sqlite3"):
        if "locked" in str(exc).lower() or "busy" in str(exc).lower():
            return _BLOQUEADA
        return _NO_CARGA
    if isinstance(exc, (OSError, PermissionError)):
        return _SIN_ACCESO
    return _INESPERADO
