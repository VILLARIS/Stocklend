"""Enumeraciones del dominio, con los mismos valores que las columnas TEXT del esquema.

Los valores son cadenas idénticas a las del ``CHECK`` de la base, de modo que una
entidad se puede leer y escribir sin traducciones intermedias.

``TipoMovimiento`` además transporta el **cubo de origen**, el **cubo de destino**
y el efecto sobre el total (DATABASE_DESIGN §4.9.1, RN-58/RN-59): el efecto de un
movimiento se deduce de su tipo y no se deja a criterio del servicio.
"""

from __future__ import annotations

from enum import Enum


class EstadoPrestamo(str, Enum):
    """Estado de un préstamo (``prestamo.estado``)."""

    ACTIVO = "activo"
    CERRADO = "cerrado"
    ANULADO = "anulado"


class EstadoDetalle(str, Enum):
    """Estado derivado de un renglón de préstamo (``prestamo_detalle.estado``)."""

    PENDIENTE = "pendiente"
    PARCIAL = "parcial"
    DEVUELTO = "devuelto"
    CON_INCIDENTE = "con_incidente"


class EstadoUnidad(str, Enum):
    """Estado de una unidad individual (``articulo_unidad.estado``)."""

    DISPONIBLE = "disponible"
    PRESTADA = "prestada"
    DANADA = "danada"
    FALTANTE = "faltante"
    BAJA = "baja"


class EstadoIncidente(str, Enum):
    """Estado de un incidente (``incidente.estado``)."""

    ABIERTO = "abierto"
    RESUELTO = "resuelto"


class TipoIncidente(str, Enum):
    """Tipo de incidente (``incidente.tipo``)."""

    PERDIDA = "perdida"
    DANIO = "danio"
    OTRO = "otro"


class OrigenIncidente(str, Enum):
    """Origen de un incidente (``incidente.origen``)."""

    STOCK = "stock"
    PRESTAMO = "prestamo"
    DEVOLUCION = "devolucion"


class ResponsabilidadIncidente(str, Enum):
    """Responsabilidad de un incidente (``incidente.responsabilidad``)."""

    ESTUDIANTE = "estudiante"
    FACULTAD = "facultad"
    SIN_DETERMINAR = "sin_determinar"


class Cubo(str, Enum):
    """Los cinco cubos de inventario de un artículo (RN-02, RN-58)."""

    TOTAL = "total"
    DISPONIBLE = "disponible"
    PRESTADA = "prestada"
    DANADA = "danada"
    FALTANTE = "faltante"


class TipoMovimiento(str, Enum):
    """Los 12 tipos de movimiento de inventario (DATABASE_DESIGN §4.9.1)."""

    ALTA = "alta"
    AJUSTE_POSITIVO = "ajuste_positivo"
    AJUSTE_NEGATIVO = "ajuste_negativo"
    PRESTAMO = "prestamo"
    DEVOLUCION = "devolucion"
    DANIO_PRESTADO = "danio_prestado"
    PERDIDA_PRESTADO = "perdida_prestado"
    DANIO_DISPONIBLE = "danio_disponible"
    PERDIDA_DISPONIBLE = "perdida_disponible"
    REINGRESO_REPARACION = "reingreso_reparacion"
    BAJA_DANIADA = "baja_daniada"
    BAJA_FALTANTE = "baja_faltante"

    @property
    def origen(self) -> Cubo | None:
        """Cubo del que sale la unidad (``None`` si entra desde fuera del sistema)."""
        return _EFECTOS[self][0]

    @property
    def destino(self) -> Cubo | None:
        """Cubo al que entra la unidad (``None`` si sale del sistema)."""
        return _EFECTOS[self][1]

    @property
    def delta_total(self) -> int:
        """Efecto sobre ``cantidad_total``: ``+1``, ``-1`` o ``0``."""
        return _EFECTOS[self][2]


# (origen, destino, efecto sobre el total), DATABASE_DESIGN §4.9.1.
_EFECTOS: dict[TipoMovimiento, tuple[Cubo | None, Cubo | None, int]] = {
    TipoMovimiento.ALTA: (None, Cubo.DISPONIBLE, +1),
    TipoMovimiento.AJUSTE_POSITIVO: (None, Cubo.DISPONIBLE, +1),
    TipoMovimiento.AJUSTE_NEGATIVO: (Cubo.DISPONIBLE, None, -1),
    TipoMovimiento.PRESTAMO: (Cubo.DISPONIBLE, Cubo.PRESTADA, 0),
    TipoMovimiento.DEVOLUCION: (Cubo.PRESTADA, Cubo.DISPONIBLE, 0),
    TipoMovimiento.DANIO_PRESTADO: (Cubo.PRESTADA, Cubo.DANADA, 0),
    TipoMovimiento.PERDIDA_PRESTADO: (Cubo.PRESTADA, Cubo.FALTANTE, 0),
    TipoMovimiento.DANIO_DISPONIBLE: (Cubo.DISPONIBLE, Cubo.DANADA, 0),
    TipoMovimiento.PERDIDA_DISPONIBLE: (Cubo.DISPONIBLE, Cubo.FALTANTE, 0),
    TipoMovimiento.REINGRESO_REPARACION: (Cubo.DANADA, Cubo.DISPONIBLE, 0),
    TipoMovimiento.BAJA_DANIADA: (Cubo.DANADA, None, -1),
    TipoMovimiento.BAJA_FALTANTE: (Cubo.FALTANTE, None, -1),
}
