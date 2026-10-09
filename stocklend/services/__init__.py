"""Servicios de aplicación: casos de uso de inventario, estudiantes y préstamos.

Cada servicio recibe una conexión ya abierta, abre **una** transacción por método
público y coordina los repositorios (ARCHITECTURE §3.3). En la Etapa 3 se
implementan `InventarioService`, `UnidadService` y `EstudianteService`.
"""

from __future__ import annotations

from .estudiante_service import EstudianteService
from .inventario_service import InventarioService
from .unidad_service import UnidadService

__all__ = [
    "EstudianteService",
    "InventarioService",
    "UnidadService",
]
