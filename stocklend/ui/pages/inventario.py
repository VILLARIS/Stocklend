"""Pantalla de Inventario (`UI_SCREENS.md` §3).

Cabecera, cuatro tarjetas de resumen con cifras reales, un contenedor principal con
pestañas compactas (Artículos, Unidades, Categorías), la fila de búsqueda y filtro y
la tabla rediseñada. Una sola tabla compartida por las tres pestañas: la pestaña
activa decide las columnas, los delegates, el estado vacío y los datos, pero la
página conserva el contrato de `PaginaListado` (`tabla`, `buscador`, `detalle`,
`cargar`, `_cambiar_termino`, `_mostrar_detalle`).

El rediseño es **solo de Inventario**: no toca la barra lateral, el esquema ni las
reglas de negocio. Las cifras de las tarjetas salen de un agregado SQL.
"""

from __future__ import annotations

from typing import Any

from PySide6.QtCore import QSize
from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QTabBar,
    QVBoxLayout,
    QWidget,
)

from ...domain.enums import EstadoUnidad
from .. import icons, theme
from ..dialogs.incidente import IncidenteDialog
from ..dialogs.inventario import (
    AjusteDialog,
    ArticuloDialog,
    CategoriaDialog,
    UnidadEditarDialog,
    UnidadEstadoDialog,
)
from ..widgets.feedback import FilaEstadisticas
from ..widgets.primitives import crear_boton
from ..widgets.table import (
    AccionesCellDelegate,
    NameCellDelegate,
    QuantityCellDelegate,
    StatusChipDelegate,
)
from ..widgets.tarjeta_imagen import StatCardImagen
from .base import PaginaListado, icono_estado_vacio

COLUMNAS = [
    "Nombre",
    "Código",
    "Categoría",
    "Disponible",
    "Prestado",
    "Dañado",
    "Faltante",
    "Total",
    "Estado",
    "Acciones",
]

COLUMNAS_UNIDADES = [
    "Código",
    "Artículo",
    "Categoría",
    "Estado",
    "Estudiante",
    "Préstamo",
    "Incidente",
]

COLUMNAS_CATEGORIAS = ["Categoría", "Artículos"]

_PESTANAS = (
    ("Artículos", "inventario"),
    ("Unidades", "unidades"),
    ("Categorías", "categorias"),
)

_ETIQUETA_UNIDAD = {
    EstadoUnidad.DISPONIBLE: "Disponible",
    EstadoUnidad.PRESTADA: "Prestada",
    EstadoUnidad.DANADA: "Dañada",
    EstadoUnidad.FALTANTE: "Faltante",
    EstadoUnidad.BAJA: "Baja",
}


class PaginaInventario(PaginaListado):
    def __init__(self, servicios, parent=None) -> None:
        super().__init__(
            "Inventario",
            "Artículos, unidades y existencias",
            COLUMNAS,
            accion_texto="+ Artículo",
            placeholder="Buscar por nombre o código…",
            parent=parent,
        )
        self._s = servicios
        self._inventario = servicios.inventario
        self._unidades = servicios.unidades
        self._pestana = 0
        self._columna_acciones = len(COLUMNAS) - 1
        self._delegados_activos: list[int] = []

        self._crear_filtros()
        self._preparar_tabla()
        self._crear_pestanas()
        self._crear_tarjetas()
        self._reorganizar_disposicion()

        self.cabecera.accion_pulsada.connect(self._accion_principal)
        self.tabla.accion_vacio.connect(self._accion_principal)
        self.tabla.tabla.clicked.connect(self._clic_celda)
        self._aplicar_pestana(0)

    # -------------------------------------------------------------- construcción

    def _crear_filtros(self) -> None:
        self.filtro_categoria = QComboBox()
        self.filtro_categoria.setObjectName("filtro_categoria")
        self.filtro_categoria.setMinimumWidth(200)
        self.filtro_categoria.setMaximumWidth(260)
        self.filtro_categoria.currentIndexChanged.connect(lambda _i: self.cargar())

        self.alta_categoria = QWidget()
        self.alta_categoria.setObjectName("alta_categoria")
        alta = QHBoxLayout(self.alta_categoria)
        alta.setContentsMargins(0, 0, 0, 0)
        alta.setSpacing(8)
        self.campo_categoria = QLineEdit()
        self.campo_categoria.setObjectName("nueva_categoria")
        self.campo_categoria.setPlaceholderText("Nombre de la categoría…")
        self.campo_categoria.setMinimumWidth(220)
        self.campo_categoria.returnPressed.connect(self._crear_categoria)
        self.boton_categoria = crear_boton("Añadir", "secundaria")
        self.boton_categoria.clicked.connect(self._crear_categoria)
        alta.addWidget(self.campo_categoria)
        alta.addWidget(self.boton_categoria)

    def _preparar_tabla(self) -> None:
        """Prepara la vista de tabla con la identidad visual de Inventario."""
        vista = self.tabla.tabla
        vista.setObjectName("tabla_inventario")
        vista.verticalHeader().setDefaultSectionSize(44)
        cabecera = vista.horizontalHeader()
        cabecera.setObjectName("cabecera_inventario")
        cabecera.setFixedHeight(44)
        cabecera.setMinimumSectionSize(64)
        self.buscador.setMinimumWidth(260)
        self.buscador.setMaximumWidth(420)
        self.buscador.addAction(
            icons.icono_seccion(
                "buscar", theme.TOKENS.colores.texto_secundario, 16
            ),
            QLineEdit.ActionPosition.LeadingPosition,
        )

    def _separador(self) -> QFrame:
        separador = QFrame()
        separador.setObjectName("separador_inventario")
        separador.setFrameShape(QFrame.Shape.HLine)
        separador.setFixedHeight(1)
        return separador

    def _crear_pestanas(self) -> None:
        self.pestanas = QTabBar()
        self.pestanas.setObjectName("pestanas_inventario")
        self.pestanas.setExpanding(False)
        self.pestanas.setDrawBase(False)
        self.pestanas.setUsesScrollButtons(False)
        self.pestanas.setIconSize(QSize(18, 18))
        for titulo, clave in _PESTANAS:
            self.pestanas.addTab(
                icons.icono_seccion(clave, theme.TOKENS.colores.texto_secundario), titulo
            )
        self.pestanas.currentChanged.connect(self._cambiar_pestana)

    def _crear_tarjetas(self) -> None:
        self.tarjeta_articulos = StatCardImagen(
            "card_articulos_bg.png", "Artículos registrados", "0"
        )
        self.tarjeta_unidades = StatCardImagen(
            "card_unidades_bg.png", "Unidades en existencia", "0"
        )
        self.tarjeta_disponibles = StatCardImagen(
            "card_disponibles_bg.png", "Disponibles listas para prestar", "0"
        )
        self.tarjeta_prestadas = StatCardImagen(
            "card_prestadas_bg.png", "Prestadas fuera con estudiantes", "0"
        )
        self.fila_estadisticas = FilaEstadisticas(
            [
                self.tarjeta_articulos,
                self.tarjeta_unidades,
                self.tarjeta_disponibles,
                self.tarjeta_prestadas,
            ]
        )

    def _reorganizar_disposicion(self) -> None:
        """Reordena el armazón de `PaginaListado` al diseño de la pantalla."""
        # El buscador pasa de la barra de herramientas a la fila de filtros.
        self.buscador.setParent(self)
        self._disposicion.removeWidget(self.barra)
        self.barra.setParent(None)
        self.barra.deleteLater()
        self.barra = None

        # `PaginaListado` dejó la tabla y el detalle dentro de `contenido`.
        trabajo = self.contenido.itemAt(0)
        if trabajo is not None and trabajo.layout() is not None:
            self.contenido.removeItem(trabajo)

        filtros = QWidget()
        filtros.setObjectName("filtro_inventario")
        fila = QHBoxLayout(filtros)
        fila.setContentsMargins(16, 12, 16, 12)
        fila.setSpacing(12)
        fila.addWidget(self.buscador)
        fila.addWidget(self.filtro_categoria)
        fila.addStretch(1)
        fila.addWidget(self.alta_categoria)

        self.pie_tabla = QWidget()
        self.pie_tabla.setObjectName("pie_tabla")
        pie = QHBoxLayout(self.pie_tabla)
        pie.setContentsMargins(2, 8, 2, 4)
        pie.setSpacing(8)
        self.etiqueta_pie = QLabel()
        self.etiqueta_pie.setObjectName("texto_pie")
        pie.addWidget(self.etiqueta_pie)
        pie.addStretch(1)

        area = QWidget()
        area_layout = QVBoxLayout(area)
        area_layout.setContentsMargins(16, 12, 16, 8)
        area_layout.setSpacing(8)
        zona = QHBoxLayout()
        zona.setContentsMargins(0, 0, 0, 0)
        zona.setSpacing(16)
        zona.addWidget(self.tabla, 1)
        zona.addWidget(self.detalle, 0)
        area_layout.addLayout(zona, 1)
        area_layout.addWidget(self._separador())
        area_layout.addWidget(self.pie_tabla)

        self.contenedor = QFrame()
        self.contenedor.setObjectName("contenedor_inventario")
        cont = QVBoxLayout(self.contenedor)
        cont.setContentsMargins(0, 0, 0, 0)
        cont.setSpacing(0)
        cont.addWidget(self.pestanas)
        cont.addWidget(self._separador())
        cont.addWidget(filtros)
        cont.addWidget(self._separador())
        cont.addWidget(area, 1)

        self.contenido.addWidget(self.fila_estadisticas)
        self.contenido.addWidget(self.contenedor, 1)

    # ------------------------------------------------------------------ pestañas

    def _configurar_estado_vacio(self) -> None:
        self.tabla.configurar_estado_vacio(
            "Todavía no hay artículos registrados",
            "Registra el primero para empezar a controlar las existencias.",
            "Registrar el primero",
            icono_estado_vacio("inventario"),
        )

    def _cambiar_pestana(self, indice: int) -> None:
        if indice == self._pestana:
            return
        self._aplicar_pestana(indice)

    def _aplicar_pestana(self, indice: int) -> None:
        self._pestana = indice
        for columna in self._delegados_activos:
            self.tabla.set_delegate(columna, None)
        self._delegados_activos = []

        if indice == 1:
            self.columnas = list(COLUMNAS_UNIDADES)
            self.columnas_delegado = [(3, StatusChipDelegate(self.tabla))]
            self.tabla.modelo.set_columnas_derecha([])
            self.tabla.configurar_estado_vacio(
                "Todavía no hay unidades registradas",
                "Las unidades aparecen cuando un artículo usa el control individual.",
                icono=icono_estado_vacio("unidades"),
            )
        elif indice == 2:
            self.columnas = list(COLUMNAS_CATEGORIAS)
            self.columnas_delegado = [(1, QuantityCellDelegate(self.tabla))]
            self.tabla.modelo.set_columnas_derecha([1])
            self.tabla.configurar_estado_vacio(
                "Todavía no hay categorías",
                "Añade la primera con el campo de la barra superior.",
                icono=icono_estado_vacio("categorias"),
            )
        else:
            self.columnas = list(COLUMNAS)
            self.columnas_delegado = [
                (0, NameCellDelegate(self.tabla)),
                (3, QuantityCellDelegate(self.tabla)),
                (4, QuantityCellDelegate(self.tabla)),
                (
                    5,
                    QuantityCellDelegate(
                        self.tabla,
                        alerta=True,
                        color_alerta=theme.TOKENS.colores.advertencia_texto,
                    ),
                ),
                (
                    6,
                    QuantityCellDelegate(
                        self.tabla,
                        alerta=True,
                        color_alerta=theme.TOKENS.colores.error,
                    ),
                ),
                (7, QuantityCellDelegate(self.tabla)),
                (8, StatusChipDelegate(self.tabla)),
                (self._columna_acciones, AccionesCellDelegate(self.tabla)),
            ]
            self.tabla.modelo.set_columnas_derecha([3, 4, 5, 6, 7])
            self._configurar_estado_vacio()

        self.tabla.set_columnas(self.columnas)
        for columna, delegate in self.columnas_delegado:
            self.tabla.set_delegate(columna, delegate)
            self._delegados_activos.append(columna)
        self._configurar_cabecera(articulos=indice == 0)
        self._actualizar_iconos_pestanas(indice)

        self.cabecera.accion.setVisible(indice == 0)
        self.filtro_categoria.setVisible(indice == 0)
        self.alta_categoria.setVisible(indice == 2)
        self._recargar_filtro_categoria()
        self._termino = ""
        self.buscador.blockSignals(True)
        self.buscador.clear()
        self.buscador.blockSignals(False)
        self.cargar()

    def _actualizar_iconos_pestanas(self, activa: int) -> None:
        for posicion, (_titulo, clave) in enumerate(_PESTANAS):
            color = (
                theme.TOKENS.colores.azul_primario
                if posicion == activa
                else theme.TOKENS.colores.texto_secundario
            )
            self.pestanas.setTabIcon(posicion, icons.icono_seccion(clave, color))

    def _configurar_cabecera(self, *, articulos: bool) -> None:
        cabecera = self.tabla.tabla.horizontalHeader()
        cabecera.setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
        if not articulos:
            cabecera.setStretchLastSection(True)
            return
        cabecera.setStretchLastSection(False)
        cabecera.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        cabecera.setSectionResizeMode(
            self._columna_acciones, QHeaderView.ResizeMode.Fixed
        )
        ancho_acciones = max(
            88, min(150, cabecera.sectionSizeHint(self._columna_acciones))
        )
        for columna, ancho in {
            1: 130,
            2: 150,
            3: 104,
            4: 100,
            5: 92,
            6: 92,
            7: 92,
            8: 124,
            self._columna_acciones: ancho_acciones,
        }.items():
            self.tabla.tabla.setColumnWidth(columna, ancho)

    def _recargar_filtro_categoria(self) -> None:
        actual = self.filtro_categoria.currentData()
        self.filtro_categoria.blockSignals(True)
        self.filtro_categoria.clear()
        self.filtro_categoria.addItem("Todas las categorías", None)
        for categoria in self._inventario.listar_categorias(limite=1000):
            self.filtro_categoria.addItem(categoria.nombre, categoria.id)
        indice = self.filtro_categoria.findData(actual)
        self.filtro_categoria.setCurrentIndex(max(0, indice))
        self.filtro_categoria.blockSignals(False)

    # ------------------------------------------------------------------- datos

    def cargar(self) -> None:
        super().cargar()
        self._actualizar_resumen()
        self._actualizar_pie()

    def _actualizar_pie(self) -> None:
        """Cuenta real de la tabla visible, para el pie del contenedor."""
        if not hasattr(self, "etiqueta_pie"):
            return
        total = self.tabla.modelo.rowCount()
        base = {0: "artículo", 1: "unidad", 2: "categoría"}.get(self._pestana, "registro")
        plural = "" if total == 1 else "s"
        self.etiqueta_pie.setText(f"{total} {base}{plural}")

    def _actualizar_resumen(self) -> None:
        try:
            resumen = self._inventario.resumen()
        except Exception as exc:  # noqa: BLE001 - la interfaz nunca se cierra
            self.mostrar_error(exc)
            return
        self.tarjeta_articulos.set_valores(resumen.articulos)
        self.tarjeta_unidades.set_valores(resumen.unidades_total)
        self.tarjeta_disponibles.set_valores(resumen.disponibles)
        self.tarjeta_prestadas.set_valores(resumen.prestadas)

    def _obtener_filas(self, termino: str) -> list[list[Any]]:
        self._registros = []
        if self._pestana == 1:
            return self._filas_unidades(termino)
        if self._pestana == 2:
            return self._filas_categorias(termino)
        return self._filas_articulos(termino)

    def _categorias_nombres(self) -> dict[int, str]:
        return {
            categoria.id: categoria.nombre
            for categoria in self._inventario.listar_categorias(limite=1000)
            if categoria.id is not None
        }

    def _filas_articulos(self, termino: str) -> list[list[Any]]:
        nombres = self._categorias_nombres()
        categoria_id = self.filtro_categoria.currentData()
        if termino:
            articulos = self._inventario.buscar_articulos(termino, limite=1000)
        else:
            articulos = self._inventario.listar_articulos(
                limite=1000, categoria_id=categoria_id
            )
        if termino and categoria_id is not None:
            articulos = [a for a in articulos if a.categoria_id == categoria_id]
        self._registros = articulos
        return [
            [
                articulo.nombre,
                articulo.codigo or "—",
                nombres.get(articulo.categoria_id, "—"),
                articulo.cantidad_disponible,
                articulo.cantidad_prestada,
                articulo.cantidad_daniada,
                articulo.cantidad_faltante,
                articulo.cantidad_total,
                "Prestable" if articulo.prestable else "No prestable",
                "⋯",
            ]
            for articulo in articulos
        ]

    def _filas_unidades(self, termino: str) -> list[list[Any]]:
        nombres = self._categorias_nombres()
        articulos = {
            articulo.id: articulo
            for articulo in self._inventario.listar_articulos(limite=1000)
        }
        prestamos = self._prestamos_por_detalle()
        incidentes = self._incidentes_por_unidad()
        filas: list[list[Any]] = []
        registros: list[Any] = []
        for articulo in articulos.values():
            if not articulo.control_individual:
                continue
            for unidad in self._unidades.listar_por_articulo(articulo.id, limite=1000):
                texto = f"{unidad.codigo} {articulo.nombre}"
                if termino and termino.lower() not in texto.lower():
                    continue
                folio, estudiante = prestamos.get(unidad.prestamo_detalle_id, ("—", "—"))
                incidencia = incidentes.get(unidad.id)
                filas.append(
                    [
                        unidad.codigo,
                        articulo.nombre,
                        nombres.get(articulo.categoria_id, "—"),
                        _ETIQUETA_UNIDAD.get(unidad.estado, "—"),
                        estudiante,
                        folio,
                        f"INC-{incidencia.id:04d}" if incidencia is not None else "—",
                    ]
                )
                registros.append(unidad)
        self._registros = registros
        return filas

    def _prestamos_por_detalle(self) -> dict[int, tuple[str, str]]:
        personas = {
            persona.id: f"{persona.nombres} {persona.apellidos}"
            for persona in self._s.estudiantes.listar_estudiantes(limite=1000)
        }
        indice: dict[int, tuple[str, str]] = {}
        for prestamo in self._s.prestamos.listar_prestamos(limite=1000):
            for detalle in self._s.prestamos.detalles(prestamo.id):
                indice[detalle.id] = (
                    prestamo.folio,
                    personas.get(prestamo.estudiante_id, "—"),
                )
        return indice

    def _incidentes_por_unidad(self) -> dict[int, Any]:
        indice: dict[int, Any] = {}
        for incidente in self._s.incidentes.listar_incidentes(limite=1000):
            if incidente.articulo_unidad_id is not None:
                indice[incidente.articulo_unidad_id] = incidente
        return indice

    def _filas_categorias(self, termino: str) -> list[list[Any]]:
        categorias = self._inventario.listar_categorias(limite=1000)
        registros = []
        filas = []
        for categoria in categorias:
            if termino and termino.lower() not in categoria.nombre.lower():
                continue
            cuantos = len(
                self._inventario.listar_articulos(categoria_id=categoria.id, limite=1000)
            )
            filas.append([categoria.nombre, cuantos])
            registros.append(categoria)
        self._registros = registros
        return filas

    # --------------------------------------------------------------------- menú

    def _clic_celda(self, indice) -> None:
        if self._pestana == 0 and indice.column() == self._columna_acciones:
            rect = self.tabla.tabla.visualRect(indice)
            self._abrir_menu_fila(rect.center())

    def _acciones_fila(self, indice: int) -> list[tuple]:
        registro = self._registro(indice)
        if registro is None:
            return []
        if self._pestana == 1:
            return self._menu_unidad(registro)
        if self._pestana == 2:
            return [("Editar categoría", lambda: self._editar_categoria(registro))]
        return self._menu_articulo(registro)

    def _menu_articulo(self, articulo) -> list[tuple]:
        return [
            ("Editar artículo", lambda: self._editar_articulo(articulo)),
            (
                "Ajustar existencias",
                None if articulo.control_individual else lambda: self._ajustar(articulo),
                not articulo.control_individual,
            ),
            (
                "Ver unidades",
                None if not articulo.control_individual else lambda: self._ver_unidades(articulo),
                articulo.control_individual,
            ),
            ("Registrar incidente", lambda: self._incidencia()),
        ]

    def _menu_unidad(self, unidad) -> list[tuple]:
        puede_cambiar = unidad.estado is not EstadoUnidad.PRESTADA
        return [
            ("Editar unidad", lambda: self._editar_unidad(unidad)),
            (
                "Cambiar estado",
                None if not puede_cambiar else lambda: self._cambiar_estado(unidad),
                puede_cambiar,
            ),
            ("Registrar incidente", lambda: self._incidencia()),
        ]

    # ------------------------------------------------------------------ acciones

    def _accion_principal(self) -> None:
        if self._pestana == 0:
            self._alta_articulo()
        elif self._pestana == 2:
            self._crear_categoria()

    def _alta_articulo(self) -> None:
        dialogo = ArticuloDialog(
            self._inventario,
            self._unidades,
            self._inventario.listar_categorias(limite=1000),
            parent=self.window(),
        )
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Artículo registrado.")
            self._recargar_filtro_categoria()
            self.cargar()

    def _editar_articulo(self, articulo) -> None:
        dialogo = ArticuloDialog(
            self._inventario,
            self._unidades,
            self._inventario.listar_categorias(limite=1000),
            articulo=articulo,
            parent=self.window(),
        )
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Artículo actualizado.")
            self.cargar()

    def _ajustar(self, articulo) -> None:
        dialogo = AjusteDialog(self._inventario, articulo, parent=self.window())
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Existencias ajustadas.")
            self.cargar()

    def _crear_categoria(self) -> None:
        if self._pestana != 2:
            return
        nombre = self.campo_categoria.text().strip()
        if not nombre:
            return
        try:
            self._inventario.registrar_categoria(nombre)
        except Exception as exc:  # noqa: BLE001 - se informa sin cerrar la interfaz
            self.avisar(str(exc), "atencion")
            return
        self.campo_categoria.clear()
        self.avisar(f"Categoría «{nombre}» registrada.")
        self._recargar_filtro_categoria()
        self.cargar()

    def _editar_categoria(self, categoria) -> None:
        dialogo = CategoriaDialog(self._inventario, categoria=categoria, parent=self.window())
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Categoría actualizada.")
            self._recargar_filtro_categoria()
            self.cargar()

    def _editar_unidad(self, unidad) -> None:
        dialogo = UnidadEditarDialog(self._unidades, unidad, parent=self.window())
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Unidad actualizada.")
            self.cargar()

    def _cambiar_estado(self, unidad) -> None:
        dialogo = UnidadEstadoDialog(self._unidades, unidad, parent=self.window())
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Estado de la unidad actualizado.")
            self.cargar()

    def _ver_unidades(self, articulo) -> None:
        self.pestanas.setCurrentIndex(1)
        self.buscador.setText(articulo.nombre)
        self._cambiar_termino(articulo.nombre)

    def _incidencia(self) -> None:
        s = self._s
        dialogo = IncidenteDialog(
            s.incidentes, s.inventario, s.estudiantes, s.prestamos, s.unidades,
            parent=self.window(),
        )
        if dialogo.exec() == QDialog.DialogCode.Accepted:
            self.avisar("Incidente registrado.")
            self.cargar()
