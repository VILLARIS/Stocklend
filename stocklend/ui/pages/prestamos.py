"""Pantalla de Préstamos (`UI_SCREENS.md` §5).

Registro de entregas con filtro por estado. El menú de fila permite registrar la
devolución, ver el detalle y anular el préstamo con doble confirmación (RF-PRE-07).
"""

from __future__ import annotations

from typing import Any

from PySide6.QtWidgets import QComboBox, QDialog

from ..dialogs.confirm import confirmar
from ..dialogs.devolucion import DevolucionDialog
from ..dialogs.prestamo import DetallePrestamoDialog, NuevoPrestamoDialog
from ..formatters import fecha_hora
from ..widgets.table import QuantityCellDelegate, StatusChipDelegate
from .base import PaginaListado, icono_estado_vacio

COLUMNAS = ["Folio", "Estudiante", "Fecha", "Unidades", "Pendientes", "Estado"]

_ETIQUETA_ESTADO = {
    "activo": "Activo",
    "cerrado": "Cerrado",
    "anulado": "Anulado",
}


class PaginaPrestamos(PaginaListado):
    def __init__(self, servicios, parent=None) -> None:
        super().__init__(
            "Préstamos",
            "Registro de entregas a estudiantes",
            COLUMNAS,
            accion_texto="+ Préstamo",
            placeholder="Buscar por estudiante o folio…",
            parent=parent,
        )
        self._s = servicios
        self._prestamos = servicios.prestamos
        self._estudiantes = servicios.estudiantes
        self.filtro_estado = QComboBox()
        self.filtro_estado.setObjectName("filtro_estado")
        self.filtro_estado.addItem("Todos los estados", None)
        self.filtro_estado.addItem("Activos", "activo")
        self.filtro_estado.addItem("Cerrados", "cerrado")
        self.filtro_estado.addItem("Anulados", "anulado")
        self.filtro_estado.currentIndexChanged.connect(lambda _i: self.cargar())
        self.barra.agregar(self.filtro_estado)

        self.tabla.set_delegate(3, QuantityCellDelegate(self.tabla))
        self.tabla.set_delegate(4, QuantityCellDelegate(self.tabla))
        self.tabla.set_delegate(5, StatusChipDelegate(self.tabla))
        self.tabla.accion_vacio.connect(self._alta)
        self.cabecera.accion_pulsada.connect(self._alta)

    def _configurar_estado_vacio(self) -> None:
        self.tabla.configurar_estado_vacio(
            "Todavía no hay préstamos registrados",
            "Registra el primero para llevar el control de las entregas.",
            "Registrar el primero",
            icono_estado_vacio("prestamos"),
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
        estado = self.filtro_estado.currentData()
        filas = []
        registros = []
        for prestamo in self._prestamos.listar_prestamos(limite=1000):
            if estado is not None and prestamo.estado.value != estado:
                continue
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
                    _ETIQUETA_ESTADO[prestamo.estado.value],
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
        activo = prestamo.estado.value == "activo"
        tiene_devoluciones = (
            len(self._s.devoluciones.listar_devoluciones(prestamo_id=prestamo.id)) > 0
        )
        return [
            (
                "Registrar devolución",
                None if not activo else lambda: self._devolver(prestamo),
                activo,
            ),
            ("Ver detalle", lambda: self._ver_detalle(prestamo)),
            (
                "Anular préstamo",
                None if not (activo and not tiene_devoluciones) else lambda: self._anular(prestamo),
                activo and not tiene_devoluciones,
            ),
        ]

    # ----------------------------------------------------------------- acciones

    def _alta(self) -> None:
        s = self._s
        dialogo = NuevoPrestamoDialog(
            s.prestamos, s.estudiantes, s.inventario, s.unidades, parent=self.window()
        )
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Préstamo registrado.")
            self.cargar()

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

    def _anular(self, prestamo) -> None:
        nombre = self._nombres().get(prestamo.estudiante_id, "el estudiante")
        prestadas, _pendientes = self._conteos(prestamo.id)
        primera = confirmar(
            self.window(),
            "Anular préstamo",
            f"Vas a anular el préstamo {prestamo.folio} de {nombre}.",
            [
                f"devuelve {prestadas} unidades al inventario como disponibles",
                "marca el préstamo como anulado, sin borrarlo",
                "el movimiento queda registrado en el historial",
            ],
            "Anular préstamo",
        )
        if not primera:
            return
        segunda = confirmar(
            self.window(),
            "Confirmar anulación",
            "Escribe ANULAR para confirmar la anulación definitiva.",
            texto_accion="Anular definitivamente",
            palabra_confirmacion="ANULAR",
        )
        if not segunda:
            return
        try:
            self._prestamos.anular_prestamo(prestamo.id)
        except Exception as exc:  # noqa: BLE001 - se informa sin cerrar la interfaz
            self.avisar(str(exc), "error")
            return
        self.avisar("Préstamo anulado.", "atencion")
        self.cargar()
