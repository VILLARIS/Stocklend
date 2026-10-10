"""Dominio: reglas de negocio puras, sin dependencias (Etapa 2).

Solo biblioteca estándar (ARCHITECTURE §3.1). Reexporta las entidades, los enums,
los value objects y la jerarquía de excepciones para que las demás capas importen
desde ``stocklend.domain``.
"""

from __future__ import annotations

from .entidades import (
    Articulo,
    ArticuloUnidad,
    Categoria,
    Configuracion,
    Devolucion,
    DevolucionDetalle,
    Estudiante,
    Incidente,
    MovimientoInventario,
    Prestamo,
    PrestamoDetalle,
    ResumenInventario,
)
from .enums import (
    Cubo,
    EstadoDetalle,
    EstadoIncidente,
    EstadoPrestamo,
    EstadoUnidad,
    OrigenIncidente,
    ResponsabilidadIncidente,
    TipoIncidente,
    TipoMovimiento,
)
from .excepciones import (
    CantidadInsuficienteError,
    NoEncontradoError,
    PersistenciaError,
    ReglaNegocioError,
    StockLendError,
    ValidacionError,
)
from .value_objects import Cantidad, CodigoUnidad, CodigoUniversitario, Folio, RangoFechas

__all__ = [
    "Articulo",
    "ArticuloUnidad",
    "Cantidad",
    "CantidadInsuficienteError",
    "Categoria",
    "CodigoUnidad",
    "CodigoUniversitario",
    "Configuracion",
    "Cubo",
    "Devolucion",
    "DevolucionDetalle",
    "EstadoDetalle",
    "EstadoIncidente",
    "EstadoPrestamo",
    "EstadoUnidad",
    "Estudiante",
    "Folio",
    "Incidente",
    "MovimientoInventario",
    "NoEncontradoError",
    "OrigenIncidente",
    "PersistenciaError",
    "Prestamo",
    "PrestamoDetalle",
    "RangoFechas",
    "ReglaNegocioError",
    "ResponsabilidadIncidente",
    "ResumenInventario",
    "StockLendError",
    "TipoIncidente",
    "TipoMovimiento",
    "ValidacionError",
]
