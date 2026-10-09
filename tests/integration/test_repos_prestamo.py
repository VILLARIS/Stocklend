"""Préstamos y renglones: CRUD, vistas y CHECK de coherencia (RN-16 a RN-25)."""

from __future__ import annotations

import sqlite3

import pytest

from stocklend.domain import EstadoDetalle, EstadoPrestamo


def _base(repos, fabrica):
    estudiante = repos.estudiantes.crear(fabrica.estudiante())
    categoria = repos.categorias.crear(fabrica.categoria())
    articulo = repos.articulos.crear(
        fabrica.articulo(
            categoria.id,
            cantidad_total=5,
            cantidad_disponible=5,
            actualizado_en="2026-01-02",
        )
    )
    return estudiante, articulo


def test_crear_y_obtener(repos, fabrica):
    estudiante, _ = _base(repos, fabrica)
    creado = repos.prestamos.crear(fabrica.prestamo(estudiante.id))
    assert creado.id is not None
    assert repos.prestamos.obtener_por_id(creado.id) == creado
    assert repos.prestamos.obtener_por_folio(creado.folio) == creado


def test_folio_duplicado_falla(repos, fabrica):
    estudiante, _ = _base(repos, fabrica)
    repos.prestamos.crear(fabrica.prestamo(estudiante.id))
    with pytest.raises(sqlite3.IntegrityError):
        repos.prestamos.crear(fabrica.prestamo(estudiante.id, folio="PRE-2026-000001"))


def test_clave_foranea_invalida_falla(repos, fabrica):
    with pytest.raises(sqlite3.IntegrityError):
        repos.prestamos.crear(fabrica.prestamo(estudiante_id=999))


def test_renglones_y_unique_por_articulo(repos, fabrica):
    estudiante, articulo = _base(repos, fabrica)
    prestamo = repos.prestamos.crear(fabrica.prestamo(estudiante.id))
    detalle = repos.prestamos.crear_detalle(
        fabrica.prestamo_detalle(prestamo.id, articulo.id, cantidad_prestada=2)
    )
    assert detalle.id is not None
    assert repos.prestamos.obtener_detalle(detalle.id) == detalle
    assert (
        repos.prestamos.obtener_detalle_por_articulo(prestamo.id, articulo.id) == detalle
    )
    assert repos.prestamos.obtener_detalle_por_articulo(prestamo.id, 999) is None
    with pytest.raises(sqlite3.IntegrityError):
        repos.prestamos.crear_detalle(fabrica.prestamo_detalle(prestamo.id, articulo.id))


def test_check_de_estado_del_renglon(repos, fabrica):
    estudiante, articulo = _base(repos, fabrica)
    prestamo = repos.prestamos.crear(fabrica.prestamo(estudiante.id))
    with pytest.raises(sqlite3.IntegrityError):
        repos.prestamos.crear_detalle(
            fabrica.prestamo_detalle(
                prestamo.id, articulo.id, estado=EstadoDetalle.DEVUELTO
            )
        )


def test_actualizar_detalle_coherente(repos, fabrica):
    estudiante, articulo = _base(repos, fabrica)
    prestamo = repos.prestamos.crear(fabrica.prestamo(estudiante.id))
    detalle = repos.prestamos.crear_detalle(
        fabrica.prestamo_detalle(prestamo.id, articulo.id, cantidad_prestada=2)
    )
    actualizado = fabrica.prestamo_detalle(
        prestamo.id,
        articulo.id,
        id=detalle.id,
        cantidad_prestada=2,
        cantidad_devuelta=2,
        estado=EstadoDetalle.DEVUELTO,
    )
    repos.prestamos.actualizar_detalle(actualizado)
    assert repos.prestamos.obtener_detalle(detalle.id) == actualizado


def test_listar_con_filtros(repos, fabrica):
    estudiante, _ = _base(repos, fabrica)
    otro = repos.estudiantes.crear(
        fabrica.estudiante(codigo_universitario="U200")
    )
    repos.prestamos.crear(
        fabrica.prestamo(estudiante.id, folio="PRE-2026-000001", fecha_prestamo="2026-01-01")
    )
    repos.prestamos.crear(
        fabrica.prestamo(
            estudiante.id,
            folio="PRE-2026-000002",
            fecha_prestamo="2026-02-01",
            estado=EstadoPrestamo.CERRADO,
        )
    )
    repos.prestamos.crear(
        fabrica.prestamo(otro.id, folio="PRE-2026-000003", fecha_prestamo="2026-02-15")
    )

    assert repos.prestamos.contar() == 3
    assert repos.prestamos.contar(estado=EstadoPrestamo.ACTIVO) == 2
    assert [
        p.folio for p in repos.prestamos.listar(estudiante_id=estudiante.id)
    ] == ["PRE-2026-000002", "PRE-2026-000001"]
    assert [
        p.folio
        for p in repos.prestamos.listar(desde="2026-02-01", hasta="2026-02-10")
    ] == ["PRE-2026-000002"]


def test_actualizar_estado(repos, fabrica):
    estudiante, _ = _base(repos, fabrica)
    prestamo = repos.prestamos.crear(fabrica.prestamo(estudiante.id))
    cerrado = fabrica.prestamo(
        estudiante.id, id=prestamo.id, estado=EstadoPrestamo.CERRADO, cerrado_en="2026-03-01"
    )
    repos.prestamos.actualizar_estado(cerrado)
    assert repos.prestamos.obtener_por_id(prestamo.id) == cerrado


def test_vista_prestamos_activos_con_pendiente(repos, fabrica):
    estudiante, articulo = _base(repos, fabrica)
    con_pendiente = repos.prestamos.crear(fabrica.prestamo(estudiante.id))
    repos.prestamos.crear_detalle(
        fabrica.prestamo_detalle(con_pendiente.id, articulo.id, cantidad_prestada=2)
    )
    sin_renglones = repos.prestamos.crear(
        fabrica.prestamo(estudiante.id, folio="PRE-2026-000002")
    )

    pendientes = repos.prestamos.listar_activos_pendientes(estudiante_id=estudiante.id)
    assert [p.id for p in pendientes] == [con_pendiente.id]
    assert sin_renglones.id not in [p.id for p in pendientes]


def test_vista_cantidad_pendiente_por_renglon(repos, fabrica):
    estudiante, articulo = _base(repos, fabrica)
    prestamo = repos.prestamos.crear(fabrica.prestamo(estudiante.id))
    repos.prestamos.crear_detalle(
        fabrica.prestamo_detalle(prestamo.id, articulo.id, cantidad_prestada=3)
    )
    detalle = repos.prestamos.listar_detalles_con_pendiente(prestamo.id)[0]
    assert detalle.cantidad_pendiente == 3
