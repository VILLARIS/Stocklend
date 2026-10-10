"""Diálogos de Préstamos (`UI_SCREENS.md` §5).

`NuevoPrestamoDialog` es un asistente en tres pasos: elegir estudiante, armar los
artículos del préstamo y confirmar. Al terminar llama a
`PrestamoService.registrar_prestamo` y deja el préstamo en ``resultado`` (los
tests pueden invocar ``enviar()`` sin abrir el modal). `DetallePrestamoDialog`
es la vista de solo lectura de un préstamo y sus renglones.
"""

from __future__ import annotations

from dataclasses import dataclass

from PySide6.QtCore import QDate, Qt
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDateTimeEdit,
    QDialog,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QScrollArea,
    QStackedWidget,
    QVBoxLayout,
    QWidget,
)

from ...domain.enums import EstadoUnidad
from ...services import LineaPrestamo
from ..errors import mensaje_error
from ..formatters import cantidad, fecha_hora
from ..widgets.feedback import InlineNotice
from ..widgets.inputs import QuantityInput, TextArea
from ..widgets.primitives import crear_boton
from .seleccion import BuscadorResultados

_ETIQUETA_ESTADO_DETALLE = {
    "pendiente": "Pendiente",
    "parcial": "Parcial",
    "devuelto": "Devuelto",
    "con_incidente": "Con incidente",
}
_ETIQUETA_ESTADO_PRESTAMO = {"activo": "Activo", "cerrado": "Cerrado", "anulado": "Anulado"}


@dataclass(frozen=True, slots=True)
class _LineaUI:
    """Renglón del asistente: artículo y elegida de cantidad o unidades."""

    articulo: object
    widget: QWidget
    entrada_cantidad: QuantityInput | None = None
    combo_unidades: QComboBox | None = None


class NuevoPrestamoDialog(QDialog):
    """Asistente de préstamo (estudiante → artículos → confirmación)."""

    def __init__(
        self,
        servicio_prestamos,
        servicio_estudiantes,
        servicio_inventario,
        servicio_unidades,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("dialogo_prestamo")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setWindowTitle("Registrar préstamo")
        self.setModal(True)
        self.setFixedWidth(600)
        self.setWindowFlag(Qt.WindowType.WindowContextHelpButtonHint, False)
        self._prestamos = servicio_prestamos
        self._estudiantes = servicio_estudiantes
        self._inventario = servicio_inventario
        self._unidades = servicio_unidades
        self._lineas: list[_LineaUI] = []
        self.estudiante: object | None = None
        self.resultado: object = None
        self._enviando = False

        titulo = QLabel("Registrar préstamo")
        titulo.setObjectName("subtitulo")
        self._pasos = QStackedWidget()
        self._error = InlineNotice("", "error")
        self._error.setVisible(False)

        self.boton_atras = crear_boton("Atrás", "secundaria")
        self.boton_atras.clicked.connect(self._atras)
        self.boton_continuar = crear_boton("Continuar", "primaria")
        self.boton_continuar.setObjectName("accion_formulario")
        self.boton_continuar.clicked.connect(self._continuar)
        self.boton_cancelar = crear_boton("Cancelar", "secundaria")
        self.boton_cancelar.clicked.connect(self.reject)

        self._pasos.addWidget(self._paso_estudiante())
        self._pasos.addWidget(self._paso_articulos())
        self._pasos.addWidget(self._paso_resumen())
        self._ir_a(0)

        disposicion = QVBoxLayout(self)
        disposicion.setContentsMargins(24, 20, 24, 20)
        disposicion.setSpacing(12)
        disposicion.addWidget(titulo)
        disposicion.addWidget(self._error)
        disposicion.addWidget(self._pasos, 1)

        botones = QHBoxLayout()
        self.boton_atras.setVisible(False)
        botones.addWidget(self.boton_atras)
        botones.addStretch(1)
        botones.addWidget(self.boton_cancelar)
        botones.addWidget(self.boton_continuar)
        disposicion.addLayout(botones)

    # ---------------------------------------------------------------- pasos

    def _paso_estudiante(self) -> QWidget:
        pagina = QWidget()
        texto = QLabel("Paso 1 de 3 · ¿Quién recibe el material?")
        texto.setProperty("campo", "etiqueta")
        self.buscador_estudiante = BuscadorResultados(
            "Buscar por nombre o código…",
            self._buscar_estudiantes,
        )
        self._nota_inactivo = QLabel("")
        self._nota_inactivo.setWordWrap(True)
        self.buscador_estudiante.elegida.connect(self._estudiante_elegido)

        disposicion = QVBoxLayout(pagina)
        disposicion.setContentsMargins(0, 0, 0, 0)
        disposicion.setSpacing(10)
        disposicion.addWidget(texto)
        disposicion.addWidget(self.buscador_estudiante)
        disposicion.addWidget(self._nota_inactivo)
        return pagina

    def _paso_articulos(self) -> QWidget:
        pagina = QWidget()
        texto = QLabel("Paso 2 de 3 · ¿Qué artículos se entregan?")
        texto.setProperty("campo", "etiqueta")

        self.buscador_articulo = BuscadorResultados(
            "Buscar artículo para agregar…",
            self._buscar_articulos,
        )
        fila_agregar = QHBoxLayout()
        fila_agregar.addWidget(self.buscador_articulo, 1)
        self.boton_agregar = crear_boton("Agregar artículo", "secundaria")
        self.boton_agregar.clicked.connect(self._agregar_seleccionado)
        fila_agregar.addWidget(self.boton_agregar)

        self._aviso_repetido = InlineNotice("", "atencion")
        self._aviso_repetido.setVisible(False)

        self.area_lineas = QScrollArea()
        self.area_lineas.setWidgetResizable(True)
        self.area_lineas.setFrameShape(QScrollArea.Shape.NoFrame)
        self.contenedor_lineas = QWidget()
        self.disposicion_lineas = QVBoxLayout(self.contenedor_lineas)
        self.disposicion_lineas.setContentsMargins(0, 0, 0, 0)
        self.disposicion_lineas.setSpacing(10)
        self.area_lineas.setWidget(self.contenedor_lineas)
        self._vacio_lineas = InlineNotice(
            "Todavía no hay artículos. Agrega al menos uno (RN-17).", "info"
        )
        self.disposicion_lineas.addWidget(self._vacio_lineas)

        disposicion = QVBoxLayout(pagina)
        disposicion.setContentsMargins(0, 0, 0, 0)
        disposicion.setSpacing(10)
        disposicion.addWidget(texto)
        disposicion.addLayout(fila_agregar)
        disposicion.addWidget(self._aviso_repetido)
        disposicion.addWidget(self.area_lineas, 1)
        return pagina

    def _paso_resumen(self) -> QWidget:
        pagina = QWidget()
        texto = QLabel("Paso 3 de 3 · Revisa antes de registrar")
        texto.setProperty("campo", "etiqueta")

        self.resumen = QListWidget()
        self.resumen.setObjectName("lista_resumen")
        self.resumen.setUniformItemSizes(True)

        self.comentario = TextArea(maximo=200, lineas=2)
        forma = QWidget()
        formulario = QFormLayout(forma)
        formulario.setContentsMargins(0, 0, 0, 0)
        formulario.addRow("Comentario (opcional)", self.comentario)

        fila_limite = QHBoxLayout()
        self.sin_limite = QCheckBox("Sin fecha límite")
        self.sin_limite.setChecked(True)
        self.sin_limite.toggled.connect(self._alternar_limite)
        self.fecha_limite = QDateTimeEdit()
        self.fecha_limite.setDisplayFormat("yyyy-MM-dd HH:mm")
        self.fecha_limite.setCalendarPopup(True)
        self.fecha_limite.setMinimumWidth(200)
        self.fecha_limite.setDate(QDate.currentDate())
        self.fecha_limite.setMinimumDate(QDate.currentDate())
        self.fecha_limite.setEnabled(False)
        fila_limite.addWidget(QLabel("Límite de devolución (opcional)"))
        fila_limite.addWidget(self.fecha_limite, 1)
        fila_limite.addWidget(self.sin_limite)
        formulario.addRow(fila_limite)

        disposicion = QVBoxLayout(pagina)
        disposicion.setContentsMargins(0, 0, 0, 0)
        disposicion.setSpacing(10)
        disposicion.addWidget(texto)
        disposicion.addWidget(self.resumen)
        disposicion.addWidget(forma)
        return pagina

    def _alternar_limite(self, sin_limite: bool) -> None:
        self.fecha_limite.setEnabled(not sin_limite)

    # ---------------------------------------------------------------- datos

    def _buscar_estudiantes(self, termino: str) -> "list[tuple[str, object]]":
        pares = []
        for persona in self._estudiantes.buscar_estudiantes(termino, limite=50):
            etiqueta = f"{persona.codigo_universitario}  ·  {persona.nombres} {persona.apellidos}"
            if not persona.activo:
                etiqueta += "  ·  Inactivo"
            pares.append((etiqueta, persona))
        return pares

    def _buscar_articulos(self, termino: str) -> "list[tuple[str, object]]":
        pares = []
        for articulo in self._inventario.buscar_articulos(termino, limite=50):
            if not articulo.activo or not articulo.prestable:
                continue
            codigo = f"  ·  {articulo.codigo}" if articulo.codigo else ""
            etiqueta = (
                f"{articulo.nombre}{codigo}  ·  "
                f"{cantidad(articulo.cantidad_disponible)} disponibles"
            )
            pares.append((etiqueta, articulo))
        return pares

    def _estudiante_elegido(self, persona) -> None:
        self.estudiante = persona
        if not persona.activo:
            self._nota_inactivo.setObjectName("mensaje_error")
            self._nota_inactivo.setText(
                "Este estudiante está inactivo y no puede recibir préstamos nuevos"
                " (RF-EST-06). El botón «Continuar» queda deshabilitado."
            )
        else:
            self._nota_inactivo.setObjectName("texto_ayuda")
            self._nota_inactivo.setText(
                f"{persona.nombres} {persona.apellidos} · {persona.codigo_universitario}"
            )
        self._reestilar(self._nota_inactivo)

    def _agregar_seleccionado(self) -> None:
        self._aviso_repetido.setVisible(False)
        articulo = self.buscador_articulo.dato_actual()
        if articulo is None:
            return
        if any(fila.articulo.id == articulo.id for fila in self._lineas):
            self._aviso_repetido.set_texto(
                f"'{articulo.nombre}' ya está en la lista; se entrega una sola vez (RN-18)."
            )
            self._aviso_repetido.setVisible(True)
            return
        linea = self._crear_fila(articulo)
        self._lineas.append(linea)
        self._vacio_lineas.setVisible(False)
        self.disposicion_lineas.addWidget(linea.widget)
        self.buscador_articulo.limpiar()

    def _crear_fila(self, articulo) -> _LineaUI:
        codigo = f"  ·  {articulo.codigo}" if articulo.codigo else ""
        etiqueta = QLabel(
            f"{articulo.nombre}{codigo}  ·  "
            f"{cantidad(articulo.cantidad_disponible)} disponibles"
        )
        etiqueta.setWordWrap(True)
        entrada_cantidad: QuantityInput | None = None
        combo_unidades: QComboBox | None = None
        if articulo.control_individual:
            combo_unidades = self._combo_unidades(articulo)
            selector = combo_unidades
        else:
            entrada_cantidad = QuantityInput(1, maximo=max(0, articulo.cantidad_disponible))
            selector = entrada_cantidad

        quitar = crear_boton("Quitar", "terciaria")
        fila = QWidget()
        disposicion = QHBoxLayout(fila)
        disposicion.setContentsMargins(0, 0, 0, 0)
        disposicion.setSpacing(8)
        disposicion.addWidget(etiqueta, 1)
        disposicion.addWidget(selector)
        disposicion.addWidget(quitar)
        quitar.clicked.connect(lambda _=False, w=fila: self._remover_linea(w))
        return _LineaUI(articulo, fila, entrada_cantidad, combo_unidades)

    def _combo_unidades(self, articulo) -> QComboBox:
        combo = QComboBox()
        disponibles = self._unidades.listar_por_articulo(
            articulo.id, estado=EstadoUnidad.DISPONIBLE, limite=500
        )
        if not disponibles:
            combo.addItem("Sin unidades disponibles", None)
            combo.setEnabled(False)
        for unidad in disponibles:
            combo.addItem(unidad.codigo, unidad.id)
        return combo

    def _remover_linea(self, widget: QWidget) -> None:
        for fila in list(self._lineas):
            if fila.widget is not widget:
                continue
            self._lineas.remove(fila)
            self.disposicion_lineas.removeWidget(widget)
            widget.deleteLater()
            break
        if not self._lineas:
            self._vacio_lineas.setVisible(True)

    def _lineas_prestamo(self) -> list[LineaPrestamo]:
        lineas = []
        for fila in self._lineas:
            if fila.entrada_cantidad is not None:
                cantidad_n = fila.entrada_cantidad.valor()
                if cantidad_n > 0:
                    lineas.append(LineaPrestamo(fila.articulo.id, cantidad=cantidad_n))
            elif fila.combo_unidades is not None:
                unidad_id = fila.combo_unidades.currentData()
                if unidad_id is not None:
                    lineas.append(LineaPrestamo(fila.articulo.id, unidad_ids=(unidad_id,)))
        return lineas

    # ------------------------------------------------------------ navegación

    def _ir_a(self, paso: int) -> None:
        self._pasos.setCurrentIndex(paso)
        self.boton_atras.setVisible(paso > 0)
        if paso == 2:
            self._rellenar_resumen()
            self.boton_continuar.setText("Registrar préstamo")
        else:
            self.boton_continuar.setText("Continuar")

    def _atras(self) -> None:
        self._ir_a(self._pasos.currentIndex() - 1)

    def _continuar(self) -> None:
        paso = self._pasos.currentIndex()
        if paso == 0:
            if self.estudiante is None:
                self._set_error("Elige un estudiante antes de continuar.")
                return
            if not self.estudiante.activo:
                self._set_error(
                    "Este estudiante está inactivo y no puede recibir préstamos (RF-EST-06)."
                )
                return
            self._ir_a(1)
            return
        if paso == 1:
            if not self._lineas_prestamo():
                self._set_error("Agrega al menos un artículo con cantidad (RN-17).")
                return
            self._ir_a(2)
            return
        self.enviar()

    def _rellenar_resumen(self) -> None:
        self.resumen.clear()
        self.resumen.addItem(
            f"{self.estudiante.codigo_universitario}  ·  "
            f"{self.estudiante.nombres} {self.estudiante.apellidos}"
        )
        for fila in self._lineas:
            if fila.entrada_cantidad is not None:
                texto = f"{fila.articulo.nombre}  ·  {fila.entrada_cantidad.valor()} unidades"
            else:
                texto = f"{fila.articulo.nombre}  ·  unidad {fila.combo_unidades.currentText()}"
            self.resumen.addItem(texto)

    # ------------------------------------------------------------ errores

    def _set_error(self, texto: str) -> None:
        self._error.set_texto(texto)
        self._error.setVisible(True)

    def _limpiar_error(self) -> None:
        self._error.setVisible(False)

    @staticmethod
    def _reestilar(label) -> None:
        label.style().unpolish(label)
        label.style().polish(label)

    # -------------------------------------------------------------- envío

    def enviar(self) -> bool:
        if self._enviando:
            return False
        self._limpiar_error()
        lineas = self._lineas_prestamo()
        if not lineas:
            self._set_error("Agrega al menos un artículo con cantidad (RN-17).")
            return False
        if self.estudiante is None:
            self._set_error("Falta elegir el estudiante.")
            return False
        if not self.estudiante.activo:
            self._set_error(
                "Este estudiante está inactivo y no puede recibir préstamos (RF-EST-06)."
            )
            return False
        fecha_limite = None
        if not self.sin_limite.isChecked():
            qdt = self.fecha_limite.dateTime()
            if qdt.date() >= QDate.currentDate():
                fecha_limite = qdt.toString("yyyy-MM-ddTHH:mm:00")
        comentario = self.comentario.texto().strip() or None
        self._enviando = True
        self.boton_continuar.setEnabled(False)
        from PySide6.QtWidgets import QApplication

        QApplication.processEvents()
        try:
            self.resultado = self._prestamos.registrar_prestamo(
                self.estudiante.id,
                lineas,
                fecha_limite=fecha_limite,
                comentario=comentario,
            )
        except Exception as exc:  # noqa: BLE001 - se muestra en el propio diálogo
            self._enviando = False
            self.boton_continuar.setEnabled(True)
            self._set_error(mensaje_error(exc))
            return False
        self.accept()
        return True


class DetallePrestamoDialog(QDialog):
    """Vista de solo lectura de un préstamo y sus renglones."""

    def __init__(
        self,
        servicio_prestamos,
        servicio_estudiantes,
        servicio_inventario,
        prestamo,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("dialogo_ficha")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setWindowTitle(f"Préstamo {prestamo.folio}")
        self.setModal(True)
        self.setMinimumWidth(560)
        self.setMaximumWidth(640)
        self.setWindowFlag(Qt.WindowType.WindowContextHelpButtonHint, False)

        estudiante = servicio_estudiantes.obtener_estudiante(prestamo.estudiante_id)
        nombres_articulos = {
            articulo.id: articulo.nombre
            for articulo in servicio_inventario.listar_articulos(limite=1000)
        }

        titulo = QLabel(prestamo.folio)
        titulo.setObjectName("subtitulo")

        datos = QVBoxLayout()
        datos.setSpacing(4)
        datos.addLayout(self._par("Estudiante", f"{estudiante.nombres} {estudiante.apellidos}"))
        datos.addLayout(self._par("Código", estudiante.codigo_universitario))
        datos.addLayout(self._par("Fecha", fecha_hora(prestamo.fecha_prestamo)))
        if prestamo.fecha_limite:
            datos.addLayout(self._par("Límite", fecha_hora(prestamo.fecha_limite)))
        datos.addLayout(
            self._par("Estado", _ETIQUETA_ESTADO_PRESTAMO[prestamo.estado.value])
        )
        if prestamo.comentario:
            datos.addLayout(self._par("Comentario", prestamo.comentario))

        lista = QLabel("Artículos")
        lista.setObjectName("subtitulo")
        self.lista = QListWidget()
        self.lista.setUniformItemSizes(True)
        for detalle in servicio_prestamos.detalles(prestamo.id):
            self.lista.addItem(
                QListWidgetItem(
                    f"{nombres_articulos.get(detalle.articulo_id, 'Artículo')}"
                    f"  ·  {detalle.cantidad_prestada} prestadas,"
                    f" {detalle.cantidad_pendiente or 0} pendientes  ·  "
                    f"{_ETIQUETA_ESTADO_DETALLE[detalle.estado.value]}"
                )
            )

        cerrar = crear_boton("Cerrar", "secundaria")
        cerrar.clicked.connect(self.reject)
        botones = QHBoxLayout()
        botones.addStretch(1)
        botones.addWidget(cerrar)

        disposicion = QVBoxLayout(self)
        disposicion.setContentsMargins(24, 20, 24, 20)
        disposicion.setSpacing(12)
        disposicion.addWidget(titulo)
        disposicion.addLayout(datos)
        disposicion.addWidget(lista)
        disposicion.addWidget(self.lista)
        disposicion.addLayout(botones)

    @staticmethod
    def _par(clave: str, valor: str) -> QHBoxLayout:
        etiqueta = QLabel(clave)
        etiqueta.setProperty("campo", "etiqueta")
        etiqueta.setMinimumWidth(120)
        dato = QLabel(valor)
        dato.setWordWrap(True)
        fila = QHBoxLayout()
        fila.setSpacing(8)
        fila.addWidget(etiqueta)
        fila.addWidget(dato, 1)
        return fila
