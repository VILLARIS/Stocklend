"""Entidades del dominio: inmutabilidad y tipos correctos."""

from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from stocklend.domain import (
    Articulo,
    Categoria,
    EstadoPrestamo,
    Estudiante,
    Prestamo,
    PrestamoDetalle,
)


def test_entidad_es_inmutable():
    categoria = Categoria(
        id=1, nombre="Utensilios", descripcion=None, activo=True, creado_en="2026-01-01"
    )
    with pytest.raises(FrozenInstanceError):
        categoria.nombre = "Otros"  # type: ignore[misc]


def test_entidades_comparan_por_valor():
    a = Estudiante(
        id=None,
        codigo_universitario="U100",
        nombres="Ana",
        apellidos="Pérez",
        activo=True,
        creado_en="2026-01-01",
        actualizado_en="2026-01-01",
    )
    b = Estudiante(
        id=None,
        codigo_universitario="U100",
        nombres="Ana",
        apellidos="Pérez",
        activo=True,
        creado_en="2026-01-01",
        actualizado_en="2026-01-01",
    )
    assert a == b


def test_tipos_correctos_de_articulo(fabrica):
    articulo = fabrica.articulo(
        categoria_id=1, cantidad_total=5, cantidad_disponible=5, control_individual=True
    )
    assert isinstance(articulo, Articulo)
    assert isinstance(articulo.cantidad_total, int)
    assert isinstance(articulo.control_individual, bool)
    assert isinstance(articulo.prestable, bool)


def test_prestamo_usa_enum_de_estado(fabrica):
    prestamo = fabrica.prestamo()
    assert isinstance(prestamo, Prestamo)
    assert prestamo.estado is EstadoPrestamo.ACTIVO
    assert prestamo.fecha_limite is None


def test_prestamo_detalle_pendiente_por_defecto(fabrica):
    detalle = fabrica.prestamo_detalle()
    assert isinstance(detalle, PrestamoDetalle)
    assert detalle.cantidad_pendiente is None
