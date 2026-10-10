"""Entidades del dominio (ARCHITECTURE §3.1).

Dataclasses inmutables que reflejan una fila de su tabla, con los tipos correctos:
los enteros son ``int`` (nunca ``str``), los booleanos ``bool`` y los estados y
tipos usan las enumeraciones de :mod:`.enums`. No contienen SQL, ni acceso a red o
archivos, ni lectura de la hora del sistema: el tiempo lo inyecta el servicio.
"""

from __future__ import annotations

from dataclasses import dataclass

from .enums import (
    EstadoDetalle,
    EstadoIncidente,
    EstadoPrestamo,
    EstadoUnidad,
    OrigenIncidente,
    ResponsabilidadIncidente,
    TipoIncidente,
    TipoMovimiento,
)


@dataclass(frozen=True, slots=True)
class Categoria:
    id: int | None
    nombre: str
    descripcion: str | None
    activo: bool
    creado_en: str


@dataclass(frozen=True, slots=True)
class Articulo:
    id: int | None
    codigo: str | None
    nombre: str
    categoria_id: int
    unidad_medida: str
    notas: str | None
    control_individual: bool
    prestable: bool
    activo: bool
    cantidad_total: int
    cantidad_disponible: int
    cantidad_prestada: int
    cantidad_daniada: int
    cantidad_faltante: int
    creado_en: str
    actualizado_en: str


@dataclass(frozen=True, slots=True)
class ArticuloUnidad:
    id: int | None
    articulo_id: int
    codigo: str
    descripcion: str | None
    estado: EstadoUnidad
    prestamo_detalle_id: int | None
    verificado_en: str | None
    notas: str | None
    creado_en: str
    actualizado_en: str


@dataclass(frozen=True, slots=True)
class Estudiante:
    id: int | None
    codigo_universitario: str
    nombres: str
    apellidos: str
    activo: bool
    creado_en: str
    actualizado_en: str


@dataclass(frozen=True, slots=True)
class Prestamo:
    id: int | None
    folio: str
    estudiante_id: int
    fecha_prestamo: str
    fecha_limite: str | None
    estado: EstadoPrestamo
    comentario: str | None
    creado_en: str
    cerrado_en: str | None


@dataclass(frozen=True, slots=True)
class PrestamoDetalle:
    id: int | None
    prestamo_id: int
    articulo_id: int
    cantidad_prestada: int
    cantidad_devuelta: int
    cantidad_daniada: int
    cantidad_perdida: int
    estado: EstadoDetalle
    notas: str | None
    # Solo se rellena al leer desde ``v_prestamo_detalle`` (DATABASE_DESIGN §6.1).
    cantidad_pendiente: int | None = None


@dataclass(frozen=True, slots=True)
class Devolucion:
    id: int | None
    prestamo_id: int
    fecha_devolucion: str
    observaciones: str | None
    creado_en: str


@dataclass(frozen=True, slots=True)
class DevolucionDetalle:
    id: int | None
    devolucion_id: int
    prestamo_detalle_id: int
    cantidad_devuelta: int
    cantidad_daniada: int
    cantidad_perdida: int
    notas: str | None


@dataclass(frozen=True, slots=True)
class Incidente:
    id: int | None
    tipo: TipoIncidente
    estado: EstadoIncidente
    origen: OrigenIncidente
    prestamo_id: int | None
    prestamo_detalle_id: int | None
    devolucion_id: int | None
    articulo_id: int
    articulo_unidad_id: int | None
    estudiante_id: int | None
    responsabilidad: ResponsabilidadIncidente
    cantidad: int
    descripcion: str
    resolucion: str | None
    resuelto_en: str | None
    creado_en: str


@dataclass(frozen=True, slots=True)
class MovimientoInventario:
    id: int | None
    articulo_id: int
    articulo_unidad_id: int | None
    tipo: TipoMovimiento
    cantidad: int
    cantidad_resultante_total: int
    cantidad_resultante_disponible: int
    motivo: str
    referencia_tipo: str | None
    referencia_id: int | None
    fecha: str


@dataclass(frozen=True, slots=True)
class Configuracion:
    clave: str
    valor: str
    actualizado_en: str


@dataclass(frozen=True, slots=True)
class ResumenInventario:
    """Agregados del inventario para las tarjetas de la pantalla (RF-INV-05).

    Es un modelo de lectura calculado en una sola consulta; no corresponde a
    ninguna tabla y no altera el esquema.
    """

    articulos: int
    unidades_total: int
    disponibles: int
    prestadas: int
