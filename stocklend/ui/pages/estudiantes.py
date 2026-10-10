"""Pantalla de Estudiantes (`UI_SCREENS.md` §4).

El buscador es el protagonista: filtra por nombre o código mientras se escribe. La
zona de apoyo muestra el resumen del estudiante y el menú de fila permite editarlo,
inactivarlo o registrarle un préstamo.
"""

from __future__ import annotations

from typing import Any

from PySide6.QtWidgets import QDialog

from ..dialogs.estudiante import EstudianteDialog, FichaEstudianteDialog
from ..dialogs.prestamo import NuevoPrestamoDialog
from ..widgets.table import QuantityCellDelegate
from .base import PaginaListado, icono_estado_vacio

COLUMNAS = ["Código", "Nombre", "Préstamos activos", "Pendientes", "Estado"]


class PaginaEstudiantes(PaginaListado):
    def __init__(self, servicios, parent=None) -> None:
        super().__init__(
            "Estudiantes",
            "Directorio de estudiantes y sus préstamos",
            COLUMNAS,
            accion_texto="+ Estudiante",
            placeholder="Buscar por nombre o código…",
            parent=parent,
        )
        self._s = servicios
        self._estudiantes = servicios.estudiantes
        self._prestamos = servicios.prestamos
        self.tabla.set_delegate(2, QuantityCellDelegate(self.tabla))
        self.tabla.set_delegate(3, QuantityCellDelegate(self.tabla))
        self.tabla.accion_vacio.connect(self._alta)
        self.cabecera.accion_pulsada.connect(self._alta)

    def _configurar_estado_vacio(self) -> None:
        self.tabla.configurar_estado_vacio(
            "Todavía no hay estudiantes registrados",
            "Registra el primero para poder prestarle material.",
            "Registrar el primero",
            icono_estado_vacio("estudiantes"),
        )

    # ------------------------------------------------------------------- datos

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
        self._registros = list(personas)
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

    # ------------------------------------------------------------------- menú

    def _acciones_fila(self, indice: int) -> list[tuple]:
        estudiante = self._registro(indice)
        if estudiante is None:
            return []
        activo = estudiante.activo
        return [
            ("Ver ficha", lambda: self._ver_ficha(estudiante)),
            ("Editar", lambda: self._editar(estudiante)),
            (
                "Marcar inactivo" if activo else "Reactivar",
                lambda: self._alternar(estudiante),
            ),
            (
                "Registrar préstamo",
                None if not activo else lambda: self._prestamo(),
                not activo,
            ),
        ]

    # ----------------------------------------------------------------- acciones

    def _alta(self) -> None:
        dialogo = EstudianteDialog(self._estudiantes, parent=self.window())
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Estudiante registrado.")
            self.cargar()

    def _editar(self, estudiante) -> None:
        dialogo = EstudianteDialog(
            self._estudiantes, estudiante=estudiante, parent=self.window()
        )
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Estudiante actualizado.")
            self.cargar()

    def _ver_ficha(self, estudiante) -> None:
        dialogo = FichaEstudianteDialog(
            self._estudiantes, self._prestamos, estudiante, parent=self.window()
        )
        dialogo.exec()

    def _alternar(self, estudiante) -> None:
        if estudiante.activo:
            self._estudiantes.inactivar_estudiante(estudiante.id)
            self.avisar("Estudiante marcado como inactivo.", "atencion")
        else:
            self._estudiantes.reactivar_estudiante(estudiante.id)
            self.avisar("Estudiante reactivado.")
        self.cargar()

    def _prestamo(self) -> None:
        s = self._s
        dialogo = NuevoPrestamoDialog(
            s.prestamos, s.estudiantes, s.inventario, s.unidades, parent=self.window()
        )
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Préstamo registrado.")
            self.cargar()
