"""Servicios de aplicación: casos de uso de inventario, estudiantes y préstamos.

Cada servicio recibe una conexión ya abierta, abre **una** transacción por método
público y coordina los repositorios (ARCHITECTURE §3.3). En la Etapa 3 se
implementan `InventarioService`, `UnidadService` y `EstudianteService`; en la
Etapa 4, `PrestamoService`, `DevolucionService` e `IncidenteService`.
"""

from __future__ import annotations

from .devolucion_service import DevolucionService, LineaDevolucion
from .estudiante_service import EstudianteService
from .incidente_service import IncidenteService
from .inventario_service import InventarioService
from .prestamo_service import LineaPrestamo, PrestamoService
from .unidad_service import UnidadService

__all__ = [
    "DevolucionService",
    "EstudianteService",
    "IncidenteService",
    "InventarioService",
    "LineaDevolucion",
    "LineaPrestamo",
    "PrestamoService",
    "UnidadService",
]
