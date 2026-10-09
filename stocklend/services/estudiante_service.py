"""Estudiantes: alta, edición, búsqueda, inactivación e historial (Etapa 3).

Nunca se elimina un estudiante (RN-14, RN-46): si tiene préstamos se marca
inactivo. Editar sus datos no altera su historial (RN-15) porque las consultas de
historial viven en los préstamos, que conservan el identificador.
"""

from __future__ import annotations

import sqlite3
from dataclasses import replace

from ..data.database import transaction
from ..data.repositories import EstudianteRepo, PrestamoRepo
from ..domain.entidades import Estudiante, Prestamo
from ..domain.enums import EstadoPrestamo
from ..domain.excepciones import NoEncontradoError, ReglaNegocioError
from ..domain.value_objects import CodigoUniversitario
from ._comun import ahora, texto_obligatorio


class EstudianteService:
    """Casos de uso de estudiantes sobre una conexión ya abierta."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._estudiantes = EstudianteRepo(conn)
        self._prestamos = PrestamoRepo(conn)

    def registrar_estudiante(
        self,
        codigo_universitario: str,
        nombres: str,
        apellidos: str,
        *,
        fecha: str | None = None,
    ) -> Estudiante:
        """Alta con código único y nombres obligatorios (RN-11, RN-12)."""
        codigo = str(CodigoUniversitario(codigo_universitario))
        nombres = texto_obligatorio(nombres, "Los nombres")
        apellidos = texto_obligatorio(apellidos, "Los apellidos")
        with transaction(self._conn):
            if self._estudiantes.obtener_por_codigo(codigo) is not None:
                raise ReglaNegocioError(
                    f"Ya existe un estudiante con el código '{codigo}' (RN-11)"
                )
            momento = fecha or ahora()
            return self._estudiantes.crear(
                Estudiante(
                    id=None,
                    codigo_universitario=codigo,
                    nombres=nombres,
                    apellidos=apellidos,
                    activo=True,
                    creado_en=momento,
                    actualizado_en=momento,
                )
            )

    def editar_estudiante(
        self,
        estudiante_id: int,
        *,
        codigo_universitario: str | None = None,
        nombres: str | None = None,
        apellidos: str | None = None,
        activo: bool | None = None,
        fecha: str | None = None,
    ) -> Estudiante:
        """Corrige los datos sin tocar el historial de préstamos (RN-15)."""
        with transaction(self._conn):
            estudiante = self._obtener(estudiante_id)
            nuevo_codigo = estudiante.codigo_universitario
            if codigo_universitario is not None:
                nuevo_codigo = str(CodigoUniversitario(codigo_universitario))
                if nuevo_codigo != estudiante.codigo_universitario:
                    existente = self._estudiantes.obtener_por_codigo(nuevo_codigo)
                    if existente is not None and existente.id != estudiante.id:
                        raise ReglaNegocioError(
                            f"Ya existe un estudiante con el código '{nuevo_codigo}' (RN-11)"
                        )
            actualizado = replace(
                estudiante,
                codigo_universitario=nuevo_codigo,
                nombres=(
                    estudiante.nombres
                    if nombres is None
                    else texto_obligatorio(nombres, "Los nombres")
                ),
                apellidos=(
                    estudiante.apellidos
                    if apellidos is None
                    else texto_obligatorio(apellidos, "Los apellidos")
                ),
                activo=estudiante.activo if activo is None else bool(activo),
                actualizado_en=fecha or ahora(),
            )
            self._estudiantes.actualizar(actualizado)
            return actualizado

    def inactivar_estudiante(
        self, estudiante_id: int, *, fecha: str | None = None
    ) -> Estudiante:
        """Marca inactivo en lugar de eliminar, aunque tenga préstamos (RN-14)."""
        return self._cambiar_activo(estudiante_id, False, fecha)

    def reactivar_estudiante(
        self, estudiante_id: int, *, fecha: str | None = None
    ) -> Estudiante:
        return self._cambiar_activo(estudiante_id, True, fecha)

    def obtener_estudiante(self, estudiante_id: int) -> Estudiante:
        with transaction(self._conn):
            return self._obtener(estudiante_id)

    def obtener_por_codigo(self, codigo_universitario: str) -> Estudiante:
        codigo = str(CodigoUniversitario(codigo_universitario))
        with transaction(self._conn):
            estudiante = self._estudiantes.obtener_por_codigo(codigo)
            if estudiante is None:
                raise NoEncontradoError(
                    f"No existe un estudiante con el código '{codigo}'"
                )
            return estudiante

    def listar_estudiantes(
        self,
        *,
        solo_activos: bool = False,
        limite: int = 50,
        desplazamiento: int = 0,
    ) -> list[Estudiante]:
        with transaction(self._conn):
            return self._estudiantes.listar(
                solo_activos=solo_activos,
                limite=limite,
                desplazamiento=desplazamiento,
            )

    def buscar_estudiantes(
        self,
        termino: str,
        *,
        solo_activos: bool = False,
        limite: int = 50,
        desplazamiento: int = 0,
    ) -> list[Estudiante]:
        """Búsqueda tolerante a mayúsculas, acentos y espacios (RN-13)."""
        with transaction(self._conn):
            return self._estudiantes.buscar(
                termino,
                solo_activos=solo_activos,
                limite=limite,
                desplazamiento=desplazamiento,
            )

    def historial_prestamos(
        self,
        estudiante_id: int,
        *,
        estado: EstadoPrestamo | None = None,
        limite: int = 50,
        desplazamiento: int = 0,
    ) -> list[Prestamo]:
        """Préstamos del estudiante; sobreviven a la edición de sus datos (RN-15)."""
        with transaction(self._conn):
            self._obtener(estudiante_id)
            return self._prestamos.listar_por_estudiante(
                estudiante_id,
                estado=estado,
                limite=limite,
                desplazamiento=desplazamiento,
            )

    # ------------------------------------------------------------- auxiliares

    def _cambiar_activo(
        self, estudiante_id: int, activo: bool, fecha: str | None
    ) -> Estudiante:
        with transaction(self._conn):
            estudiante = self._obtener(estudiante_id)
            actualizado = replace(
                estudiante, activo=activo, actualizado_en=fecha or ahora()
            )
            self._estudiantes.actualizar(actualizado)
            return actualizado

    def _obtener(self, estudiante_id: int) -> Estudiante:
        estudiante = self._estudiantes.obtener_por_id(estudiante_id)
        if estudiante is None:
            raise NoEncontradoError(f"No existe el estudiante {estudiante_id}")
        return estudiante
