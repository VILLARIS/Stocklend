"""Diálogos de Incidentes (`UI_SCREENS.md` §7): registro, detalle, resolución.

`IncidenteDialog` registra daños y pérdidas de depósito o de préstamo, eligiendo
el artículo (o renglón del préstamo) y su cantidad o la unidad concreta. La
descripción es obligatoria también para «Otro». `ResolverIncidenteDialog` y
`AsignarResponsabilidadDialog` cierran las acciones de seguimiento (RN-42,
RN-55). Nota: reasignar una responsabilidad ya asignada se apoya en `asignar_responsabilidad`,
que exige su motivo (RN-56).
"""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QHBoxLayout,
    QLabel,
    QVBoxLayout,
)

from ...domain.enums import EstadoUnidad, OrigenIncidente, ResponsabilidadIncidente, TipoIncidente
from ..formatters import cantidad, fecha_hora
from ..widgets.inputs import QuantityInput, TextArea
from ..widgets.primitives import crear_boton
from .form import FormDialog
from .seleccion import BuscadorResultados

_ETIQUETA_TIPO = {
    TipoIncidente.DANIO: "Daño",
    TipoIncidente.PERDIDA: "Pérdida",
    TipoIncidente.OTRO: "Otro",
}
_ETIQUETA_ORIGEN = {
    OrigenIncidente.STOCK: "Depósito",
    OrigenIncidente.PRESTAMO: "Préstamo",
    OrigenIncidente.DEVOLUCION: "Devolución",
}
_ETIQUETA_RESPONSABILIDAD = {
    ResponsabilidadIncidente.ESTUDIANTE: "Estudiante",
    ResponsabilidadIncidente.FACULTAD: "Facultad",
    ResponsabilidadIncidente.SIN_DETERMINAR: "Sin determinar",
}
_ETIQUETA_ESTADO = {"abierto": "Abierto", "resuelto": "Resuelto"}


class IncidenteDialog(FormDialog):
    """Registro de un incidente de depósito o de préstamo."""

    def __init__(
        self,
        servicio_incidentes,
        servicio_inventario,
        servicio_estudiantes,
        servicio_prestamos,
        servicio_unidades,
        parent=None,
    ) -> None:
        super().__init__(
            "Registrar incidente",
            "Daño, pérdida u otra novedad; la descripción queda en el registro (RN-42).",
            texto_accion="Registrar incidente",
            ancho=640,
            desplazable=True,
            parent=parent,
        )
        self._incidentes = servicio_incidentes
        self._inventario = servicio_inventario
        self._estudiantes = servicio_estudiantes
        self._prestamos = servicio_prestamos
        self._unidades = servicio_unidades
        self._controles = {
            articulo.id: articulo.control_individual
            for articulo in servicio_inventario.listar_articulos(limite=1000)
        }
        self._articulo_elegido = None
        self._prestamo_elegido = None

        self.origen = QComboBox()
        for texto, dato in [("Depósito (stock)", OrigenIncidente.STOCK.value),
                            ("Préstamo", OrigenIncidente.PRESTAMO.value)]:
            self.origen.addItem(texto, dato)
        self.origen.currentIndexChanged.connect(lambda _i: self._alternar_origen())
        self.agregar_campo("Dónde se detectó", self.origen)

        self.tipo = QComboBox()
        for tipo in (TipoIncidente.DANIO, TipoIncidente.PERDIDA, TipoIncidente.OTRO):
            self.tipo.addItem(_ETIQUETA_TIPO[tipo], tipo.value)
        self.agregar_campo("Tipo", self.tipo)

        self.buscador_articulo = BuscadorResultados(
            "Buscar artículo por nombre o código…",
            self._buscar_articulos,
        )
        self.buscador_articulo.elegida.connect(self._articulo_selector)
        self.campo_buscador_articulo = self.agregar_campo(
            "Artículo", self.buscador_articulo, "Solo artículos activos y prestables.", True
        )

        self.buscador_prestamo = BuscadorResultados(
            "Buscar préstamo por folio o estudiante…",
            self._buscar_prestamos,
        )
        self.buscador_prestamo.elegida.connect(self._prestamo_selector)
        self.campo_buscador_prestamo = self.agregar_campo(
            "Préstamo", self.buscador_prestamo, "Préstamos activos con pendiente.", True
        )

        self.renglon = QComboBox()
        self.renglon.setEnabled(False)
        self.renglon.currentIndexChanged.connect(lambda _i: self._renglon_elegido())
        self.campo_renglon = self.agregar_campo("Artículo del préstamo", self.renglon)

        self.cantidad = QuantityInput(1, maximo=1)
        self.campo_cantidad = self.agregar_campo(
            "Cantidad", self.cantidad, "Unidades afectadas por el incidente."
        )

        self.unidad = QComboBox()
        self.unidad.setEnabled(False)
        self.campo_unidad = self.agregar_campo(
            "Unidad", self.unidad, "Los artículos con control individual se afectan de a una."
        )

        self.descripcion = TextArea(maximo=200, lineas=3)
        self.campo_descripcion = self.agregar_campo(
            "Descripción",
            self.descripcion,
            "Obligatoria: explica qué pasó (RN-42).",
            obligatorio=True,
        )

        self.responsabilidad = QComboBox()
        for resp in (
            ResponsabilidadIncidente.SIN_DETERMINAR,
            ResponsabilidadIncidente.FACULTAD,
            ResponsabilidadIncidente.ESTUDIANTE,
        ):
            self.responsabilidad.addItem(_ETIQUETA_RESPONSABILIDAD[resp], resp.value)
        self.responsabilidad.currentIndexChanged.connect(lambda _i: self._alternar_estudiante())
        self.agregar_campo(
            "Responsabilidad",
            self.responsabilidad,
            "Si es «Estudiante», se elige quién (RN-55, RN-56).",
        )

        self.buscador_estudiante = BuscadorResultados(
            "Buscar estudiante por nombre o código…",
            lambda t: [
                (f"{e.codigo_universitario}  ·  {e.nombres} {e.apellidos}", e)
                for e in self._estudiantes.buscar_estudiantes(t, limite=50)
            ],
        )
        self.campo_buscador_estudiante = self.agregar_campo(
            "Estudiante responsable", self.buscador_estudiante
        )
        self._alternar_origen()
        self._alternar_estudiante()

    # ---------------------------------------------------------------- datos

    def _buscar_articulos(self, termino: str) -> "list[tuple[str, object]]":
        pares = []
        for articulo in self._inventario.buscar_articulos(termino, limite=50):
            if not articulo.activo or not articulo.prestable:
                continue
            codigo = f"  ·  {articulo.codigo}" if articulo.codigo else ""
            pares.append(
                (f"{articulo.nombre}{codigo}  ·  "
                 f"{cantidad(articulo.cantidad_disponible)} disponibles", articulo)
            )
        return pares

    def _buscar_prestamos(self, termino: str) -> "list[tuple[str, object]]":
        pares = []
        for prestamo in self._prestamos.listar_activos(limite=200):
            estudiante = self._estudiantes.obtener_estudiante(prestamo.estudiante_id)
            texto = (
                f"{prestamo.folio}  ·  {estudiante.nombres} {estudiante.apellidos}"
            )
            if termino and termino.lower() not in f"{prestamo.folio} {texto}".lower():
                continue
            pares.append((texto, prestamo))
        return pares

    def _articulo_selector(self, articulo) -> None:
        self._articulo_elegido = articulo
        individual = bool(self._controles.get(articulo.id, False))
        self.campo_cantidad.setVisible(not individual)
        self.campo_unidad.setVisible(individual)
        if individual:
            self.cantidad.set_valor(1)
            self.unidad.clear()
            disponibles = self._unidades.listar_por_articulo(
                articulo.id, estado=EstadoUnidad.DISPONIBLE, limite=500
            )
            if not disponibles:
                self.unidad.addItem("Sin unidades disponibles", None)
                self.unidad.setEnabled(False)
            else:
                for unidad in disponibles:
                    self.unidad.addItem(unidad.codigo, unidad.id)
                self.unidad.setEnabled(True)
        else:
            self.cantidad.set_maximo(max(0, articulo.cantidad_disponible))

    def _prestamo_selector(self, prestamo) -> None:
        self._prestamo_elegido = prestamo
        self.renglon.clear()
        self.renglon.setEnabled(False)
        for detalle in self._prestamos.detalles(prestamo.id):
            if (detalle.cantidad_pendiente or 0) <= 0:
                continue
            nombre = f"Artículo {detalle.articulo_id}"
            self.renglon.addItem(
                f"{nombre}  ·  {detalle.cantidad_pendiente} pendientes", detalle.id
            )
        self.renglon.setEnabled(True)
        self._renglon_elegido()

    def _renglon_elegido(self) -> None:
        detalle_id = self.renglon.currentData()
        if detalle_id is None or self._prestamo_elegido is None:
            return
        detalle = next(
            d for d in self._prestamos.detalles(self._prestamo_elegido.id) if d.id == detalle_id
        )
        articulo_id = detalle.articulo_id
        individual = bool(self._controles.get(articulo_id, False))
        pendiente = detalle.cantidad_pendiente or 0
        self.campo_cantidad.setVisible(not individual)
        self.campo_unidad.setVisible(individual)
        if individual:
            self.cantidad.set_valor(1)
            self.unidad.clear()
            prestadas = [
                u for u in self._unidades.listar_por_prestamo_detalle(detalle.id)
                if u.estado is EstadoUnidad.PRESTADA
            ]
            if not prestadas:
                self.unidad.addItem("Sin unidades prestadas", None)
                self.unidad.setEnabled(False)
            else:
                for unidad in prestadas:
                    self.unidad.addItem(unidad.codigo, unidad.id)
                self.unidad.setEnabled(True)
        else:
            self.cantidad.set_maximo(max(0, pendiente))

    def _alternar_origen(self) -> None:
        es_stock = self.origen.currentData() == OrigenIncidente.STOCK.value
        self.campo_buscador_articulo.setVisible(es_stock)
        self.campo_buscador_prestamo.setVisible(not es_stock)
        self.campo_renglon.setVisible(not es_stock)
        if es_stock:
            self.campo_cantidad.setVisible(True)
            self.campo_unidad.setVisible(False)

    def _alternar_estudiante(self) -> None:
        es_estudiante = (
            self.responsabilidad.currentData() == ResponsabilidadIncidente.ESTUDIANTE.value
        )
        self.campo_buscador_estudiante.setVisible(es_estudiante)

    # -------------------------------------------------------------- validar

    def validar(self):
        errores: list[tuple[object, str]] = []
        if not self.descripcion.texto().strip():
            errores.append((self.campo_descripcion, "La descripción es obligatoria (RN-42)"))
        if (
            self.responsabilidad.currentData() == ResponsabilidadIncidente.ESTUDIANTE.value
            and self.buscador_estudiante.dato_actual() is None
        ):
            errores.append(
                (self.campo_buscador_estudiante, "Elige al estudiante responsable (RN-56)")
            )
        if self.origen.currentData() == OrigenIncidente.STOCK.value:
            if self._articulo_elegido is None:
                errores.append((self.campo_buscador_articulo, "Elige el artículo afectado"))
            if self.cantidad.valor() <= 0:
                errores.append((self.campo_cantidad, "La cantidad debe ser al menos 1"))
        else:
            if self._prestamo_elegido is None or self.renglon.currentData() is None:
                errores.append((self.campo_buscador_prestamo, "Elige préstamo y artículo"))
        return errores

    def _unidad_id(self) -> int | None:
        if not self.campo_unidad.isVisible():
            return None
        return self.unidad.currentData()

    def guardar(self) -> None:
        tipo = TipoIncidente(self.tipo.currentData())
        descripcion = self.descripcion.texto().strip()
        responsabilidad = ResponsabilidadIncidente(self.responsabilidad.currentData())
        estudiante_obj = self.buscador_estudiante.dato_actual()
        estudiante_id = estudiante_obj.id if estudiante_obj is not None else None
        if responsabilidad is not ResponsabilidadIncidente.ESTUDIANTE:
            estudiante_id = None
        if self.origen.currentData() == OrigenIncidente.STOCK.value:
            self.resultado = self._incidentes.registrar_incidente(
                self._articulo_elegido.id,
                tipo,
                OrigenIncidente.STOCK,
                self.cantidad.valor(),
                descripcion,
                unidad_id=self._unidad_id(),
                estudiante_id=estudiante_id,
                responsabilidad=responsabilidad,
            )
            return
        detalle_id = self.renglon.currentData()
        detalle = next(
            d for d in self._prestamos.detalles(self._prestamo_elegido.id) if d.id == detalle_id
        )
        self.resultado = self._incidentes.registrar_incidente(
            detalle.articulo_id,
            tipo,
            OrigenIncidente.PRESTAMO,
            self.cantidad.valor(),
            descripcion,
            prestamo_id=self._prestamo_elegido.id,
            prestamo_detalle_id=detalle_id,
            unidad_id=self._unidad_id(),
            estudiante_id=estudiante_id,
            responsabilidad=responsabilidad,
        )


class DetalleIncidenteDialog(QDialog):
    """Vista de solo lectura de un incidente."""

    def __init__(self, servicio_incidentes, servicio_inventario, incidente, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("dialogo_ficha")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setWindowTitle(f"Incidente #{incidente.id}")
        self.setModal(True)
        self.setMinimumWidth(520)
        self.setMaximumWidth(600)
        self.setWindowFlag(Qt.WindowType.WindowContextHelpButtonHint, False)

        titulo = QLabel(
            f"{_ETIQUETA_TIPO.get(incidente.tipo, incidente.tipo.value)}"
            f"  ·  {_ETIQUETA_ESTADO[incidente.estado.value]}"
        )
        titulo.setObjectName("subtitulo")

        articulo = servicio_inventario.obtener_articulo(incidente.articulo_id)
        par = _par_estatico("Artículo", f"{articulo.nombre} · {cantidad(incidente.cantidad)}")

        datos = QVBoxLayout()
        datos.setSpacing(4)
        datos.addLayout(par)
        datos.addLayout(_par_estatico("Origen", _ETIQUETA_ORIGEN.get(incidente.origen, "")))
        if incidente.prestamo_id:
            datos.addLayout(_par_estatico("Préstamo", f"#{incidente.prestamo_id}"))
        if incidente.articulo_unidad_id:
            datos.addLayout(_par_estatico("Unidad", f"#{incidente.articulo_unidad_id}"))
        datos.addLayout(
            _par_estatico(
                "Responsabilidad", _ETIQUETA_RESPONSABILIDAD.get(incidente.responsabilidad, "")
            )
        )
        datos.addLayout(_par_estatico("Fecha", fecha_hora(incidente.creado_en)))
        datos.addLayout(_par_estatico("Descripción", incidente.descripcion or "—"))
        if incidente.resolucion:
            datos.addLayout(_par_estatico("Resolución", incidente.resolucion))

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
        disposicion.addLayout(botones)


class ResolverIncidenteDialog(FormDialog):
    """Marca resuelto con su texto (RN-42, RN-43)."""

    def __init__(self, servicio_incidentes, incidente, parent=None) -> None:
        super().__init__(
            "Resolver incidente",
            "El incidente queda cerrado con la resolución escrita; no se borra (RN-43).",
            texto_accion="Marcar resuelto",
            ancho=520,
            parent=parent,
        )
        self._servicio = servicio_incidentes
        self._incidente = incidente
        self.resolucion = TextArea(maximo=300, lineas=4)
        self.campo_resolucion = self.agregar_campo(
            "Resolución",
            self.resolucion,
            "Qué se hizo y cómo se cerró el caso.",
            obligatorio=True,
        )

    def validar(self):
        if not self.resolucion.texto().strip():
            return [(self.campo_resolucion, "La resolución es obligatoria (RN-43)")]
        return None

    def guardar(self) -> None:
        self.resultado = self._servicio.resolver_incidente(
            self._incidente.id, self.resolucion.texto().strip()
        )


class AsignarResponsabilidadDialog(FormDialog):
    """Atribuye el incidente a un estudiante con su motivo (RN-55, RN-56)."""

    def __init__(
        self,
        servicio_incidentes,
        servicio_estudiantes,
        incidente,
        parent=None,
    ) -> None:
        super().__init__(
            "Asignar responsabilidad",
            "Se responsabiliza a un estudiante del daño o la pérdida.",
            texto_accion="Asignar responsabilidad",
            ancho=560,
            parent=parent,
        )
        self._servicio = servicio_incidentes
        self._incidente = incidente

        self.buscador_estudiante = BuscadorResultados(
            "Buscar estudiante por nombre o código…",
            lambda t: [
                (f"{e.codigo_universitario}  ·  {e.nombres} {e.apellidos}", e)
                for e in servicio_estudiantes.buscar_estudiantes(t, limite=50)
            ],
        )
        self.campo_estudiante = self.agregar_campo(
            "Estudiante", self.buscador_estudiante, "Se exige elegir uno (RN-56).", True
        )
        self.motivo = TextArea(maximo=200, lineas=3)
        self.campo_motivo = self.agregar_campo(
            "Motivo", self.motivo, "Queda anotado en la descripción del incidente."
        )

    def validar(self):
        errores = []
        if self.buscador_estudiante.dato_actual() is None:
            errores.append((self.campo_estudiante, "Elige al estudiante responsable (RN-56)"))
        if not self.motivo.texto().strip():
            errores.append((self.campo_motivo, "El motivo es obligatorio"))
        return errores

    def guardar(self) -> None:
        estudiante = self.buscador_estudiante.dato_actual()
        self.resultado = self._servicio.asignar_responsabilidad(
            self._incidente.id, estudiante.id, descripcion=self.motivo.texto().strip()
        )


def _par_estatico(clave: str, valor: str):
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
