"""Pantalla de Incidentes (`UI_SCREENS.md` §8). Listado real en la Etapa 5."""

from __future__ import annotations

from typing import Any

from ..formatters import fecha
from ..widgets.feedback import Toast
from ..widgets.table import StatusChipDelegate
from .base import PaginaListado, icono_estado_vacio

COLUMNAS = ["Fecha", "Artículo", "Tipo", "Procedencia", "Responsable", "Estado"]

_TIPO = {"perdida": "Pérdida", "danio": "Daño", "otro": "Otro"}
_ORIGEN = {"stock": "Depósito", "prestamo": "Préstamo", "devolucion": "Devolución"}
_ESTADO = {"abierto": "Abierto", "resuelto": "Resuelto"}


class PaginaIncidentes(PaginaListado):
    def __init__(self, incidentes, inventario, estudiantes, parent=None) -> None:
        super().__init__(
            "Incidentes",
            "Pérdidas, daños y roturas registradas",
            COLUMNAS,
            accion_texto="+ Nuevo",
            placeholder="Buscar por artículo o responsable…",
            parent=parent,
        )
        self._incidentes = incidentes
        self._inventario = inventario
        self._estudiantes = estudiantes
        self.tabla.set_delegate(2, StatusChipDelegate(self.tabla))
        self.tabla.set_delegate(3, StatusChipDelegate(self.tabla))
        self.tabla.set_delegate(5, StatusChipDelegate(self.tabla))
        self.tabla.accion_vacio.connect(self._alta_pendiente)
        self.cabecera.accion_pulsada.connect(self._alta_pendiente)

    def _configurar_estado_vacio(self) -> None:
        self.tabla.configurar_estado_vacio(
            "Todavía no hay incidentes registrados",
            "Registra el primero para seguir las pérdidas y los daños del laboratorio.",
            "Registrar el primero",
            icono_estado_vacio("incidentes"),
        )

    def _articulos(self) -> dict[int, str]:
        return {
            articulo.id: articulo.nombre
            for articulo in self._inventario.listar_articulos(limite=1000)
        }

    def _estudiantes_por_id(self) -> dict[int, str]:
        return {
            persona.id: f"{persona.nombres} {persona.apellidos}"
            for persona in self._estudiantes.listar_estudiantes(limite=1000)
        }

    def _obtener_filas(self, termino: str) -> list[list[Any]]:
        articulos = self._articulos()
        personas = self._estudiantes_por_id()
        filas = []
        for incidente in self._incidentes.listar_incidentes(limite=1000):
            articulo = articulos.get(incidente.articulo_id, "—")
            responsable = personas.get(incidente.estudiante_id, "Sin determinar")
            if termino and termino.lower() not in f"{articulo} {responsable}".lower():
                continue
            filas.append(
                [
                    fecha(incidente.creado_en),
                    articulo,
                    _TIPO[incidente.tipo.value],
                    _ORIGEN[incidente.origen.value],
                    responsable,
                    _ESTADO[incidente.estado.value],
                ]
            )
        return filas

    def _alta_pendiente(self) -> None:
        Toast.mostrar(
            self.window(), "El registro de incidentes llegará en la Etapa 6.", "atencion"
        )
