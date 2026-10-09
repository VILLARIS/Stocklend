"""Enumeraciones del dominio: valores y metadatos de los movimientos."""

from __future__ import annotations

from stocklend.domain import (
    Cubo,
    EstadoDetalle,
    EstadoIncidente,
    EstadoPrestamo,
    EstadoUnidad,
    OrigenIncidente,
    ResponsabilidadIncidente,
    TipoIncidente,
    TipoMovimiento,
)


def test_valores_coinciden_con_el_esquema():
    assert [e.value for e in EstadoPrestamo] == ["activo", "cerrado", "anulado"]
    assert [e.value for e in EstadoDetalle] == [
        "pendiente",
        "parcial",
        "devuelto",
        "con_incidente",
    ]
    assert [e.value for e in EstadoUnidad] == [
        "disponible",
        "prestada",
        "danada",
        "faltante",
        "baja",
    ]
    assert [e.value for e in EstadoIncidente] == ["abierto", "resuelto"]
    assert [e.value for e in TipoIncidente] == ["perdida", "danio", "otro"]
    assert [e.value for e in OrigenIncidente] == ["stock", "prestamo", "devolucion"]
    assert [e.value for e in ResponsabilidadIncidente] == [
        "estudiante",
        "facultad",
        "sin_determinar",
    ]


def test_hay_doce_tipos_de_movimiento():
    assert len(TipoMovimiento) == 12
    assert {t.value for t in TipoMovimiento} == {
        "alta",
        "ajuste_positivo",
        "ajuste_negativo",
        "prestamo",
        "devolucion",
        "danio_prestado",
        "perdida_prestado",
        "danio_disponible",
        "perdida_disponible",
        "reingreso_reparacion",
        "baja_daniada",
        "baja_faltante",
    }


def test_cubos_de_origen_y_destino():
    assert TipoMovimiento.PRESTAMO.origen is Cubo.DISPONIBLE
    assert TipoMovimiento.PRESTAMO.destino is Cubo.PRESTADA
    assert TipoMovimiento.DEVOLUCION.origen is Cubo.PRESTADA
    assert TipoMovimiento.DEVOLUCION.destino is Cubo.DISPONIBLE
    assert TipoMovimiento.DANIO_PRESTADO.origen is Cubo.PRESTADA
    assert TipoMovimiento.DANIO_PRESTADO.destino is Cubo.DANADA
    assert TipoMovimiento.REINGRESO_REPARACION.origen is Cubo.DANADA
    assert TipoMovimiento.REINGRESO_REPARACION.destino is Cubo.DISPONIBLE


def test_efecto_sobre_el_total():
    assert TipoMovimiento.ALTA.delta_total == 1
    assert TipoMovimiento.AJUSTE_POSITIVO.delta_total == 1
    assert TipoMovimiento.AJUSTE_NEGATIVO.delta_total == -1
    assert TipoMovimiento.BAJA_DANIADA.delta_total == -1
    assert TipoMovimiento.BAJA_FALTANTE.delta_total == -1
    assert TipoMovimiento.PRESTAMO.delta_total == 0


def test_alta_entra_desde_fuera_y_baja_sale_del_sistema():
    assert TipoMovimiento.ALTA.origen is None
    assert TipoMovimiento.ALTA.destino is Cubo.DISPONIBLE
    assert TipoMovimiento.AJUSTE_NEGATIVO.origen is Cubo.DISPONIBLE
    assert TipoMovimiento.AJUSTE_NEGATIVO.destino is None
    assert TipoMovimiento.BAJA_DANIADA.destino is None


def test_coherencia_entre_origen_destino_y_total():
    for tipo in TipoMovimiento:
        if tipo.origen is None:
            assert tipo.delta_total == 1
        if tipo.destino is None:
            assert tipo.delta_total == -1
        if tipo.origen is not None and tipo.destino is not None:
            assert tipo.delta_total == 0
        assert tipo.origen is None or isinstance(tipo.origen, Cubo)
