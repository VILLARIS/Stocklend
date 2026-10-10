"""Diálogo de Devolución (`UI_SCREENS.md` §6): un préstamo, por condición.

`DevolucionDialog` tiene dos pasos: elegir el préstamo activo y distribuir lo que
vuelve de cada renglón entre «en buen estado», «dañado» y «perdido». Si la
devolución cierra el préstamo se pide confirmación (RNF-02, C-9); si es parcial,
se registra directamente. El daño o la pérdida exigen una descripción (RN-33);
la casilla «La responsabilidad es de este estudiante» usa el estudiante del
préstamo (RN-55).
"""

from __future__ import annotations

from dataclasses import dataclass

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QHBoxLayout,
    QLabel,
    QScrollArea,
    QStackedWidget,
    QVBoxLayout,
    QWidget,
)

from ...domain.entidades import PrestamoDetalle
from ...services import LineaDevolucion
from ..errors import mensaje_error
from ..formatters import cantidad
from ..widgets.feedback import InlineNotice
from ..widgets.inputs import QuantityInput, TextArea
from ..widgets.primitives import crear_boton
from .confirm import confirmar
from .seleccion import BuscadorResultados

_OPCIONES_UNIDAD = [
    ("Devolver en buen estado", "devuelta"),
    ("Devuelta dañada", "daniada"),
    ("Devuelta perdida", "perdida"),
]


@dataclass
class _Renglon:
    """Unidades a devolver de un renglón del préstamo."""

    detalle: PrestamoDetalle
    entradas: list[QuantityInput] | None = None
    combos: list[QComboBox] | None = None


class DevolucionDialog(QDialog):
    """Asistente de devolución (selección → condiciones de cada artículo)."""

    def __init__(
        self,
        servicio_devoluciones,
        servicio_prestamos,
        servicio_estudiantes,
        servicio_inventario,
        servicio_unidades,
        prestamo_inicial=None,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("dialogo_devolucion")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setWindowTitle("Registrar devolución")
        self.setModal(True)
        self.setFixedWidth(640)
        self.setWindowFlag(Qt.WindowType.WindowContextHelpButtonHint, False)
        self._devoluciones = servicio_devoluciones
        self._prestamos = servicio_prestamos
        self._estudiantes = servicio_estudiantes
        self._inventario = servicio_inventario
        self._unidades = servicio_unidades
        self._prestamo = None
        self._renglones: list[_Renglon] = []
        self.resultado: object = None
        self._enviando = False
        self._nombres_articulos = {
            articulo.id: articulo.nombre
            for articulo in servicio_inventario.listar_articulos(limite=1000)
        }
        self._controles = {
            articulo.id: articulo.control_individual
            for articulo in servicio_inventario.listar_articulos(limite=1000)
        }

        titulo = QLabel("Registrar devolución")
        titulo.setObjectName("subtitulo")
        self._pasos = QStackedWidget()
        self._error = InlineNotice("", "error")
        self._error.setVisible(False)

        self.boton_atras = crear_boton("Cambiar préstamo", "secundaria")
        self.boton_atras.clicked.connect(self._volver_a_seleccion)
        self.boton_cancelar = crear_boton("Cancelar", "secundaria")
        self.boton_cancelar.clicked.connect(self.reject)
        self.boton_guardar = crear_boton("Registrar devolución", "primaria")
        self.boton_guardar.setObjectName("accion_formulario")
        self.boton_guardar.clicked.connect(self.enviar)

        self._pasos.addWidget(self._paso_seleccion())
        self._pasos.addWidget(self._paso_renglones())

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
        botones.addWidget(self.boton_guardar)
        disposicion.addLayout(botones)

        if prestamo_inicial is not None:
            self._prestamo = prestamo_inicial
            self._cargar_renglones()
            self._ir_a(1)

    # ---------------------------------------------------------------- pasos

    def _paso_seleccion(self) -> QWidget:
        pagina = QWidget()
        texto = QLabel("Elige el préstamo que se está devolviendo")
        texto.setProperty("campo", "etiqueta")
        self.buscador = BuscadorResultados(
            "Buscar por folio o estudiante…",
            self._buscar_prestamos,
        )
        self.buscador.elegida.connect(self._prestamo_elegido)
        disposicion = QVBoxLayout(pagina)
        disposicion.setContentsMargins(0, 0, 0, 0)
        disposicion.setSpacing(10)
        disposicion.addWidget(texto)
        disposicion.addWidget(self.buscador)
        return pagina

    def _paso_renglones(self) -> QWidget:
        pagina = QWidget()
        self._cabecera = QLabel("")
        self._cabecera.setWordWrap(True)
        self._cabecera.setObjectName("subtitulo")

        self.area = QScrollArea()
        self.area.setWidgetResizable(True)
        self.area.setFrameShape(QScrollArea.Shape.NoFrame)
        self.contenedor = QWidget()
        self.disposicion = QVBoxLayout(self.contenedor)
        self.disposicion.setContentsMargins(0, 0, 0, 0)
        self.disposicion.setSpacing(12)
        self.area.setWidget(self.contenedor)

        self.casilla = QCheckBox("La responsabilidad del daño o la pérdida es de este estudiante")
        self.descripcion = TextArea(maximo=200, lineas=3)
        self.campo_descripcion = QLabel("Descripción de los daños o pérdidas")
        self.campo_descripcion.setProperty("campo", "etiqueta")

        disposicion = QVBoxLayout(pagina)
        disposicion.setContentsMargins(0, 0, 0, 0)
        disposicion.setSpacing(10)
        disposicion.addWidget(self._cabecera)
        disposicion.addWidget(self.area, 1)
        disposicion.addWidget(self.casilla)
        disposicion.addWidget(self.campo_descripcion)
        disposicion.addWidget(self.descripcion)
        return pagina

    # ---------------------------------------------------------------- datos

    def _buscar_prestamos(self, termino: str) -> "list[tuple[str, object]]":
        pares = []
        for prestamo in self._prestamos.listar_activos(limite=500):
            estudiante = self._estudiantes.obtener_estudiante(prestamo.estudiante_id)
            pendientes = sum(
                (detalle.cantidad_pendiente or 0)
                for detalle in self._prestamos.detalles(prestamo.id)
            )
            texto = (
                f"{prestamo.folio}  ·  {estudiante.nombres} {estudiante.apellidos}"
                f"  ·  {cantidad(pendientes, singular='pendiente')}"
            )
            if termino and termino.lower() not in f"{prestamo.folio} {texto}".lower():
                continue
            pares.append((texto, prestamo))
        return pares

    def _prestamo_elegido(self, prestamo) -> None:
        self._prestamo = prestamo
        self._cargar_renglones()
        self._ir_a(1)

    def _volver_a_seleccion(self) -> None:
        self._prestamo = None
        self._renglones.clear()
        self._limpiar_contenedor()
        self._ir_a(0)

    def _ir_a(self, paso: int) -> None:
        self._pasos.setCurrentIndex(paso)
        self.boton_atras.setVisible(paso == 1)

    def _cargar_renglones(self) -> None:
        self._renglones.clear()
        self._limpiar_contenedor()
        prestamo = self._prestamo
        estudiante = self._estudiantes.obtener_estudiante(prestamo.estudiante_id)
        self._cabecera.setText(
            f"{prestamo.folio}  ·  {estudiante.nombres} {estudiante.apellidos}"
            f"  ·  {estudiante.codigo_universitario}"
        )
        for detalle in self._prestamos.detalles(prestamo.id):
            if (detalle.cantidad_pendiente or 0) <= 0:
                continue
            self._agregar_renglon(detalle)
        self.casilla.setChecked(True)

    def _agregar_renglon(self, detalle: PrestamoDetalle) -> None:
        nombre = self._nombres_articulos.get(detalle.articulo_id, f"Artículo {detalle.articulo_id}")
        pendiente = detalle.cantidad_pendiente or 0
        etiqueta = QLabel(f"{nombre}  ·  {cantidad(pendiente, singular='pendiente')}")
        etiqueta.setWordWrap(True)

        if self._controles.get(detalle.articulo_id, False):
            combos = []
            fila = QWidget()
            disposicion = self._disposicion_fila(fila)
            disposicion.addWidget(etiqueta)
            unidades = self._unidades.listar_por_prestamo_detalle(detalle.id)
            for unidad in unidades:
                if unidad.estado.value != "prestada":
                    continue
                combo = QComboBox()
                for texto, dato in _OPCIONES_UNIDAD:
                    combo.addItem(texto, dato)
                disposicion.addWidget(combo)
                combos.append(combo)
            self.disposicion.addWidget(fila)
            self._renglones.append(_Renglon(detalle, combos=combos))
            return

        fila = QWidget()
        disposicion = self._disposicion_fila(fila)
        disposicion.addWidget(etiqueta, 1)
        entradas: list[QuantityInput] = []
        for etiqueta_condicion in ("Devueltas", "Dañadas", "Perdidas"):
            etiqueta_corta = QLabel(etiqueta_condicion)
            etiqueta_corta.setProperty("campo", "etiqueta")
            disposicion.addWidget(etiqueta_corta)
            entrada = QuantityInput(0, maximo=pendiente)
            entrada.valor_cambiado.connect(lambda _v: self._actualizar_descripcion())
            disposicion.addWidget(entrada)
            entradas.append(entrada)
        self.disposicion.addWidget(fila)
        self._renglones.append(_Renglon(detalle, entradas=entradas))

    @staticmethod
    def _disposicion_fila(fila: QWidget) -> QHBoxLayout:
        disposicion = QHBoxLayout(fila)
        disposicion.setContentsMargins(0, 0, 0, 0)
        disposicion.setSpacing(8)
        return disposicion

    def _limpiar_contenedor(self) -> None:
        while (item := self.disposicion.takeAt(0)):
            widget = item.widget()
            if widget is not None:
                widget.deleteLater()

    # ------------------------------------------------------------ recuentos

    def _condiciones(self, renglon: _Renglon) -> tuple[int, int, int]:
        if renglon.combos is not None:
            devueltas = sum(1 for c in renglon.combos if c.currentData() == "devuelta")
            danadas = sum(1 for c in renglon.combos if c.currentData() == "daniada")
            perdidas = sum(1 for c in renglon.combos if c.currentData() == "perdida")
            return devueltas, danadas, perdidas
        entrada_dev, entrada_dan, entrada_per = renglon.entradas
        return entrada_dev.valor(), entrada_dan.valor(), entrada_per.valor()

    def _tiene_danadas_o_perdidas(self) -> bool:
        for renglon in self._renglones:
            _devuelta, danada, perdida = self._condiciones(renglon)
            if danada > 0 or perdida > 0:
                return True
        return False

    def _devuelve_todo(self) -> bool:
        for renglon in self._renglones:
            if sum(self._condiciones(renglon)) != (renglon.detalle.cantidad_pendiente or 0):
                return False
        return bool(self._renglones)

    def _actualizar_descripcion(self) -> None:
        hay_dano = self._tiene_danadas_o_perdidas()
        self.campo_descripcion.setVisible(hay_dano)
        self.descripcion.setVisible(hay_dano)

    # -------------------------------------------------------------- envío

    def enviar(self) -> bool:
        if self._enviando:
            return False
        self._error.setVisible(False)
        if self._prestamo is None:
            self._set_error("Elige el préstamo que se está devolviendo.")
            return False
        lineas = self._recolectar_lineas()
        if not lineas:
            self._set_error("La devolución no cambia nada: elige condiciones.")
            return False
        parcial = not self._devuelve_todo()
        if self._tiene_danadas_o_perdidas():
            descripcion = self.descripcion.texto().strip()
            if not descripcion:
                self._set_error("Registrar un daño o una pérdida exige una descripción (RN-33).")
                return False
        else:
            descripcion = None
        if not parcial and not confirmar(
            self,
            "Registrar devolución",
            f"Este registro cierra el préstamo {self._prestamo.folio} (RN-35).",
            ["Las unidades devueltas vuelven a disponible; las dañadas o perdidas"
             " pasan a esos cubos y quedan pendientes de resolución."],
            texto_accion="Registrar devolución",
        ):
            return False
        self._enviando = True
        self.boton_guardar.setEnabled(False)
        try:
            self.resultado = self._devoluciones.registrar_devolucion(
                self._prestamo.id,
                lineas,
                observaciones=descripcion,
            )
        except Exception as exc:  # noqa: BLE001 - se muestra en el propio diálogo
            self._enviando = False
            self.boton_guardar.setEnabled(True)
            self._set_error(mensaje_error(exc))
            return False
        self.accept()
        return True

    def _recolectar_lineas(self) -> list[LineaDevolucion]:
        estudiante_id = self._prestamo.estudiante_id if self.casilla.isChecked() else None
        descripcion = self.descripcion.texto().strip() or None
        lineas: list[LineaDevolucion] = []
        for renglon in self._renglones:
            devueltas, danadas, perdidas = self._condiciones(renglon)
            if devueltas + danadas + perdidas == 0:
                continue
            lineas.append(
                LineaDevolucion(
                    prestamo_detalle_id=renglon.detalle.id,
                    cantidad_devuelta=devueltas,
                    cantidad_daniada=danadas,
                    cantidad_perdida=perdidas,
                    descripcion=descripcion,
                    estudiante_id=estudiante_id,
                )
            )
        return lineas

    def _set_error(self, texto: str) -> None:
        self._error.set_texto(texto)
        self._error.setVisible(True)
