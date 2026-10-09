"""Repositorios de devoluciones y sus renglones (RN-26 a RN-38).

Las devoluciones son inmutables: no se exponen métodos de actualización ni borrado
(RN-38, RN-46).
"""

from __future__ import annotations

import sqlite3
from dataclasses import replace

from ...domain.entidades import Devolucion, DevolucionDetalle
from ._comun import LIMITE_POR_DEFECTO, validar_pagina

_COLUMNAS_DEVOLUCION = "id, prestamo_id, fecha_devolucion, observaciones, creado_en"
_COLUMNAS_DETALLE = (
    "id, devolucion_id, prestamo_detalle_id, cantidad_devuelta, cantidad_daniada,"
    " cantidad_perdida, notas"
)


def _a_devolucion(fila: sqlite3.Row) -> Devolucion:
    return Devolucion(
        id=fila["id"],
        prestamo_id=fila["prestamo_id"],
        fecha_devolucion=fila["fecha_devolucion"],
        observaciones=fila["observaciones"],
        creado_en=fila["creado_en"],
    )


def _a_detalle(fila: sqlite3.Row) -> DevolucionDetalle:
    return DevolucionDetalle(
        id=fila["id"],
        devolucion_id=fila["devolucion_id"],
        prestamo_detalle_id=fila["prestamo_detalle_id"],
        cantidad_devuelta=fila["cantidad_devuelta"],
        cantidad_daniada=fila["cantidad_daniada"],
        cantidad_perdida=fila["cantidad_perdida"],
        notas=fila["notas"],
    )


class DevolucionRepo:
    """Acceso a ``devolucion`` y ``devolucion_detalle`` (solo adición)."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def crear(self, devolucion: Devolucion) -> Devolucion:
        cursor = self._conn.execute(
            "INSERT INTO devolucion (prestamo_id, fecha_devolucion, observaciones,"
            " creado_en) VALUES (?, ?, ?, ?)",
            (
                devolucion.prestamo_id,
                devolucion.fecha_devolucion,
                devolucion.observaciones,
                devolucion.creado_en,
            ),
        )
        return replace(devolucion, id=cursor.lastrowid)

    def obtener_por_id(self, devolucion_id: int) -> Devolucion | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS_DEVOLUCION} FROM devolucion WHERE id = ?",
            (devolucion_id,),
        ).fetchone()
        return _a_devolucion(fila) if fila is not None else None

    def listar(
        self,
        *,
        desde: str | None = None,
        hasta: str | None = None,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[Devolucion]:
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        condiciones: list[str] = []
        parametros: list[object] = []
        if desde is not None:
            condiciones.append("fecha_devolucion >= ?")
            parametros.append(desde)
        if hasta is not None:
            condiciones.append("fecha_devolucion < ?")
            parametros.append(hasta)
        sql = f"SELECT {_COLUMNAS_DEVOLUCION} FROM devolucion"
        if condiciones:
            sql += " WHERE " + " AND ".join(condiciones)
        sql += " ORDER BY fecha_devolucion DESC, id DESC LIMIT ? OFFSET ?"
        parametros += [limite, desplazamiento]
        return [_a_devolucion(fila) for fila in self._conn.execute(sql, parametros)]

    def listar_por_prestamo(self, prestamo_id: int) -> list[Devolucion]:
        filas = self._conn.execute(
            f"SELECT {_COLUMNAS_DEVOLUCION} FROM devolucion WHERE prestamo_id = ?"
            " ORDER BY fecha_devolucion, id",
            (prestamo_id,),
        )
        return [_a_devolucion(fila) for fila in filas]

    def contar(self, *, prestamo_id: int | None = None) -> int:
        sql = "SELECT COUNT(*) FROM devolucion"
        parametros: list[object] = []
        if prestamo_id is not None:
            sql += " WHERE prestamo_id = ?"
            parametros.append(prestamo_id)
        return int(self._conn.execute(sql, parametros).fetchone()[0])

    # ------------------------------------------------------------- renglones

    def crear_detalle(self, detalle: DevolucionDetalle) -> DevolucionDetalle:
        cursor = self._conn.execute(
            "INSERT INTO devolucion_detalle (devolucion_id, prestamo_detalle_id,"
            " cantidad_devuelta, cantidad_daniada, cantidad_perdida, notas)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (
                detalle.devolucion_id,
                detalle.prestamo_detalle_id,
                detalle.cantidad_devuelta,
                detalle.cantidad_daniada,
                detalle.cantidad_perdida,
                detalle.notas,
            ),
        )
        return replace(detalle, id=cursor.lastrowid)

    def listar_detalles(self, devolucion_id: int) -> list[DevolucionDetalle]:
        filas = self._conn.execute(
            f"SELECT {_COLUMNAS_DETALLE} FROM devolucion_detalle"
            " WHERE devolucion_id = ? ORDER BY id",
            (devolucion_id,),
        )
        return [_a_detalle(fila) for fila in filas]

    def obtener_detalle_por_renglon(
        self, devolucion_id: int, prestamo_detalle_id: int
    ) -> DevolucionDetalle | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS_DETALLE} FROM devolucion_detalle"
            " WHERE devolucion_id = ? AND prestamo_detalle_id = ?",
            (devolucion_id, prestamo_detalle_id),
        ).fetchone()
        return _a_detalle(fila) if fila is not None else None
