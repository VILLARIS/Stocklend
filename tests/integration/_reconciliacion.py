"""Consultas de reconciliación de DATABASE_DESIGN §8.6 y §8.7.

Ambas deben devolver **cero filas**. Se ejecutan después de cada prueba que mueve
inventario para comprobar RN-49 y RN-61 contra el libro de movimientos.
"""

from __future__ import annotations

import sqlite3

_SQL_CONTADORES = """
WITH libro AS (
    SELECT
        articulo_id,
        SUM(CASE WHEN tipo IN ('alta','ajuste_positivo') THEN cantidad ELSE 0 END) AS E,
        SUM(CASE WHEN tipo = 'ajuste_negativo'           THEN cantidad ELSE 0 END) AS A,
        SUM(CASE WHEN tipo = 'prestamo'                  THEN cantidad ELSE 0 END) AS P,
        SUM(CASE WHEN tipo = 'devolucion'                THEN cantidad ELSE 0 END) AS D,
        SUM(CASE WHEN tipo = 'reingreso_reparacion'      THEN cantidad ELSE 0 END) AS R,
        SUM(CASE WHEN tipo = 'danio_prestado'            THEN cantidad ELSE 0 END) AS DP,
        SUM(CASE WHEN tipo = 'perdida_prestado'          THEN cantidad ELSE 0 END) AS PP,
        SUM(CASE WHEN tipo = 'danio_disponible'          THEN cantidad ELSE 0 END) AS DD,
        SUM(CASE WHEN tipo = 'perdida_disponible'        THEN cantidad ELSE 0 END) AS PD,
        SUM(CASE WHEN tipo = 'baja_daniada'              THEN cantidad ELSE 0 END) AS BD,
        SUM(CASE WHEN tipo = 'baja_faltante'             THEN cantidad ELSE 0 END) AS BF
    FROM movimiento_inventario
    GROUP BY articulo_id
),
esperado AS (
    SELECT
        a.id,
        COALESCE(l.E,0) - COALESCE(l.A,0) - COALESCE(l.BD,0) - COALESCE(l.BF,0) AS total,
        COALESCE(l.E,0) - COALESCE(l.A,0) - COALESCE(l.P,0) + COALESCE(l.D,0)
            + COALESCE(l.R,0) - COALESCE(l.DD,0) - COALESCE(l.PD,0)              AS disponible,
        COALESCE(l.P,0) - COALESCE(l.D,0) - COALESCE(l.DP,0) - COALESCE(l.PP,0) AS prestada,
        COALESCE(l.DP,0) + COALESCE(l.DD,0) - COALESCE(l.R,0) - COALESCE(l.BD,0) AS danada,
        COALESCE(l.PP,0) + COALESCE(l.PD,0) - COALESCE(l.BF,0)                  AS faltante
    FROM articulo a
    LEFT JOIN libro l ON l.articulo_id = a.id
)
SELECT a.id, a.nombre
FROM articulo a
JOIN esperado e ON e.id = a.id
WHERE a.cantidad_total      <> e.total
   OR a.cantidad_disponible <> e.disponible
   OR a.cantidad_prestada   <> e.prestada
   OR a.cantidad_daniada    <> e.danada
   OR a.cantidad_faltante   <> e.faltante
"""

_SQL_UNIDADES = """
SELECT a.id, a.nombre
FROM articulo a
LEFT JOIN (
    SELECT
        articulo_id,
        SUM(CASE WHEN estado <> 'baja'      THEN 1 ELSE 0 END) AS total,
        SUM(CASE WHEN estado = 'disponible' THEN 1 ELSE 0 END) AS disponible,
        SUM(CASE WHEN estado = 'prestada'   THEN 1 ELSE 0 END) AS prestada,
        SUM(CASE WHEN estado = 'danada'     THEN 1 ELSE 0 END) AS danada,
        SUM(CASE WHEN estado = 'faltante'   THEN 1 ELSE 0 END) AS faltante
    FROM articulo_unidad
    GROUP BY articulo_id
) u ON u.articulo_id = a.id
WHERE a.control_individual = 1
  AND (a.cantidad_total      <> COALESCE(u.total, 0)
   OR a.cantidad_disponible <> COALESCE(u.disponible, 0)
   OR a.cantidad_prestada   <> COALESCE(u.prestada, 0)
   OR a.cantidad_daniada    <> COALESCE(u.danada, 0)
   OR a.cantidad_faltante   <> COALESCE(u.faltante, 0))
"""


def discrepancias_contadores(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return list(conn.execute(_SQL_CONTADORES))


def discrepancias_unidades(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return list(conn.execute(_SQL_UNIDADES))
