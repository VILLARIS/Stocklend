"""Repositorios de préstamos y sus renglones (RN-16 a RN-25, RN-35, RN-36)."""

from __future__ import annotations

import sqlite3
from dataclasses import replace

from ...domain.entidades import Prestamo, PrestamoDetalle
from ...domain.enums import EstadoDetalle, EstadoPrestamo
from ...domain.excepciones import NoEncontradoError
from ._comun import LIMITE_POR_DEFECTO, validar_pagina

_COLUMNAS_PRESTAMO = (
    "id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado,"
    " comentario, creado_en, cerrado_en"
)
_COLUMNAS_PRESTAMO_P = (
    "p.id, p.folio, p.estudiante_id, p.fecha_prestamo, p.fecha_limite, p.estado,"
    " p.comentario, p.creado_en, p.cerrado_en"
)
_COLUMNAS_DETALLE = (
    "id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta,"
    " cantidad_daniada, cantidad_perdida, estado, notas"
)


def _a_prestamo(fila: sqlite3.Row) -> Prestamo:
    return Prestamo(
        id=fila["id"],
        folio=fila["folio"],
        estudiante_id=fila["estudiante_id"],
        fecha_prestamo=fila["fecha_prestamo"],
        fecha_limite=fila["fecha_limite"],
        estado=EstadoPrestamo(fila["estado"]),
        comentario=fila["comentario"],
        creado_en=fila["creado_en"],
        cerrado_en=fila["cerrado_en"],
    )


def _a_detalle(fila: sqlite3.Row, *, con_pendiente: bool = False) -> PrestamoDetalle:
    return PrestamoDetalle(
        id=fila["id"],
        prestamo_id=fila["prestamo_id"],
        articulo_id=fila["articulo_id"],
        cantidad_prestada=fila["cantidad_prestada"],
        cantidad_devuelta=fila["cantidad_devuelta"],
        cantidad_daniada=fila["cantidad_daniada"],
        cantidad_perdida=fila["cantidad_perdida"],
        estado=EstadoDetalle(fila["estado"]),
        notas=fila["notas"],
        cantidad_pendiente=fila["cantidad_pendiente"] if con_pendiente else None,
    )


class PrestamoRepo:
    """Acceso a ``prestamo`` y ``prestamo_detalle`` (agregado del préstamo)."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def crear(self, prestamo: Prestamo) -> Prestamo:
        cursor = self._conn.execute(
            "INSERT INTO prestamo (folio, estudiante_id, fecha_prestamo, fecha_limite,"
            " estado, comentario, creado_en, cerrado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                prestamo.folio,
                prestamo.estudiante_id,
                prestamo.fecha_prestamo,
                prestamo.fecha_limite,
                prestamo.estado.value,
                prestamo.comentario,
                prestamo.creado_en,
                prestamo.cerrado_en,
            ),
        )
        return replace(prestamo, id=cursor.lastrowid)

    def obtener_por_id(self, prestamo_id: int) -> Prestamo | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS_PRESTAMO} FROM prestamo WHERE id = ?", (prestamo_id,)
        ).fetchone()
        return _a_prestamo(fila) if fila is not None else None

    def obtener_por_folio(self, folio: str) -> Prestamo | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS_PRESTAMO} FROM prestamo WHERE folio = ?", (folio,)
        ).fetchone()
        return _a_prestamo(fila) if fila is not None else None

    def listar(
        self,
        *,
        estado: EstadoPrestamo | None = None,
        estudiante_id: int | None = None,
        desde: str | None = None,
        hasta: str | None = None,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[Prestamo]:
        """Listado con filtros combinables (DATABASE_DESIGN §8.3, ``hasta`` exclusivo)."""
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        condiciones: list[str] = []
        parametros: list[object] = []
        if estado is not None:
            condiciones.append("estado = ?")
            parametros.append(estado.value)
        if estudiante_id is not None:
            condiciones.append("estudiante_id = ?")
            parametros.append(estudiante_id)
        if desde is not None:
            condiciones.append("fecha_prestamo >= ?")
            parametros.append(desde)
        if hasta is not None:
            condiciones.append("fecha_prestamo < ?")
            parametros.append(hasta)
        sql = f"SELECT {_COLUMNAS_PRESTAMO} FROM prestamo"
        if condiciones:
            sql += " WHERE " + " AND ".join(condiciones)
        sql += " ORDER BY fecha_prestamo DESC, id DESC LIMIT ? OFFSET ?"
        parametros += [limite, desplazamiento]
        return [_a_prestamo(fila) for fila in self._conn.execute(sql, parametros)]

    def listar_por_estudiante(
        self,
        estudiante_id: int,
        *,
        estado: EstadoPrestamo | None = None,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[Prestamo]:
        return self.listar(
            estado=estado,
            estudiante_id=estudiante_id,
            limite=limite,
            desplazamiento=desplazamiento,
        )

    def listar_activos_pendientes(
        self,
        *,
        estudiante_id: int | None = None,
        limite: int = LIMITE_POR_DEFECTO,
        desplazamiento: int = 0,
    ) -> list[Prestamo]:
        """Préstamos activos con cantidad pendiente (DATABASE_DESIGN §8.2, vista)."""
        limite, desplazamiento = validar_pagina(limite, desplazamiento)
        sql = (
            f"SELECT {_COLUMNAS_PRESTAMO_P} FROM prestamo p"
            " JOIN v_prestamo_resumen v ON v.id = p.id"
            " WHERE p.estado = 'activo' AND v.total_pendiente > 0"
        )
        parametros: list[object] = []
        if estudiante_id is not None:
            sql += " AND p.estudiante_id = ?"
            parametros.append(estudiante_id)
        sql += " ORDER BY p.fecha_prestamo DESC, p.id DESC LIMIT ? OFFSET ?"
        parametros += [limite, desplazamiento]
        return [_a_prestamo(fila) for fila in self._conn.execute(sql, parametros)]

    def contar(
        self,
        *,
        estado: EstadoPrestamo | None = None,
        estudiante_id: int | None = None,
    ) -> int:
        condiciones: list[str] = []
        parametros: list[object] = []
        if estado is not None:
            condiciones.append("estado = ?")
            parametros.append(estado.value)
        if estudiante_id is not None:
            condiciones.append("estudiante_id = ?")
            parametros.append(estudiante_id)
        sql = "SELECT COUNT(*) FROM prestamo"
        if condiciones:
            sql += " WHERE " + " AND ".join(condiciones)
        return int(self._conn.execute(sql, parametros).fetchone()[0])

    def actualizar_estado(self, prestamo: Prestamo) -> None:
        if prestamo.id is None:
            raise ValueError("No se puede actualizar un préstamo sin id")
        cursor = self._conn.execute(
            "UPDATE prestamo SET estado = ?, cerrado_en = ? WHERE id = ?",
            (prestamo.estado.value, prestamo.cerrado_en, prestamo.id),
        )
        if cursor.rowcount == 0:
            raise NoEncontradoError(f"No existe el préstamo {prestamo.id}")

    # ------------------------------------------------------------- renglones

    def crear_detalle(self, detalle: PrestamoDetalle) -> PrestamoDetalle:
        cursor = self._conn.execute(
            "INSERT INTO prestamo_detalle (prestamo_id, articulo_id,"
            " cantidad_prestada, cantidad_devuelta, cantidad_daniada,"
            " cantidad_perdida, estado, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                detalle.prestamo_id,
                detalle.articulo_id,
                detalle.cantidad_prestada,
                detalle.cantidad_devuelta,
                detalle.cantidad_daniada,
                detalle.cantidad_perdida,
                detalle.estado.value,
                detalle.notas,
            ),
        )
        return replace(detalle, id=cursor.lastrowid)

    def obtener_detalle(self, detalle_id: int) -> PrestamoDetalle | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS_DETALLE} FROM prestamo_detalle WHERE id = ?",
            (detalle_id,),
        ).fetchone()
        return _a_detalle(fila) if fila is not None else None

    def obtener_detalle_por_articulo(
        self, prestamo_id: int, articulo_id: int
    ) -> PrestamoDetalle | None:
        fila = self._conn.execute(
            f"SELECT {_COLUMNAS_DETALLE} FROM prestamo_detalle"
            " WHERE prestamo_id = ? AND articulo_id = ?",
            (prestamo_id, articulo_id),
        ).fetchone()
        return _a_detalle(fila) if fila is not None else None

    def listar_detalles(self, prestamo_id: int) -> list[PrestamoDetalle]:
        filas = self._conn.execute(
            f"SELECT {_COLUMNAS_DETALLE} FROM prestamo_detalle WHERE prestamo_id = ?"
            " ORDER BY id",
            (prestamo_id,),
        )
        return [_a_detalle(fila) for fila in filas]

    def listar_detalles_con_pendiente(self, prestamo_id: int) -> list[PrestamoDetalle]:
        """Renglones con ``cantidad_pendiente`` desde ``v_prestamo_detalle`` (§6.1)."""
        filas = self._conn.execute(
            f"SELECT {_COLUMNAS_DETALLE}, cantidad_pendiente FROM v_prestamo_detalle"
            " WHERE prestamo_id = ? ORDER BY id",
            (prestamo_id,),
        )
        return [_a_detalle(fila, con_pendiente=True) for fila in filas]

    def actualizar_detalle(self, detalle: PrestamoDetalle) -> None:
        """Escribe cantidad y estado juntos: el ``CHECK`` de coherencia lo exige."""
        if detalle.id is None:
            raise ValueError("No se puede actualizar un renglón sin id")
        cursor = self._conn.execute(
            "UPDATE prestamo_detalle SET cantidad_devuelta = ?, cantidad_daniada = ?,"
            " cantidad_perdida = ?, estado = ?, notas = ? WHERE id = ?",
            (
                detalle.cantidad_devuelta,
                detalle.cantidad_daniada,
                detalle.cantidad_perdida,
                detalle.estado.value,
                detalle.notas,
                detalle.id,
            ),
        )
        if cursor.rowcount == 0:
            raise NoEncontradoError(f"No existe el renglón {detalle.id}")
