"""Pantalla de Estudiantes (`UI_SCREENS.md` §4). Listado real en la Etapa 5."""

from __future__ import annotations

from typing import Any

from ..widgets.feedback import Toast
from ..widgets.table import QuantityCellDelegate
from .base import PaginaListado, icono_estado_vacio

COLUMNAS = ["Código", "Nombre", "Préstamos activos", "Pendientes", "Estado"]


class PaginaEstudiantes(PaginaListado):
    def __init__(self, estudiantes, prestamos, parent=None) -> None:
        super().__init__(
            "Estudiantes",
            "Directorio de estudiantes y sus préstamos",
            COLUMNAS,
            accion_texto="+ Estudiante",
            placeholder="Buscar por nombre o código…",
            parent=parent,
        )
        self._estudiantes = estudiantes
        self._prestamos = prestamos
        self.tabla.set_delegate(2, QuantityCellDelegate(self.tabla))
        self.tabla.set_delegate(3, QuantityCellDelegate(self.tabla))
        self.tabla.accion_vacio.connect(self._alta_pendiente)
        self.cabecera.accion_pulsada.connect(self._alta_pendiente)

    def _configurar_estado_vacio(self) -> None:
        self.tabla.configurar_estado_vacio(
            "Todavía no hay estudiantes registrados",
            "Registra el primero para poder prestarle material.",
            "Registrar el primero",
            icono_estado_vacio("estudiantes"),
        )

    def _pendientes(self, estudiante_id: int) -> tuple[int, int]:
        activos = self._prestamos.listar_activos(estudiante_id=estudiante_id, limite=1000)
        pendientes = 0
        for prestamo in activos:
            for detalle in self._prestamos.detalles(prestamo.id):
                if detalle.cantidad_pendiente is not None:
                    pendientes += detalle.cantidad_pendiente
                else:
                    pendientes += (
                        detalle.cantidad_prestada
                        - detalle.cantidad_devuelta
                        - detalle.cantidad_daniada
                        - detalle.cantidad_perdida
                    )
        return len(activos), pendientes

    def _obtener_filas(self, termino: str) -> list[list[Any]]:
        if termino:
            personas = self._estudiantes.buscar_estudiantes(termino, limite=1000)
        else:
            personas = self._estudiantes.listar_estudiantes(limite=1000)
        filas = []
        for persona in personas:
            activos, pendientes = self._pendientes(persona.id)
            filas.append(
                [
                    persona.codigo_universitario,
                    f"{persona.nombres} {persona.apellidos}",
                    activos,
                    pendientes,
                    "Activo" if persona.activo else "Inactivo",
                ]
            )
        return filas

    def _alta_pendiente(self) -> None:
        Toast.mostrar(
            self.window(), "El alta de estudiantes llegará en la Etapa 6.", "atencion"
        )
