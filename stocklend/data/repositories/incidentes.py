"""Repositorio de incidentes (RN-40 a RN-45, RN-54 a RN-57)."""

from __future__ import annotations

import sqlite3
from dataclasses import replace

from ...domain.entidades import Incidente
from ...domain.enums import (
    EstadoIncidente,
    OrigenIncidente,
    ResponsabilidadIncidente,
    TipoIncidente,
)
from ...domain.excepciones import NoEncontradoError
from ._comun import LIMITE_POR_DEFECTO, validar_pagina

_COLUMNAS = (
    "id, tipo, estado, origen, prestamo_id, prestamo_detalle_id, devolucion_id,"
    " articulo_id, articulo_unidad_id, estudiante_id, responsabilidad, cantidad,"
    " descripcion, resolucion, resuelto_en, creado_en"
)


def _a_entidad(fila: sqlite3.Row) -> Incidente:
    return Incidente(
        id=fila["id"],
        tipo=TipoIncidente(fila["tipo"]),
        estado=EstadoIncidente(fila["estado"]),
        origen=OrigenIncidente(fila["origen"]),
        prestamo_id=fila["prestamo_id"],
        prestamo_detalle_id=fila["prestamo_detalle_id"],
        devolucion_id=fila["devolucion_id"],
        articulo_id=fila["articulo_id"],
        articulo_unidad_id=fila["articulo_unidad_id"],
        estudiante_id=fila["estudiante_id"],
        responsabilidad=ResponsabilidadIncidente(fila["responsabilidad"]),
        cantidad=fila["cantidad"],
        descripcion=fila["descripcion"],
        resolucion=fila["resolucion"],
        resuelto_en=fila["resuelto_en"],
        creado_en=fila["creado_en"],
    )


class IncidenteRepo:
    """Acceso a ``incidente``. No expone ``DELETE`` (RN-42, RN-46)."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def crear(self, incidente: Incidente) -> Incidente:
        cursor = self._conn.execute(
            "INSERT INTO incidente (tipo, estado, origen, prestamo_id,"
            " prestamo_detalle_id, devolucion_id, articulo_id, articulo_unidad_id,"
            " estudiante_id, responsabilidad, cantidad, descripcion, resolucion,"
            " resuelto_en, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                incidente.tipo.value,
                incidente.estado.value,
                incidente.origen.value,
                incidente.prestamo_id,
                incidente.prestamo_detalle_id,
                incidente.devolucion_id,
                incidente.articulo_id,
                incidente.articulo_unidad_id,
                incidente.estudiante_id,
                incidente.responsabilidad.value,
                incidente.cantidad,
                incidente.descripcion,
                incidente.resolucion,
                incidente.resuelto_en,
                incidente.creado_en,
            ),
        )
        return replace(incidente, id=cursor.lastrowid)

    def obtener_por_id(self, incidente_id: int) -> Incidente | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM incidente WHERE id = ?", (incidente_id,)
        ).fetchone()
        return _a_entidad(fila) if fila is not None else None

    def listar(
        self,
        *,
        estado: EstadoIncidente | None = None,
        tipo: TipoIncidente | None = None,
        origen: OrigenIncidente | None = None,
        articulo_id: int | None = None,
        estudiante_id: int | None = None,
        desde: str | None = None,
        hasta: str | None = None,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[Incidente]:
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        condiciones: list[str] = []
        parametros: list[object] = []
        if estado is not None:
            condiciones.append("estado = ?")
            parametros.append(estado.value)
        if tipo is not None:
            condiciones.append("tipo = ?")
            parametros.append(tipo.value)
        if origen is not None:
            condiciones.append("origen = ?")
            parametros.append(origen.value)
        if articulo_id is not None:
            condiciones.append("articulo_id = ?")
            parametros.append(articulo_id)
        if estudiante_id is not None:
            condiciones.append("estudiante_id = ?")
            parametros.append(estudiante_id)
        if desde is not None:
            condiciones.append("creado_en >= ?")
            parametros.append(desde)
        if hasta is not None:
            condiciones.append("creado_en < ?")
            parametros.append(hasta)
        sql = f"SELECT {_COLUMNAS} FROM incidente"
        if condiciones:
            sql += " WHERE " + " AND ".join(condiciones)
        sql += " ORDER BY creado_en DESC, id DESC LIMIT ? OFFSET ?"
        parametros += [limite, desplazamiento]
        return [_a_entidad(fila) for fila in self._conn.execute(sql, parametros)]

    def listar_pendientes(
        self,
        *,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[Incidente]:
        return self.listar(
            estado=EstadoIncidente.ABIERTO, limite=limite, desplazamiento=desplazamiento
        )

    def listar_por_articulo(
        self,
        articulo_id: int,
        *,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[Incidente]:
        return self.listar(
            articulo_id=articulo_id, limite=limite, desplazamiento=desplazamiento
        )

    def listar_por_prestamo(self, prestamo_id: int) -> list[Incidente]:
        filas = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM incidente WHERE prestamo_id = ?"
            " ORDER BY creado_en, id",
            (prestamo_id,),
        )
        return [_a_entidad(fila) for fila in filas]

    def contar(
        self,
        *,
        estado: EstadoIncidente | None = None,
        tipo: TipoIncidente | None = None,
        origen: OrigenIncidente | None = None,
    ) -> int:
        condiciones: list[str] = []
        parametros: list[object] = []
        if estado is not None:
            condiciones.append("estado = ?")
            parametros.append(estado.value)
        if tipo is not None:
            condiciones.append("tipo = ?")
            parametros.append(tipo.value)
        if origen is not None:
            condiciones.append("origen = ?")
            parametros.append(origen.value)
        sql = "SELECT COUNT(*) FROM incidente"
        if condiciones:
            sql += " WHERE " + " AND ".join(condiciones)
        return int(self._conn.execute(sql, parametros).fetchone()[0])

    def actualizar(self, incidente: Incidente) -> None:
        """Resuelve o reasigna responsabilidad; nunca elimina (RN-42, RN-43)."""
        if incidente.id is None:
            raise ValueError("No se puede actualizar un incidente sin id")
        cursor = self._conn.execute(
            "UPDATE incidente SET estado = ?, responsabilidad = ?, estudiante_id = ?,"
            " descripcion = ?, resolucion = ?, resuelto_en = ? WHERE id = ?",
            (
                incidente.estado.value,
                incidente.responsabilidad.value,
                incidente.estudiante_id,
                incidente.descripcion,
                incidente.resolucion,
                incidente.resuelto_en,
                incidente.id,
            ),
        )
        if cursor.rowcount == 0:
            raise NoEncontradoError(f"No existe el incidente {incidente.id}")
