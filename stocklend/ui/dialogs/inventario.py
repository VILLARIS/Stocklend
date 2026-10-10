"""Diálogos de Inventario (`UI_SCREENS.md` §3): artículo, ajuste, categoría y unidad.

- `ArticuloDialog`: alta (RN-09, RF-INV-08) y edición de datos descriptivos (RN-15).
  El alta de un artículo con control individual registra el artículo sin cantidad y
  luego sus unidades con código, en la misma operación de guardado (RN-50).
- `AjusteDialog`: fija la cantidad total con vista previa, motivo obligatorio y
  confirmación de los efectos (RNF-02). No acepta bajar por debajo de lo prestado.
- `CategoriaDialog`: alta y edición de categorías (RN-46).
- `UnidadEstadoDialog`: cambia el estado de una unidad de stock (el «ajuste» por
  unidad de los artículos con control individual, RN-61).
- `UnidadEditarDialog`: corrige el código o las notas de una unidad (RN-51).
"""

from __future__ import annotations

from PySide6.QtWidgets import QCheckBox, QComboBox, QLabel, QLineEdit

from ...domain.enums import EstadoUnidad
from ...domain.value_objects import CodigoUnidad
from ..formatters import cantidad
from ..widgets.inputs import QuantityInput, TextArea
from .confirm import confirmar
from .form import FormDialog

_ETIQUETA_UNIDAD = {
    EstadoUnidad.DISPONIBLE: "Disponible",
    EstadoUnidad.PRESTADA: "Prestada",
    EstadoUnidad.DANADA: "Dañada",
    EstadoUnidad.FALTANTE: "Faltante",
    EstadoUnidad.BAJA: "Baja",
}

_TRANSICIONES_VISIBLES: dict[EstadoUnidad, list[EstadoUnidad]] = {
    EstadoUnidad.DISPONIBLE: [EstadoUnidad.DANADA, EstadoUnidad.FALTANTE],
    EstadoUnidad.DANADA: [EstadoUnidad.DISPONIBLE, EstadoUnidad.BAJA],
    EstadoUnidad.FALTANTE: [EstadoUnidad.BAJA],
}


class ArticuloDialog(FormDialog):
    """Alta o edición de un artículo; nunca toca los contadores al editar."""

    def __init__(
        self,
        servicio_inventario,
        servicio_unidades,
        categorias,
        articulo=None,
        parent=None,
    ) -> None:
        es_edicion = articulo is not None
        super().__init__(
            "Editar artículo" if es_edicion else "Registrar artículo",
            (
                "La edición solo cambia los datos descriptivos, nunca las"
                " existencias (RN-15)."
                if es_edicion
                else "Los artículos se registran para controlar sus existencias."
            ),
            texto_accion="Guardar cambios" if es_edicion else "Registrar artículo",
            ancho=500,
            parent=parent,
        )
        self._inventario = servicio_inventario
        self._unidades = servicio_unidades
        self._articulo = articulo

        self.nombre = QLineEdit()
        self.nombre.setPlaceholderText("Ej.: Olla grande")
        self.nombre.setMaxLength(80)
        self.campo_nombre = self.agregar_campo(
            "Nombre del artículo",
            self.nombre,
            "Único dentro de su categoría (RN-09).",
            obligatorio=True,
        )

        self.categoria = QComboBox()
        self.categoria.setMinimumWidth(260)
        for categoria in categorias:
            self.categoria.addItem(categoria.nombre, categoria.id)
        self.agregar_campo(
            "Categoría", self.categoria, "Agrupa y ordena los artículos.", obligatorio=True
        )

        self.codigo = QLineEdit()
        self.codigo.setPlaceholderText("Opcional · ej.: OLG-001")
        self.codigo.setMaxLength(40)
        self.agregar_campo(
            "Código interno", self.codigo, "Único en todo el inventario (RF-INV-10)."
        )

        self.control_individual = QCheckBox(
            "Este artículo se presta y se controla unidad por unidad"
        )
        if es_edicion:
            self.control_individual.setChecked(bool(articulo.control_individual))
            self.control_individual.setToolTip(
                "El tipo de control no se puede cambiar después del alta"
            )
        self.agregar_widget(self.control_individual)

        self.cantidad_inicial = QuantityInput(0, maximo=9999)
        self.campo_cantidad = self.agregar_campo(
            "Cantidad inicial",
            self.cantidad_inicial,
            "Primer movimiento de alta; se puede ajustar después (RN-05).",
        )

        self.codigos_unidad = TextArea(maximo=500, lineas=4)
        self.campo_codigos = self.agregar_campo(
            "Códigos de las unidades (uno por línea)",
            self.codigos_unidad,
            "Un código por línea; los artículos con control individual no se"
            " registran por cantidad (RN-50).",
        )
        self.control_individual.toggled.connect(self._alternar_control)
        if es_edicion:
            self.control_individual.setEnabled(False)

        self.prestable = QCheckBox("Sí, puede prestarse")
        self.prestable.setChecked(True)
        self.agregar_widget(self.prestable)

        self.nota = TextArea(maximo=200, lineas=2)
        self.agregar_campo("Nota", self.nota, "Opcional. Apuntes sobre el artículo.")

        if es_edicion:
            self.nombre.setText(articulo.nombre)
            self.codigo.setText(articulo.codigo or "")
            if articulo.notas:
                self.nota.set_texto(articulo.notas)
            self.prestable.setChecked(bool(articulo.prestable))
            indice = self.categoria.findData(articulo.categoria_id)
            self.categoria.setCurrentIndex(max(0, indice))
        self._alternar_control(self.control_individual.isChecked())

    def _alternar_control(self, activo: bool) -> None:
        if self._articulo is not None:
            self.campo_cantidad.setVisible(False)
            self.campo_codigos.setVisible(False)
            return
        self.campo_cantidad.setVisible(not activo)
        self.campo_codigos.setVisible(activo)

    def _codigos_limpios(self) -> list[str]:
        lineas = [linea.strip() for linea in self.codigos_unidad.texto().splitlines()]
        return [linea for linea in lineas if linea]

    def _categoria_id(self):
        return self.categoria.currentData()

    def validar(self):
        if not self.nombre.text().strip():
            return [(self.campo_nombre, "El nombre del artículo es obligatorio")]
        errores: list[tuple[object, str]] = []
        if self.control_individual.isChecked():
            codigos = self._codigos_limpios()
            if not codigos:
                errores.append(
                    (self.campo_codigos, "Escribe al menos un código de unidad (RN-50)")
                )
            elif errores_del_codigo := self._errores_de_codigos(codigos):
                errores.append(errores_del_codigo)
        return errores

    def _errores_de_codigos(self, codigos: list[str]):
        vistos: set[str] = set()
        for codigo in codigos:
            try:
                normalizado = str(CodigoUnidad(codigo))
            except Exception:  # noqa: BLE001 - error de formato del código
                return (self.campo_codigos, f"El código '{codigo}' no es válido")
            if normalizado in vistos:
                return (self.campo_codigos, f"El código '{normalizado}' está repetido")
            vistos.add(normalizado)
        return None

    def guardar(self) -> None:
        nombre = self.nombre.text().strip()
        codigo = self.codigo.text().strip() or None
        notas = self.nota.texto().strip() or None
        if self._articulo is None:
            articulo = self._inventario.registrar_articulo(
                nombre,
                self._categoria_id(),
                codigo=codigo,
                control_individual=self.control_individual.isChecked(),
                prestable=self.prestable.isChecked(),
                cantidad_inicial=(
                    0 if self.control_individual.isChecked() else self.cantidad_inicial.valor()
                ),
                notas=notas,
            )
            if self.control_individual.isChecked():
                self._unidades.registrar_unidades(articulo.id, self._codigos_limpios())
            self.resultado = articulo
            return
        self.resultado = self._inventario.editar_articulo(
            self._articulo.id,
            nombre=nombre,
            codigo=codigo,
            categoria_id=self._categoria_id(),
            prestable=self.prestable.isChecked(),
            notas=notas,
        )


class AjusteDialog(FormDialog):
    """Ajuste de la cantidad total con vista previa, motivo y confirmación."""

    def __init__(self, servicio_inventario, articulo, parent=None) -> None:
        super().__init__(
            "Ajustar existencias",
            "Se fija la cantidad total con un movimiento y su motivo (RN-05).",
            texto_accion="Registrar ajuste",
            ancho=500,
            parent=parent,
        )
        self._inventario = servicio_inventario
        self._articulo = articulo

        resumen = QLineEdit()
        resumen.setReadOnly(True)
        resumen.setText(
            f"{articulo.nombre} · {cantidad(articulo.cantidad_total)} en total,"
            f" {articulo.cantidad_disponible} disponibles,"
            f" {articulo.cantidad_prestada} prestadas,"
            f" {articulo.cantidad_daniada} dañadas,"
            f" {articulo.cantidad_faltante} faltantes."
        )
        self.agregar_campo("Situación actual", resumen)

        self.entrada = QuantityInput(articulo.cantidad_total, maximo=99999)
        self.entrada.valor_cambiado.connect(lambda _v: self._actualizar_previa())
        self.campo_entrada = self.agregar_campo(
            "Cantidad total nueva",
            self.entrada,
            "La cantidad total pasa a ser la indicada; la diferencia sale o entra"
            " de lo disponible.",
            obligatorio=True,
        )

        self._previa = QLabel("")
        self._previa.setWordWrap(True)
        self.agregar_widget(self._previa)

        self.motivo = TextArea(maximo=200, lineas=3)
        self.campo_motivo = self.agregar_campo(
            "Motivo del ajuste",
            self.motivo,
            "Queda registrado en el historial (RN-05).",
            obligatorio=True,
        )
        self._actualizar_previa()

    def _actualizar_previa(self) -> None:
        nueva = self.entrada.valor()
        actual = self._articulo.cantidad_total
        diferencia = nueva - actual
        if nueva < self._articulo.cantidad_prestada:
            self._previa.setObjectName("mensaje_error")
            self._previa.setText(
                f"No puede bajar de {self._articulo.cantidad_prestada} unidades"
                " porque esa cantidad está prestada."
            )
        elif diferencia == 0:
            self._previa.setObjectName("texto_ayuda")
            self._previa.setText("La cantidad ya es esa: el ajuste no cambia nada.")
        else:
            self._previa.setObjectName("texto_ayuda")
            signo = "+" if diferencia > 0 else ""
            self._previa.setText(
                f"Ajuste {signo}{diferencia}: de {actual} a {nueva} unidades totales."
            )
        self._reestilar(self._previa)

    @staticmethod
    def _reestilar(label) -> None:
        label.style().unpolish(label)
        label.style().polish(label)

    def validar(self):
        errores: list[tuple[object, str]] = []
        if not self.motivo.texto().strip():
            errores.append((self.campo_motivo, "El motivo es obligatorio"))
        if self.entrada.valor() < self._articulo.cantidad_prestada:
            errores.append(
                (
                    self.campo_entrada,
                    f"No puede bajar de {self._articulo.cantidad_prestada} unidades"
                    " porque esa cantidad está prestada.",
                )
            )
        return errores

    def antes_de_guardar(self) -> bool:
        actual = self._articulo.cantidad_total
        nueva = self.entrada.valor()
        diferencia = nueva - actual
        cuerpo = (
            f"La cantidad de '{self._articulo.nombre}' ya es {actual}."
            " El ajuste no cambiará nada."
        )
        efectos = ["No se escribe ningún movimiento ni cambio en el historial."]
        if diferencia != 0:
            signo = "+" if diferencia > 0 else ""
            cuerpo = f"Vas a ajustar las existencias de '{self._articulo.nombre}'."
            efectos = [
                f"Ajuste {signo}{diferencia}: de {actual} a {nueva} unidades totales.",
                "La diferencia sale o entra de lo disponible y el motivo queda en el"
                " historial (RN-05).",
            ]
        return confirmar(
            self,
            "Ajustar existencias",
            cuerpo,
            efectos,
            texto_accion="Registrar ajuste",
        )

    def guardar(self) -> None:
        self.resultado = self._inventario.ajustar_cantidad(
            self._articulo.id, self.entrada.valor(), self.motivo.texto().strip()
        )


class CategoriaDialog(FormDialog):
    """Alta (RN-46) y edición del nombre de una categoría."""

    def __init__(self, servicio_inventario, categoria=None, parent=None) -> None:
        es_edicion = categoria is not None
        super().__init__(
            "Editar categoría" if es_edicion else "Registrar categoría",
            "Las categorías agrupan los artículos del inventario.",
            texto_accion="Guardar cambios" if es_edicion else "Registrar categoría",
            ancho=420,
            parent=parent,
        )
        self._servicio = servicio_inventario
        self._categoria = categoria

        self.nombre = QLineEdit()
        self.nombre.setMaxLength(60)
        self.campo_nombre = self.agregar_campo(
            "Nombre de la categoría",
            self.nombre,
            "Nombre único (RN-46).",
            obligatorio=True,
        )
        if categoria is not None:
            self.nombre.setText(categoria.nombre)

    def validar(self):
        if not self.nombre.text().strip():
            return [(self.campo_nombre, "El nombre de la categoría es obligatorio")]
        return None

    def guardar(self) -> None:
        nombre = self.nombre.text().strip()
        if self._categoria is None:
            self.resultado = self._servicio.registrar_categoria(nombre)
        else:
            self.resultado = self._servicio.editar_categoria(
                self._categoria.id, nombre=nombre
            )


class UnidadEstadoDialog(FormDialog):
    """Cambia el estado de una unidad (el «ajuste» de los artículos por unidad)."""

    def __init__(self, servicio_unidades, unidad, parent=None) -> None:
        super().__init__(
            "Cambiar estado de la unidad",
            "El estado de una unidad es un movimiento con motivo (RN-52, RN-61).",
            texto_accion="Cambiar estado",
            ancho=440,
            parent=parent,
        )
        self._servicio = servicio_unidades
        self._unidad = unidad

        destino = QLineEdit()
        destino.setReadOnly(True)
        destino.setText(f"{unidad.codigo} · estado actual {_ETIQUETA_UNIDAD[unidad.estado]}")
        self.agregar_campo("Unidad", destino)

        self.destino = QComboBox()
        estados = _TRANSICIONES_VISIBLES.get(unidad.estado, [])
        for estado in estados:
            self.destino.addItem(_ETIQUETA_UNIDAD[estado], estado.value)
        self.destino.setCurrentIndex(0)
        if not estados:
            self.destino.addItem("Sin transición permitida", None)
            self.destino.setEnabled(False)
        self.campo_destino = self.agregar_campo(
            "Nuevo estado",
            self.destino,
            "Las transiciones que no tocan el cubo prestado (RN-53).",
            obligatorio=True,
        )

        self.motivo = TextArea(maximo=200, lineas=3)
        self.campo_motivo = self.agregar_campo(
            "Motivo", self.motivo, "Queda registrado en el historial.", obligatorio=True
        )

    def validar(self):
        if not self.motivo.texto().strip():
            return [(self.campo_motivo, "El motivo es obligatorio")]
        if self.destino.currentData() is None:
            return [(self.campo_destino, "La unidad no admite ese cambio")]
        return None

    def guardar(self) -> None:
        self.resultado = self._servicio.cambiar_estado(
            self._unidad.id,
            EstadoUnidad(self.destino.currentData()),
            self.motivo.texto().strip(),
        )


class UnidadEditarDialog(FormDialog):
    """Corrige el código o las notas de una unidad (RN-51); nunca el estado."""

    def __init__(self, servicio_unidades, unidad, parent=None) -> None:
        super().__init__(
            "Editar unidad",
            "Se cambia solo la identificación; el estado no se toca aquí (RN-51).",
            texto_accion="Guardar cambios",
            ancho=440,
            parent=parent,
        )
        self._servicio = servicio_unidades
        self._unidad = unidad

        self.codigo = QLineEdit()
        self.codigo.setText(unidad.codigo)
        self.campo_codigo = self.agregar_campo(
            "Código de la unidad",
            self.codigo,
            "Único dentro del laboratorio (RN-51).",
            obligatorio=True,
        )
        self.notas = TextArea(maximo=200, lineas=2)
        if unidad.notas:
            self.notas.set_texto(unidad.notas)
        self.agregar_campo("Notas", self.notas, "Opcional.")

    def validar(self):
        if not self.codigo.text().strip():
            return [(self.campo_codigo, "El código de la unidad es obligatorio")]
        return None

    def guardar(self) -> None:
        notas = self.notas.texto().strip() or None
        self.resultado = self._servicio.editar_unidad(
            self._unidad.id, codigo=self.codigo.text().strip(), notas=notas
        )
