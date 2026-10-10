"""Páginas de la aplicación.

En la Etapa 5 el listado de Inventario, Estudiantes, Préstamos e Incidentes ya se
conecta a datos reales; Panel, Devoluciones, Reportes, Respaldo y Configuración son
provisionales y muestran su aviso de etapa pendiente.
"""

from __future__ import annotations

from .base import PaginaBase, PaginaListado, PaginaProvisional
from .configuracion import PaginaConfiguracion
from .dashboard import PaginaPanel
from .devoluciones import PaginaDevoluciones
from .estudiantes import PaginaEstudiantes
from .incidentes import PaginaIncidentes
from .inventario import PaginaInventario
from .prestamos import PaginaPrestamos
from .reportes import PaginaReportes
from .respaldo import PaginaRespaldo

__all__ = [
    "PaginaBase",
    "PaginaConfiguracion",
    "PaginaDevoluciones",
    "PaginaEstudiantes",
    "PaginaIncidentes",
    "PaginaInventario",
    "PaginaListado",
    "PaginaPanel",
    "PaginaPrestamos",
    "PaginaProvisional",
    "PaginaReportes",
    "PaginaRespaldo",
]
