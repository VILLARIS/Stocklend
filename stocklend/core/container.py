"""Composición de dependencias (ARCHITECTURE §3.5).

Conecta una conexión ya abierta con los seis servicios de negocio de las etapas 3
y 4. No importa PySide6: también lo usan las pruebas y el arranque sin ventana.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass

from ..services import (
    DevolucionService,
    EstudianteService,
    IncidenteService,
    InventarioService,
    PrestamoService,
    UnidadService,
)


@dataclass(frozen=True)
class Servicios:
    """Agrupación de los servicios que consume la interfaz."""

    inventario: InventarioService
    unidades: UnidadService
    estudiantes: EstudianteService
    prestamos: PrestamoService
    devoluciones: DevolucionService
    incidentes: IncidenteService


def construir(conn: sqlite3.Connection) -> Servicios:
    """Crea los servicios sobre la conexión recibida."""
    return Servicios(
        inventario=InventarioService(conn),
        unidades=UnidadService(conn),
        estudiantes=EstudianteService(conn),
        prestamos=PrestamoService(conn),
        devoluciones=DevolucionService(conn),
        incidentes=IncidenteService(conn),
    )
