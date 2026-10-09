"""Utilidades compartidas por los servicios (Etapa 3).

Concentra las tres piezas que, de duplicarse, serían el punto donde los números
importan: el cálculo puro de contadores (RN-01, RN-02, RN-58, RN-59), el registro
del movimiento en el orden de ``DATABASE_DESIGN`` §9.3 y las validaciones de
entrada comunes (motivo no vacío RN-05, textos obligatorios).
"""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime

from ..data.repositories import ArticuloRepo, MovimientoRepo
from ..domain.entidades import Articulo, MovimientoInventario
from ..domain.enums import Cubo, TipoMovimiento
from ..domain.excepciones import (
    CantidadInsuficienteError,
    ReglaNegocioError,
    ValidacionError,
)

SIN_CAMBIO: object = object()
"""Centinela para distinguir «no cambiar este campo» de «cambiarlo a ``None``»."""

_CUBOS_CANTIDAD = {
    Cubo.DISPONIBLE: "cantidad_disponible",
    Cubo.PRESTADA: "cantidad_prestada",
    Cubo.DANADA: "cantidad_daniada",
    Cubo.FALTANTE: "cantidad_faltante",
}


def ahora() -> str:
    """Marca de tiempo ISO local, única lectura de reloj permitida (en servicios)."""
    return datetime.now().isoformat(timespec="seconds")


def validar_motivo(motivo: str) -> str:
    """Exige un motivo no vacío para cualquier cambio de cantidad (RN-05, RN-47)."""
    if not isinstance(motivo, str) or not motivo.strip():
        raise ValidacionError("El motivo es obligatorio")
    return motivo.strip()


def texto_obligatorio(valor: str, campo: str) -> str:
    """Valida un texto obligatorio que no puede quedar vacío ni solo con espacios."""
    if not isinstance(valor, str) or not valor.strip():
        raise ValidacionError(f"{campo} es obligatorio y no puede quedar vacío")
    return valor.strip()


def entero_no_negativo(valor: int, campo: str) -> int:
    """Valida una cantidad entera mayor o igual que cero (RN-29)."""
    if not isinstance(valor, int) or isinstance(valor, bool) or valor < 0:
        raise ValidacionError(f"{campo} debe ser un número entero mayor o igual a cero")
    return valor


def calcular_contadores(
    articulo: Articulo, tipo: TipoMovimiento, cantidad: int
) -> Articulo:
    """Devuelve el artículo con sus cinco contadores tras el movimiento.

    El cubo de origen y el de destino los declara el **tipo** de movimiento
    (RN-58, RN-59); el cálculo es determinista. Aplica ``cantidad`` unidades y
    rechaza cualquier cubo negativo (RN-01, RN-06) o total negativo, sin escribir
    nada: la escritura la hacen los servicios dentro de su transacción.
    """
    if not isinstance(cantidad, int) or isinstance(cantidad, bool) or cantidad <= 0:
        raise ValidacionError("La cantidad del movimiento debe ser mayor que cero")
    if articulo.id is None:
        raise ValueError("No se pueden calcular contadores de un artículo sin id")

    valores = {
        cubo: getattr(articulo, atributo) for cubo, atributo in _CUBOS_CANTIDAD.items()
    }
    total = articulo.cantidad_total

    origen = tipo.origen
    destino = tipo.destino
    if origen is not None:
        valores[origen] -= cantidad
    if destino is not None:
        valores[destino] += cantidad
    total += cantidad * tipo.delta_total

    for cubo, valor in valores.items():
        if valor < 0:
            raise CantidadInsuficienteError(
                f"No hay {cubo.value} suficiente para el movimiento '{tipo.value}'",
                disponible=valores[Cubo.DISPONIBLE],
            )
    if total < 0:
        raise CantidadInsuficienteError(
            f"El movimiento '{tipo.value}' dejaría la cantidad total en {total}",
            disponible=valores[Cubo.DISPONIBLE],
        )
    if total != sum(valores.values()):
        raise ReglaNegocioError(
            "El movimiento rompería la invariante RN-02 "
            "(total = disponible + prestada + dañada + faltante)"
        )
    return replace(
        articulo,
        cantidad_total=total,
        cantidad_disponible=valores[Cubo.DISPONIBLE],
        cantidad_prestada=valores[Cubo.PRESTADA],
        cantidad_daniada=valores[Cubo.DANADA],
        cantidad_faltante=valores[Cubo.FALTANTE],
    )


def construir_movimiento(
    articulo: Articulo,
    tipo: TipoMovimiento,
    cantidad: int,
    motivo: str,
    *,
    fecha: str,
    unidad_id: int | None = None,
    referencia_tipo: str | None = None,
    referencia_id: int | None = None,
) -> MovimientoInventario:
    """Construye el asiento del libro con las cantidades **resultantes** (RN-05)."""
    if articulo.id is None:
        raise ValueError("No se puede registrar un movimiento de un artículo sin id")
    return MovimientoInventario(
        id=None,
        articulo_id=articulo.id,
        articulo_unidad_id=unidad_id,
        tipo=tipo,
        cantidad=cantidad,
        cantidad_resultante_total=articulo.cantidad_total,
        cantidad_resultante_disponible=articulo.cantidad_disponible,
        motivo=validar_motivo(motivo),
        referencia_tipo=referencia_tipo,
        referencia_id=referencia_id,
        fecha=fecha,
    )


def registrar_movimiento(
    articulos: ArticuloRepo,
    movimientos: MovimientoRepo,
    articulo: Articulo,
    tipo: TipoMovimiento,
    cantidad: int,
    motivo: str,
    *,
    fecha: str,
    unidad_id: int | None = None,
    referencia_tipo: str | None = None,
    referencia_id: int | None = None,
) -> Articulo:
    """Aplica el movimiento y lo persiste en el orden de §9.3 (pasos 4 y 6).

    No abre transacción: la abre y la cierra el método público del servicio, de
    modo que contador y movimiento son siempre un todo o nada (RN-05, RN-48).
    """
    nuevo = calcular_contadores(articulo, tipo, cantidad)
    articulos.actualizar_contadores(nuevo)
    movimientos.crear(
        construir_movimiento(
            nuevo,
            tipo,
            cantidad,
            motivo,
            fecha=fecha,
            unidad_id=unidad_id,
            referencia_tipo=referencia_tipo,
            referencia_id=referencia_id,
        )
    )
    return nuevo
