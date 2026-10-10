"""Pantalla de Préstamos (`UI_SCREENS.md` §5). Listado real en la Etapa 5."""

from __future__ import annotations

from typing import Any

from ..formatters import fecha_hora
from ..widgets.feedback import Toast
from ..widgets.table import QuantityCellDelegate, StatusChipDelegate
from .base import PaginaListado, icono_estado_vacio

COLUMNAS = ["Folio", "Estudiante", "Fecha", "Unidades", "Pendientes", "Estado"]

_ETIQUETA_ESTADO = {
    "activo": "Activo",
    "cerrado": "Cerrado",
    "anulado": "Anulado",
}


class PaginaPrestamos(PaginaListado):
    def __init__(self, prestamos, estudiantes, parent=None) -> None:
        super().__init__(
            "Préstamos",
            "Registro de entregas a estudiantes",
            COLUMNAS,
            accion_texto="+ Préstamo",
            placeholder="Buscar por estudiante o folio…",
            parent=parent,
        )
        self._prestamos = prestamos
        self._estudiantes = estudiantes
        self.tabla.set_delegate(3, QuantityCellDelegate(self.tabla))
        self.tabla.set_delegate(4, QuantityCellDelegate(self.tabla))
        self.tabla.set_delegate(5, StatusChipDelegate(self.tabla))
        self.tabla.accion_vacio.connect(self._alta_pendiente)
        self.cabecera.accion_pulsada.connect(self._alta_pendiente)

    def _configurar_estado_vacio(self) -> None:
        self.tabla.configurar_estado_vacio(
            "Todavía no hay préstamos registrados",
            "Registra el primero para llevar el control de las entregas.",
            "Registrar el primero",
            icono_estado_vacio("prestamos"),
        )

    def _nombres(self) -> dict[int, str]:
        return {
            persona.id: f"{persona.codigo_universitario} · {persona.nombres} {persona.apellidos}"
            for persona in self._estudiantes.listar_estudiantes(limite=1000)
        }

    def _conteos(self, prestamo_id: int) -> tuple[int, int]:
        prestadas = pendientes = 0
        for detalle in self._prestamos.detalles(prestamo_id):
            prestadas += detalle.cantidad_prestada
            if detalle.cantidad_pendiente is not None:
                pendientes += detalle.cantidad_pendiente
            else:
                pendientes += (
                    detalle.cantidad_prestada
                    - detalle.cantidad_devuelta
                    - detalle.cantidad_daniada
                    - detalle.cantidad_perdida
                )
        return prestadas, pendientes

    def _obtener_filas(self, termino: str) -> list[list[Any]]:
        nombres = self._nombres()
        filas = []
        for prestamo in self._prestamos.listar_prestamos(limite=1000):
            estudiante = nombres.get(prestamo.estudiante_id, "—")
            if termino and termino.lower() not in (
                f"{prestamo.folio} {estudiante}".lower()
            ):
                continue
            prestadas, pendientes = self._conteos(prestamo.id)
            filas.append(
                [
                    prestamo.folio,
                    estudiante,
                    fecha_hora(prestamo.fecha_prestamo),
                    prestadas,
                    pendientes,
                    _ETIQUETA_ESTADO[prestamo.estado.value],
                ]
            )
        return filas

    def _alta_pendiente(self) -> None:
        Toast.mostrar(
            self.window(), "El registro de préstamos llegará en la Etapa 6.", "atencion"
        )
