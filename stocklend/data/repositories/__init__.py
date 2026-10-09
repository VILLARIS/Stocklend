"""Repositorios: consultas sobre las tablas (Etapa 2).

Cada repositorio recibe una conexión ya abierta y no abre ni cierra transacciones
(ARCHITECTURE §3.2). Los contadores y estados se escriben con sentencias completas
para respetar los ``CHECK`` del esquema.

``DashboardRepo`` y ``RespaldoRepo`` están previstos en ARCHITECTURE §3.2 pero se
implementan en sus etapas (panel y respaldo), no en la Etapa 2.
"""

from __future__ import annotations

from .articulos import ArticuloRepo
from .categorias import CategoriaRepo
from .configuracion import ConfiguracionRepo
from .devoluciones import DevolucionRepo
from .estudiantes import EstudianteRepo
from .incidentes import IncidenteRepo
from .movimientos import MovimientoRepo
from .prestamos import PrestamoRepo
from .unidades import ArticuloUnidadRepo

__all__ = [
    "ArticuloRepo",
    "ArticuloUnidadRepo",
    "CategoriaRepo",
    "ConfiguracionRepo",
    "DevolucionRepo",
    "EstudianteRepo",
    "IncidenteRepo",
    "MovimientoRepo",
    "PrestamoRepo",
]
