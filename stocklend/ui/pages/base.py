"""Base de las páginas del armazón (`UI_DESIGN.md` §4.2).

Cada página es un `QWidget` con cabecera de contenido, barra de herramientas,
zona de trabajo y zona de apoyo. No abre la base: recibe un servicio por
constructor y muestra los datos reales que devuelve. En la Etapa 5 las pantallas
de listado ya consultan datos reales y las demás son provisionales.
"""

from __future__ import annotations

from typing import Any

from PySide6.QtCore import QModelIndex
from PySide6.QtWidgets import QHBoxLayout, QVBoxLayout, QWidget

from ..errors import mensaje_error
from ..widgets.feedback import DetailPanel, EmptyState, InlineNotice
from ..widgets.inputs import SearchBar
from ..widgets.primitives import SectionHeader, Toolbar
from ..widgets.table import DataTable


def icono_estado_vacio(clave: str):
    """Pixmap discreto del icono de sección para los estados vacíos (`§5.1`)."""
    from .. import icons, theme

    return icons.pixmap_seccion(
        clave, theme.TOKENS.colores.texto_secundario, 52
    )


class PaginaBase(QWidget):
    """Página con cabecera y una zona de contenido."""

    def __init__(
        self,
        titulo: str,
        subtitulo: str = "",
        accion_texto: str | None = None,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("pagina")
        self.cabecera = SectionHeader(titulo, subtitulo, accion_texto)
        self.barra: Toolbar | None = None
        self._error: InlineNotice | None = None

        self.contenido = QVBoxLayout()
        self.contenido.setContentsMargins(24, 20, 24, 20)
        self.contenido.setSpacing(16)

        self._disposicion = QVBoxLayout(self)
        self._disposicion.setContentsMargins(0, 0, 0, 0)
        self._disposicion.setSpacing(0)
        self._disposicion.addWidget(self.cabecera)

    def activar_barra(self) -> Toolbar:
        """Crea y coloca la barra de herramientas bajo la cabecera."""
        self.barra = Toolbar()
        self._disposicion.addWidget(self.barra)
        return self.barra

    def activar_contenido(self) -> None:
        """Añade la zona de contenido con sus márgenes."""
        self._disposicion.addLayout(self.contenido, 1)

    def mostrar_error(self, exc: BaseException) -> None:
        """Sustituye el aviso de error de la página por el mensaje traducido."""
        self._quitar_error()
        self._error = InlineNotice(mensaje_error(exc), "error")
        self.contenido.insertWidget(0, self._error)

    def _quitar_error(self) -> None:
        if self._error is not None:
            self.contenido.removeWidget(self._error)
            self._error.deleteLater()
            self._error = None

    def cargar(self) -> None:
        """Recarga los datos de la página. Cada página concreta lo implementa."""


class PaginaListado(PaginaBase):
    """Página genérica de listado: buscador, tabla y zona de apoyo."""

    def __init__(
        self,
        titulo: str,
        subtitulo: str,
        columnas: list[str],
        accion_texto: str | None = None,
        placeholder: str = "Buscar por nombre o código…",
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(titulo, subtitulo, accion_texto, parent)
        self._termino = ""
        self.columnas = list(columnas)
        self.buscador = SearchBar(placeholder)
        self.buscador.busqueda_cambiada.connect(self._cambiar_termino)
        self.tabla = DataTable(columnas)
        self.tabla.fila_seleccionada.connect(self._mostrar_detalle)
        self.detalle = DetailPanel()
        self.detalle.cerrado.connect(self._ocultar_detalle)

        barra = self.activar_barra()
        barra.agregar(self.buscador)

        trabajo = QHBoxLayout()
        trabajo.setContentsMargins(0, 0, 0, 0)
        trabajo.setSpacing(16)
        trabajo.addWidget(self.tabla, 1)
        trabajo.addWidget(self.detalle, 0)
        self.contenido.addLayout(trabajo, 1)
        self.activar_contenido()
        self._configurar_estado_vacio()
        self._ocultar_detalle()

    # ------------------------------------------------------------ a implementar
    def _obtener_filas(self, termino: str) -> list[list[Any]]:
        raise NotImplementedError

    def _configurar_estado_vacio(self) -> None:
        self.tabla.configurar_estado_vacio("Todavía no hay registros")

    def _mostrar_detalle(self, indice: int) -> None:
        fila = self.tabla.modelo.fila(indice)
        if not fila:
            self.detalle.mostrar_vacio()
            return
        titulo = str(fila[0])
        pares = [(col, str(valor)) for col, valor in zip(self.columnas[1:], fila[1:])]
        self.detalle.mostrar(titulo, pares)
        self.detalle.setVisible(True)

    def _ocultar_detalle(self) -> None:
        self.detalle.mostrar_vacio()
        self.detalle.setVisible(False)
        vista = self.tabla.tabla
        if vista.currentIndex().isValid():
            vista.setCurrentIndex(QModelIndex())

    # ------------------------------------------------------------------ interno

    def _cambiar_termino(self, termino: str) -> None:
        self._termino = termino
        self.cargar()

    def cargar(self) -> None:
        self._ocultar_detalle()
        try:
            filas = self._obtener_filas(self._termino)
        except Exception as exc:  # noqa: BLE001 - la interfaz nunca se cierra
            self.mostrar_error(exc)
            self.tabla.set_filas([])
            return
        self._quitar_error()
        self.tabla.set_filas(filas)


class PaginaProvisional(PaginaBase):
    """Página navegable cuya funcionalidad llega en una etapa posterior."""

    def __init__(
        self,
        titulo: str,
        subtitulo: str = "",
        etapa: str = "una etapa posterior",
        accion_texto: str | None = None,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(titulo, subtitulo, accion_texto, parent)
        estado = EmptyState(
            titulo="Funcionalidad pendiente",
            explicacion=(
                f"Esta sección se implementa en {etapa}. El armazón y la navegación "
                "ya están en su sitio; no se muestran datos de ejemplo."
            ),
            icono=icono_estado_vacio("estado_vacio"),
        )
        self.contenido.addWidget(estado, 1)
        self.activar_contenido()
