"""Casos de uso de estudiantes (RN-11 a RN-15)."""

from __future__ import annotations

import pytest

from stocklend.domain import NoEncontradoError, ReglaNegocioError, ValidacionError


def test_registrar_estudiante_codigo_unico_y_obligatorio(servicios):
    estudiante = servicios.estudiantes.registrar_estudiante("U100", "Ana", "Pérez")
    assert estudiante.id is not None
    with pytest.raises(ReglaNegocioError):  # RN-11
        servicios.estudiantes.registrar_estudiante("u100", "Otra", "Persona")
    with pytest.raises(ValidacionError):  # RN-11
        servicios.estudiantes.registrar_estudiante("   ", "Otra", "Persona")


def test_nombres_y_apellidos_obligatorios(servicios):
    with pytest.raises(ValidacionError):  # RN-12
        servicios.estudiantes.registrar_estudiante("U101", "   ", "Pérez")
    with pytest.raises(ValidacionError):  # RN-12
        servicios.estudiantes.registrar_estudiante("U101", "Ana", "   ")


def test_busqueda_ignora_acentos_mayusculas_y_espacios(servicios):
    servicios.estudiantes.registrar_estudiante("U100", "Ana", "Pérez")
    servicios.estudiantes.registrar_estudiante("U101", "José", "Márquez")
    for termino in ("perez", "PÉREZ", "  perez  ", "PER"):  # RN-13
        resultados = servicios.estudiantes.buscar_estudiantes(termino)
        assert [e.codigo_universitario for e in resultados] == ["U100"]
    assert len(servicios.estudiantes.buscar_estudiantes("ma")) == 1


def test_editar_estudiante_conserva_historial(servicios, repos, fabrica):
    estudiante = servicios.estudiantes.registrar_estudiante("U100", "Ana", "Pérez")
    prestamo = repos.prestamos.crear(fabrica.prestamo(estudiante_id=estudiante.id))
    editado = servicios.estudiantes.editar_estudiante(
        estudiante.id, nombres="Ana María", apellidos="Pérez Gómez"
    )
    assert editado.nombres == "Ana María"
    historial = servicios.estudiantes.historial_prestamos(estudiante.id)  # RN-15
    assert [p.folio for p in historial] == [prestamo.folio]
    assert historial[0].estudiante_id == estudiante.id


def test_editar_codigo_duplicado_se_rechaza(servicios):
    servicios.estudiantes.registrar_estudiante("U100", "Ana", "Pérez")
    otro = servicios.estudiantes.registrar_estudiante("U101", "Luis", "Gómez")
    with pytest.raises(ReglaNegocioError):  # RN-11
        servicios.estudiantes.editar_estudiante(otro.id, codigo_universitario="U100")


def test_estudiante_con_prestamos_solo_se_desactiva(servicios, repos, fabrica):
    estudiante = servicios.estudiantes.registrar_estudiante("U100", "Ana", "Pérez")
    repos.prestamos.crear(fabrica.prestamo(estudiante_id=estudiante.id))

    assert repos.estudiantes.tiene_prestamos(estudiante.id)
    inactivo = servicios.estudiantes.inactivar_estudiante(estudiante.id)  # RN-14
    assert inactivo.activo is False
    assert servicios.estudiantes.obtener_estudiante(estudiante.id).activo is False
    assert repos.estudiantes.obtener_por_id(estudiante.id) is not None

    reactivado = servicios.estudiantes.reactivar_estudiante(estudiante.id)
    assert reactivado.activo is True


def test_listar_solo_activos_y_obtener_por_codigo(servicios):
    servicios.estudiantes.registrar_estudiante("U100", "Ana", "Pérez")
    inactivo = servicios.estudiantes.registrar_estudiante("U101", "Luis", "Gómez")
    servicios.estudiantes.inactivar_estudiante(inactivo.id)
    assert len(servicios.estudiantes.listar_estudiantes()) == 2
    assert len(servicios.estudiantes.listar_estudiantes(solo_activos=True)) == 1
    assert (
        servicios.estudiantes.obtener_por_codigo("U100").nombres == "Ana"
    )
    with pytest.raises(NoEncontradoError):
        servicios.estudiantes.obtener_por_codigo("U999")


def test_historial_de_estudiante_inexistente(servicios):
    with pytest.raises(NoEncontradoError):
        servicios.estudiantes.historial_prestamos(999)
