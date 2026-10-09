"""Value objects del dominio con sus validaciones (ARCHITECTURE §3.1).

Solo cubren reglas de formato u obligatoriedad expresables sobre un valor aislado.
Las reglas que dependen de otras filas o del estado global se validan en la capa de
servicios. Todos son inmutables y comparables por valor.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .excepciones import ValidacionError

_PATRON_FOLIO = re.compile(r"^PRE-(\d{4})-(\d{6})$")


@dataclass(frozen=True, slots=True)
class Folio:
    """Folio de préstamo con el formato ``PRE-AAAA-NNNNNN`` (RN-20)."""

    valor: str

    def __post_init__(self) -> None:
        if not _PATRON_FOLIO.match(self.valor):
            raise ValidacionError(
                f"El folio '{self.valor}' no tiene el formato PRE-AAAA-NNNNNN"
            )

    @classmethod
    def desde_partes(cls, anio: int, correlativo: int) -> Folio:
        """Construye el folio a partir del año y el correlativo (RN-20)."""
        if not 1 <= correlativo <= 999999:
            raise ValidacionError("El correlativo del folio debe estar entre 1 y 999999")
        return cls(f"PRE-{anio:04d}-{correlativo:06d}")

    @property
    def anio(self) -> int:
        return int(_PATRON_FOLIO.match(self.valor).group(1))  # type: ignore[union-attr]

    @property
    def correlativo(self) -> int:
        return int(_PATRON_FOLIO.match(self.valor).group(2))  # type: ignore[union-attr]

    def __str__(self) -> str:
        return self.valor


@dataclass(frozen=True, slots=True)
class CodigoUniversitario:
    """Código universitario obligatorio, no vacío (RN-11)."""

    valor: str

    def __post_init__(self) -> None:
        normalizado = self.valor.strip()
        if not normalizado:
            raise ValidacionError("El código universitario es obligatorio")
        object.__setattr__(self, "valor", normalizado)

    def __str__(self) -> str:
        return self.valor


@dataclass(frozen=True, slots=True)
class CodigoUnidad:
    """Código de una unidad individual, obligatorio y no vacío (RN-51)."""

    valor: str

    def __post_init__(self) -> None:
        normalizado = self.valor.strip()
        if not normalizado:
            raise ValidacionError("El código de la unidad es obligatorio")
        object.__setattr__(self, "valor", normalizado)

    def __str__(self) -> str:
        return self.valor


@dataclass(frozen=True, slots=True)
class Cantidad:
    """Cantidad entera no negativa (RN-29).

    La positividad estricta que exige un movimiento (RN-05) o una línea de préstamo
    (RN-17) es una regla de contexto y se valida en el servicio.
    """

    valor: int

    def __post_init__(self) -> None:
        if not isinstance(self.valor, int) or isinstance(self.valor, bool):
            raise ValidacionError("La cantidad debe ser un número entero")
        if self.valor < 0:
            raise ValidacionError("La cantidad no puede ser negativa")

    @property
    def es_positiva(self) -> bool:
        return self.valor > 0

    def __int__(self) -> int:
        return self.valor


@dataclass(frozen=True, slots=True)
class RangoFechas:
    """Rango de fechas ISO con ``hasta`` **exclusivo** (DATABASE_DESIGN §8.3).

    ``desde`` y ``hasta`` son cadenas ISO comparables lexicográficamente. Si
    ``hasta`` es ``None`` el rango no tiene límite superior.
    """

    desde: str
    hasta: str | None = None

    def __post_init__(self) -> None:
        if not self.desde:
            raise ValidacionError("La fecha de inicio del rango es obligatoria")
        if self.hasta is not None:
            if not self.hasta:
                raise ValidacionError("La fecha de fin no puede ser vacía")
            if self.hasta < self.desde:
                raise ValidacionError("La fecha de fin no puede ser anterior al inicio")

    def contiene(self, fecha: str) -> bool:
        """Indica si la fecha cae en ``[desde, hasta)``."""
        return fecha >= self.desde and (self.hasta is None or fecha < self.hasta)
