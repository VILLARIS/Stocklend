"""Pantalla de Devoluciones (`UI_SCREENS.md` §6).

La devolución propiamente dicha ocurre en `DevolucionDialog`; esta pantalla lista los
préstamos activos para localizar el que se va a devolver y abrir el diálogo con ese
préstamo ya fijado.
"""

from __future__ import annotations

from typing import Any

from PySide6.QtWidgets import QDialog

from ..dialogs.devolucion import DevolucionDialog
from ..dialogs.prestamo import DetallePrestamoDialog
from ..formatters import fecha_hora
from ..widgets.table import QuantityCellDelegate
from .base import PaginaListado, icono_estado_vacio

COLUMNAS = ["Folio", "Estudiante", "Fecha", "Unidades", "Pendientes"]


class PaginaDevoluciones(PaginaListado):
    def __init__(self, servicios, parent=None) -> None:
        super().__init__(
            "Devoluciones",
            "Préstamos activos pendientes de devolver",
            COLUMNAS,
            accion_texto=None,
            placeholder="Buscar por estudiante o folio…",
            parent=parent,
        )
        self._s = servicios
        self._prestamos = servicios.prestamos
        self._estudiantes = servicios.estudiantes
        self.tabla.set_delegate(3, QuantityCellDelegate(self.tabla))
        self.tabla.set_delegate(4, QuantityCellDelegate(self.tabla))
        self.tabla.tabla.doubleClicked.connect(self._abrir_doble_clic)

    def _configurar_estado_vacio(self) -> None:
        self.tabla.configurar_estado_vacio(
            "No hay préstamos activos",
            "Cuando haya entregas pendientes de devolver aparecerán aquí.",
            icono=icono_estado_vacio("devoluciones"),
        )

    # ------------------------------------------------------------------- datos

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
        registros = []
        for prestamo in self._prestamos.listar_activos(limite=1000):
            estudiante = nombres.get(prestamo.estudiante_id, "—")
            if termino and termino.lower() not in f"{prestamo.folio} {estudiante}".lower():
                continue
            prestadas, pendientes = self._conteos(prestamo.id)
            filas.append(
                [
                    prestamo.folio,
                    estudiante,
                    fecha_hora(prestamo.fecha_prestamo),
                    prestadas,
                    pendientes,
                ]
            )
            registros.append(prestamo)
        self._registros = registros
        return filas

    # ------------------------------------------------------------------- menú

    def _acciones_fila(self, indice: int) -> list[tuple]:
        prestamo = self._registro(indice)
        if prestamo is None:
            return []
        return [
            ("Registrar devolución", lambda: self._devolver(prestamo)),
            ("Ver detalle", lambda: self._ver_detalle(prestamo)),
        ]

    def _abrir_doble_clic(self, indice) -> None:
        prestamo = self._registro(indice.row())
        if prestamo is not None:
            self._devolver(prestamo)

    # ----------------------------------------------------------------- acciones

    def _devolver(self, prestamo) -> None:
        s = self._s
        dialogo = DevolucionDialog(
            s.devoluciones,
            s.prestamos,
            s.estudiantes,
            s.inventario,
            s.unidades,
            prestamo_inicial=prestamo,
            parent=self.window(),
        )
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Devolución registrada.")
            self.cargar()

    def _ver_detalle(self, prestamo) -> None:
        s = self._s
        dialogo = DetallePrestamoDialog(
            s.prestamos, s.estudiantes, s.inventario, prestamo, parent=self.window()
        )
        dialogo.exec()
