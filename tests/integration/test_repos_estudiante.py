"""CRUD, búsqueda y restricciones del repositorio de estudiantes (RN-11 a RN-15)."""

from __future__ import annotations

import sqlite3

import pytest

from stocklend.domain import NoEncontradoError


def test_crear_y_obtener(repos, fabrica):
    creado = repos.estudiantes.crear(
        fabrica.estudiante(codigo_universitario="U100")
    )
    assert creado.id is not None
    assert repos.estudiantes.obtener_por_id(creado.id) == creado
    assert repos.estudiantes.obtener_por_codigo("U100") == creado
    assert repos.estudiantes.obtener_por_codigo("u100") == creado
    assert repos.estudiantes.obtener_por_id(999) is None


def test_codigo_duplicado_ignora_mayusculas(repos, fabrica):
    repos.estudiantes.crear(fabrica.estudiante(codigo_universitario="U100"))
    with pytest.raises(sqlite3.IntegrityError):
        repos.estudiantes.crear(fabrica.estudiante(codigo_universitario="u100"))


def test_listar_y_buscar(repos, fabrica):
    repos.estudiantes.crear(
        fabrica.estudiante(codigo_universitario="U1", nombres="Ana", apellidos="Pérez")
    )
    repos.estudiantes.crear(
        fabrica.estudiante(
            codigo_universitario="U2",
            nombres="Luis",
            apellidos="Gómez",
            activo=False,
        )
    )
    assert [e.codigo_universitario for e in repos.estudiantes.listar()] == ["U2", "U1"]
    assert repos.estudiantes.contar(solo_activos=True) == 1
    assert [
        e.codigo_universitario for e in repos.estudiantes.buscar("Pérez")
    ] == ["U1"]
    assert [
        e.codigo_universitario
        for e in repos.estudiantes.buscar("U", solo_activos=True)
    ] == ["U1"]


def test_tiene_prestamos(repos, fabrica):
    estudiante = repos.estudiantes.crear(fabrica.estudiante())
    assert repos.estudiantes.tiene_prestamos(estudiante.id) is False
    repos.prestamos.crear(fabrica.prestamo(estudiante.id))
    assert repos.estudiantes.tiene_prestamos(estudiante.id) is True


def test_actualizar_e_inactivar(repos, fabrica):
    creado = repos.estudiantes.crear(fabrica.estudiante())
    cambiado = fabrica.estudiante(
        id=creado.id,
        nombres="Ana María",
        apellidos="Pérez",
        activo=False,
        actualizado_en="2026-03-01",
    )
    repos.estudiantes.actualizar(cambiado)
    assert repos.estudiantes.obtener_por_id(creado.id) == cambiado


def test_actualizar_inexistente_falla(repos, fabrica):
    with pytest.raises(NoEncontradoError):
        repos.estudiantes.actualizar(fabrica.estudiante(id=999))


def test_no_expone_borrado(repos):
    assert not hasattr(repos.estudiantes, "eliminar")
    assert not hasattr(repos.estudiantes, "borrar")
