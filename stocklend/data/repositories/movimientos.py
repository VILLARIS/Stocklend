"""Repositorio del libro de movimientos (RN-05, RN-46, RN-47).

``movimiento_inventario`` es una tabla de solo adición: no se expone actualización
ni borrado.
"""

from __future__ import annotations

import sqlite3
from dataclasses import replace

from ...domain.entidades import MovimientoInventario
from ...domain.enums import TipoMovimiento
from ._comun import LIMITE_POR_DEFECTO, validar_pagina

_COLUMNAS = (
    "id, articulo_id, articulo_unidad_id, tipo, cantidad,"
    " cantidad_resultante_total, cantidad_resultante_disponible, motivo,"
    " referencia_tipo, referencia_id, fecha"
)


def _a_entidad(fila: sqlite3.Row) -> MovimientoInventario:
    return MovimientoInventario(
        id=fila["id"],
        articulo_id=fila["articulo_id"],
        articulo_unidad_id=fila["articulo_unidad_id"],
        tipo=TipoMovimiento(fila["tipo"]),
        cantidad=fila["cantidad"],
        cantidad_resultante_total=fila["cantidad_resultante_total"],
        cantidad_resultante_disponible=fila["cantidad_resultante_disponible"],
        motivo=fila["motivo"],
        referencia_tipo=fila["referencia_tipo"],
        referencia_id=fila["referencia_id"],
        fecha=fila["fecha"],
    )


class MovimientoRepo:
    """Acceso a ``movimiento_inventario`` (solo inserción y lectura)."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def crear(self, movimiento: MovimientoInventario) -> MovimientoInventario:
        cursor = self._conn.execute(
            "INSERT INTO movimiento_inventario (articulo_id, articulo_unidad_id, tipo,"
            " cantidad, cantidad_resultante_total, cantidad_resultante_disponible,"
            " motivo, referencia_tipo, referencia_id, fecha)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                movimiento.articulo_id,
                movimiento.articulo_unidad_id,
                movimiento.tipo.value,
                movimiento.cantidad,
                movimiento.cantidad_resultante_total,
                movimiento.cantidad_resultante_disponible,
                movimiento.motivo,
                movimiento.referencia_tipo,
                movimiento.referencia_id,
                movimiento.fecha,
            ),
        )
        return replace(movimiento, id=cursor.lastrowid)

    def obtener_por_id(self, movimiento_id: int) -> MovimientoInventario | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM movimiento_inventario WHERE id = ?",
            (movimiento_id,),
        ).fetchone()
        return _a_entidad(fila) if fila is not None else None

    def listar_por_articulo(
        self,
        articulo_id: int,
        *,
        desde: str | None = None,
        hasta: str | None = None,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[MovimientoInventario]:
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        sql = f"SELECT {_COLUMNAS} FROM movimiento_inventario WHERE articulo_id = ?"
        parametros: list[object] = [articulo_id]
        if desde is not None:
            sql += " AND fecha >= ?"
            parametros.append(desde)
        if hasta is not None:
            sql += " AND fecha < ?"
            parametros.append(hasta)
        sql += " ORDER BY fecha DESC, id DESC LIMIT ? OFFSET ?"
        parametros += [limite, desplazamiento]
        return [_a_entidad(fila) for fila in self._conn.execute(sql, parametros)]

    def listar_por_referencia(
        self,
        referencia_tipo: str,
        referencia_id: int,
        *,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[MovimientoInventario]:
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        filas = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM movimiento_inventario"
            " WHERE referencia_tipo = ? AND referencia_id = ?"
            " ORDER BY fecha, id LIMIT ? OFFSET ?",
            (referencia_tipo, referencia_id, limite, desplazamiento),
        )
        return [_a_entidad(fila) for fila in filas]

    def listar_por_unidad(
        self,
        articulo_unidad_id: int,
        *,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[MovimientoInventario]:
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        filas = self._conn.execute(
            f"SELECT {_COLUMNAS} FROM movimiento_inventario"
            " WHERE articulo_unidad_id = ? ORDER BY fecha, id LIMIT ? OFFSET ?",
            (articulo_unidad_id, limite, desplazamiento),
        )
        return [_a_entidad(fila) for fila in filas]

    def contar_por_articulo(self, articulo_id: int) -> int:
        return int(
            self._conn.execute(
                "SELECT COUNT(*) FROM movimiento_inventario WHERE articulo_id = ?",
                (articulo_id,),
            ).fetchone()[0]
        )
