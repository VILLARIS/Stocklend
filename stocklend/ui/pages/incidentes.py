"""Pantalla de Incidentes (`UI_SCREENS.md` §8).

Pérdidas y daños con o sin responsable. El filtro por defecto es «abiertos», que es
lo que Sonia viene a revisar; «Sin determinar» es un valor explícito, nunca un hueco.
"""

from __future__ import annotations

from typing import Any

from PySide6.QtWidgets import QComboBox, QDialog

from ...domain.enums import (
    EstadoIncidente,
    OrigenIncidente,
    ResponsabilidadIncidente,
    TipoIncidente,
)
from ..dialogs.incidente import (
    AsignarResponsabilidadDialog,
    DetalleIncidenteDialog,
    IncidenteDialog,
    ResolverIncidenteDialog,
)
from ..formatters import fecha
from ..widgets.table import StatusChipDelegate
from .base import PaginaListado, icono_estado_vacio

COLUMNAS = ["Fecha", "Artículo", "Tipo", "Procedencia", "Responsable", "Estado"]

_TIPO = {
    TipoIncidente.PERDIDA: "Pérdida",
    TipoIncidente.DANIO: "Daño",
    TipoIncidente.OTRO: "Otro",
}
_ORIGEN = {
    OrigenIncidente.STOCK: "Depósito",
    OrigenIncidente.PRESTAMO: "Préstamo",
    OrigenIncidente.DEVOLUCION: "Devolución",
}
_ESTADO = {
    EstadoIncidente.ABIERTO: "Abierto",
    EstadoIncidente.RESUELTO: "Resuelto",
}


class PaginaIncidentes(PaginaListado):
    def __init__(self, servicios, parent=None) -> None:
        super().__init__(
            "Incidentes",
            "Pérdidas, daños y roturas registradas",
            COLUMNAS,
            accion_texto="+ Nuevo",
            placeholder="Buscar por artículo o responsable…",
            parent=parent,
        )
        self._s = servicios
        self._incidentes = servicios.incidentes
        self._inventario = servicios.inventario
        self._estudiantes = servicios.estudiantes

        self.filtro_tipo = self._filtro(
            [("Todos los tipos", None), ("Daño", TipoIncidente.DANIO),
             ("Pérdida", TipoIncidente.PERDIDA), ("Otro", TipoIncidente.OTRO)]
        )
        self.filtro_estado = self._filtro(
            [("Abiertos", EstadoIncidente.ABIERTO), ("Todos los estados", None),
             ("Resueltos", EstadoIncidente.RESUELTO)]
        )
        self.filtro_origen = self._filtro(
            [("Todas las procedencias", None), ("Depósito", OrigenIncidente.STOCK),
             ("Préstamo", OrigenIncidente.PRESTAMO),
             ("Devolución", OrigenIncidente.DEVOLUCION)]
        )

        self.tabla.set_delegate(2, StatusChipDelegate(self.tabla))
        self.tabla.set_delegate(3, StatusChipDelegate(self.tabla))
        self.tabla.set_delegate(5, StatusChipDelegate(self.tabla))
        self.tabla.accion_vacio.connect(self._alta)
        self.cabecera.accion_pulsada.connect(self._alta)

    def _filtro(self, opciones: list[tuple[str, object]]) -> QComboBox:
        combo = QComboBox()
        combo.setObjectName("filtro_incidente")
        for texto, dato in opciones:
            combo.addItem(texto, dato)
        combo.currentIndexChanged.connect(lambda _i: self.cargar())
        self.barra.agregar(combo)
        return combo

    def _configurar_estado_vacio(self) -> None:
        self.tabla.configurar_estado_vacio(
            "Todavía no hay incidentes registrados",
            "Registra el primero para seguir las pérdidas y los daños del laboratorio.",
            "Registrar el primero",
            icono_estado_vacio("incidentes"),
        )

    # ------------------------------------------------------------------- datos

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

    def _responsable(self, incidente, personas: dict[int, str]) -> str:
        if incidente.estudiante_id is not None:
            return personas.get(incidente.estudiante_id, "Sin determinar")
        if incidente.responsabilidad == ResponsabilidadIncidente.FACULTAD:
            return "Facultad"
        return "Sin determinar"

    def _obtener_filas(self, termino: str) -> list[list[Any]]:
        articulos = self._articulos()
        personas = self._estudiantes_por_id()
        incidentes = self._incidentes.listar_incidentes(
            estado=self.filtro_estado.currentData(),
            tipo=self.filtro_tipo.currentData(),
            origen=self.filtro_origen.currentData(),
            limite=1000,
        )
        filas = []
        registros = []
        for incidente in incidentes:
            articulo = articulos.get(incidente.articulo_id, "—")
            responsable = self._responsable(incidente, personas)
            if termino and termino.lower() not in f"{articulo} {responsable}".lower():
                continue
            filas.append(
                [
                    fecha(incidente.creado_en),
                    articulo,
                    _TIPO.get(incidente.tipo, "—"),
                    _ORIGEN.get(incidente.origen, "—"),
                    responsable,
                    _ESTADO.get(incidente.estado, "—"),
                ]
            )
            registros.append(incidente)
        self._registros = registros
        return filas

    # ------------------------------------------------------------------- menú

    def _acciones_fila(self, indice: int) -> list[tuple]:
        incidente = self._registro(indice)
        if incidente is None:
            return []
        abierto = incidente.estado == EstadoIncidente.ABIERTO
        sin_determinar = incidente.responsabilidad == ResponsabilidadIncidente.SIN_DETERMINAR
        return [
            ("Ver detalle", lambda: self._ver_detalle(incidente)),
            (
                "Marcar resuelto",
                None if not abierto else lambda: self._resolver(incidente),
                abierto,
            ),
            (
                "Asignar responsabilidad",
                None if not abierto else lambda: self._asignar(incidente),
                abierto and sin_determinar,
            ),
        ]

    # ----------------------------------------------------------------- acciones

    def _alta(self) -> None:
        s = self._s
        dialogo = IncidenteDialog(
            s.incidentes, s.inventario, s.estudiantes, s.prestamos, s.unidades,
            parent=self.window(),
        )
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Incidente registrado.")
            self.cargar()

    def _ver_detalle(self, incidente) -> None:
        dialogo = DetalleIncidenteDialog(
            self._incidentes, self._inventario, incidente, parent=self.window()
        )
        dialogo.exec()

    def _resolver(self, incidente) -> None:
        dialogo = ResolverIncidenteDialog(self._incidentes, incidente, parent=self.window())
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Incidente resuelto.")
            self.cargar()

    def _asignar(self, incidente) -> None:
        dialogo = AsignarResponsabilidadDialog(
            self._incidentes, self._estudiantes, incidente, parent=self.window()
        )
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Responsabilidad asignada.")
            self.cargar()
