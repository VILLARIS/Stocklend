"""Ventana principal del armazón (`UI_DESIGN.md` §4).

Una sola ventana: barra lateral fija de 240 px y un `QStackedWidget` con las
páginas. La cabecera de contenido vive dentro de cada página. La navegación no abre
ventanas nuevas (ARCHITECTURE §3.4).
"""

from __future__ import annotations

import logging

from PySide6.QtCore import Qt
from PySide6.QtGui import QKeySequence, QShortcut
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QStackedWidget,
    QWidget,
)

from ..core.constants import APP_NAME
from .pages import (
    PaginaConfiguracion,
    PaginaDevoluciones,
    PaginaEstudiantes,
    PaginaIncidentes,
    PaginaInventario,
    PaginaPanel,
    PaginaPrestamos,
    PaginaReportes,
    PaginaRespaldo,
)
from .sidebar import SECCIONES, Sidebar

logger = logging.getLogger("stocklend.ui")


class VentanaPrincipal(QMainWindow):
    """Ventana única con menú lateral y páginas apiladas."""

    def __init__(
        self,
        servicios,
        ruta_base: str,
        version: str,
        esquema: int,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("ventana_principal")
        self.setWindowTitle(APP_NAME)
        self.resize(1360, 840)
        self.setMinimumSize(1024, 640)
        self._servicios = servicios

        self.sidebar = Sidebar(version, esquema)
        self.sidebar.seccion_elegida.connect(self.ir_a)

        self.paginas: dict[str, QWidget] = {}
        self.stack = QStackedWidget()
        self.stack.setObjectName("contenido")
        self._indices: dict[str, int] = {}
        for seccion in SECCIONES:
            pagina = self._crear_pagina(seccion.clave)
            self._indices[seccion.clave] = self.stack.addWidget(pagina)
            self.paginas[seccion.clave] = pagina

        central = QWidget()
        disposicion = QHBoxLayout(central)
        disposicion.setContentsMargins(0, 0, 0, 0)
        disposicion.setSpacing(0)
        disposicion.addWidget(self.sidebar)
        disposicion.addWidget(self.stack, 1)
        self.setCentralWidget(central)

        self._crear_barra_estado(ruta_base)
        self._crear_atajos()
        self.ir_a("dashboard")
        self.actualizar_insignias()

    # ------------------------------------------------------------------ páginas
    def _crear_pagina(self, clave: str) -> QWidget:
        s = self._servicios
        if clave == "dashboard":
            return PaginaPanel()
        if clave == "inventario":
            return PaginaInventario(s.inventario)
        if clave == "estudiantes":
            return PaginaEstudiantes(s.estudiantes, s.prestamos)
        if clave == "prestamos":
            return PaginaPrestamos(s.prestamos, s.estudiantes)
        if clave == "devoluciones":
            return PaginaDevoluciones()
        if clave == "reportes":
            return PaginaReportes()
        if clave == "incidentes":
            return PaginaIncidentes(s.incidentes, s.inventario, s.estudiantes)
        if clave == "respaldo":
            return PaginaRespaldo()
        return PaginaConfiguracion()

    def ir_a(self, clave: str) -> None:
        """Navega a una sección; se puede llamar aunque la sección no exista."""
        indice = self._indices.get(clave)
        if indice is None:
            logger.warning("Sección desconocida: %s", clave)
            return
        self.stack.setCurrentIndex(indice)
        self.sidebar.set_activa(clave)
        etiqueta = next((s.etiqueta for s in SECCIONES if s.clave == clave), clave)
        self.setWindowTitle(f"{APP_NAME} — {etiqueta}")
        self.cargar_actual()

    def seccion_actual(self) -> str:
        indice = self.stack.currentIndex()
        for clave, valor in self._indices.items():
            if valor == indice:
                return clave
        return "dashboard"

    def pagina_actual(self) -> QWidget:
        return self.stack.currentWidget()

    def cargar_actual(self) -> None:
        pagina = self.pagina_actual()
        cargar = getattr(pagina, "cargar", None)
        if callable(cargar):
            try:
                cargar()
            except Exception:  # noqa: BLE001 - la interfaz nunca se cierra (RNF-08)
                logger.exception("Fallo al cargar la sección %s", self.seccion_actual())
        self.actualizar_insignias()

    # ---------------------------------------------------------------- insignias
    def actualizar_insignias(self) -> None:
        try:
            pendientes = len(self._servicios.prestamos.listar_activos(limite=1000))
            abiertos = len(self._servicios.incidentes.listar_pendientes(limite=1000))
        except Exception:  # noqa: BLE001 - una insignia nunca cierra la aplicación
            logger.exception("No se pudieron calcular las insignias")
            return
        self.sidebar.set_insignia("prestamos", pendientes)
        self.sidebar.set_insignia("incidentes", abiertos)

    # ------------------------------------------------------------ barra de estado
    def _crear_barra_estado(self, ruta_base: str) -> None:
        barra = self.statusBar()
        barra.setObjectName("barra_estado")
        origen = QLabel(f"Base: {ruta_base} · Último respaldo: sin registro")
        origen.setObjectName("estado_base")
        listo = QLabel("Listo")
        listo.setObjectName("estado_operacion")
        barra.addWidget(origen)
        barra.addPermanentWidget(listo)

    # ------------------------------------------------------------------ atajos
    def _crear_atajos(self) -> None:
        for seccion in SECCIONES:
            if not seccion.atajo:
                continue
            atajo = QShortcut(QKeySequence(seccion.atajo), self)
            atajo.setContext(Qt.ShortcutContext.ApplicationShortcut)
            atajo.activated.connect(lambda clave=seccion.clave: self.ir_a(clave))
        actualizar = QShortcut(QKeySequence("F5"), self)
        actualizar.activated.connect(self.cargar_actual)
