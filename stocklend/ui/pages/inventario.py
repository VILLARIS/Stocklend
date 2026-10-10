"""Pantalla de Inventario (`UI_SCREENS.md` §3).

Una sola tabla compartida por tres pestañas: Artículos, Unidades y Categorías. La
pestaña activa decide las columnas, los delegates, el estado vacío y los datos, pero
la página conserva el contrato de `PaginaListado` (`tabla`, `buscador`, `detalle`,
`cargar`, `_cambiar_termino`, `_mostrar_detalle`).
"""

from __future__ import annotations

from typing import Any

from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QHBoxLayout,
    QLineEdit,
    QTabBar,
    QWidget,
)

from ...domain.enums import EstadoUnidad
from ..dialogs.incidente import IncidenteDialog
from ..dialogs.inventario import (
    AjusteDialog,
    ArticuloDialog,
    CategoriaDialog,
    UnidadEditarDialog,
    UnidadEstadoDialog,
)
from ..widgets.primitives import crear_boton
from ..widgets.table import QuantityCellDelegate, StatusChipDelegate
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
    "No prestable",
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
        self._delegados_activos: list[int] = []

        self.filtro_categoria = QComboBox()
        self.filtro_categoria.setObjectName("filtro_categoria")
        self.filtro_categoria.currentIndexChanged.connect(lambda _i: self.cargar())
        self.barra.agregar(self.filtro_categoria)

        self.alta_categoria = QWidget()
        alta = QHBoxLayout(self.alta_categoria)
        alta.setContentsMargins(0, 0, 0, 0)
        alta.setSpacing(8)
        self.campo_categoria = QLineEdit()
        self.campo_categoria.setObjectName("nueva_categoria")
        self.campo_categoria.setPlaceholderText("Nombre de la categoría…")
        self.campo_categoria.setMinimumWidth(220)
        self.campo_categoria.returnPressed.connect(self._crear_categoria)
        boton_categoria = crear_boton("Añadir", "secundaria")
        boton_categoria.clicked.connect(self._crear_categoria)
        alta.addWidget(self.campo_categoria)
        alta.addWidget(boton_categoria)
        self.barra.agregar_derecha(self.alta_categoria)

        self.pestanas = QTabBar()
        self.pestanas.setObjectName("pestanas_inventario")
        for titulo in ("Artículos", "Unidades", "Categorías"):
            self.pestanas.addTab(titulo)
        self.pestanas.currentChanged.connect(self._cambiar_pestana)
        self._disposicion.insertWidget(2, self.pestanas)

        self.cabecera.accion_pulsada.connect(self._accion_principal)
        self.tabla.accion_vacio.connect(self._accion_principal)
        self._aplicar_pestana(0)

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
            self.tabla.configurar_estado_vacio(
                "Todavía no hay unidades registradas",
                "Las unidades aparecen cuando un artículo usa el control individual.",
                icono=icono_estado_vacio("unidades"),
            )
        elif indice == 2:
            self.columnas = list(COLUMNAS_CATEGORIAS)
            self.columnas_delegado = [(1, QuantityCellDelegate(self.tabla))]
            self.tabla.configurar_estado_vacio(
                "Todavía no hay categorías",
                "Añade la primera con el campo de la barra superior.",
                icono=icono_estado_vacio("categorias"),
            )
        else:
            self.columnas = list(COLUMNAS)
            self.columnas_delegado = [
                (columna, QuantityCellDelegate(self.tabla)) for columna in range(3, 8)
            ]
            self._configurar_estado_vacio()

        self.tabla.set_columnas(self.columnas)
        for columna, delegate in self.columnas_delegado:
            self.tabla.set_delegate(columna, delegate)
            self._delegados_activos.append(columna)

        self.cabecera.accion.setVisible(indice == 0)
        self.filtro_categoria.setVisible(indice == 0)
        self.alta_categoria.setVisible(indice == 2)
        self._recargar_filtro_categoria()
        self._termino = ""
        self.buscador.blockSignals(True)
        self.buscador.clear()
        self.buscador.blockSignals(False)
        self.cargar()

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
            articulos = self._inventario.listar_articulos(limite=1000, categoria_id=categoria_id)
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
                "No" if articulo.prestable else "Sí",
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
            nombre = personas.get(prestamo.estudiante_id, "—")
            for detalle in self._s.prestamos.detalles(prestamo.id):
                indice[detalle.id] = (prestamo.folio, nombre)
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
                self._inventario.listar_articulos(
                    categoria_id=categoria.id, limite=1000
                )
            )
            filas.append([categoria.nombre, cuantos])
            registros.append(categoria)
        self._registros = registros
        return filas

    # ------------------------------------------------------------------- menú

    def _acciones_fila(self, indice: int) -> list[tuple]:
        registro = self._registro(indice)
        if registro is None:
            return []
        if self._pestana == 1:
            return self._menu_unidad(registro)
        if self._pestana == 2:
            return [
                ("Editar categoría", lambda: self._editar_categoria(registro)),
            ]
        return self._menu_articulo(registro)

    def _menu_articulo(self, articulo) -> list[tuple]:
        control = articulo.control_individual
        return [
            ("Editar artículo", lambda: self._editar_articulo(articulo)),
            (
                "Ajustar existencias",
                None if control else lambda: self._ajustar(articulo),
                not control,
            ),
            (
                "Ver unidades",
                lambda: self._ver_unidades(articulo),
                control,
            ),
            ("Registrar incidencia", lambda: self._incidencia()),
        ]

    def _menu_unidad(self, unidad) -> list[tuple]:
        prestada = unidad.estado == EstadoUnidad.PRESTADA
        return [
            ("Editar unidad", lambda: self._editar_unidad(unidad)),
            (
                "Cambiar estado",
                None if prestada else lambda: self._cambiar_estado(unidad),
                not prestada,
            ),
            ("Registrar incidencia", lambda: self._incidencia()),
        ]

    # ------------------------------------------------------------------ acciones

    def _accion_principal(self) -> None:
        if self._pestana == 0:
            self._alta_articulo()
        elif self._pestana == 2:
            self.campo_categoria.setFocus()

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
