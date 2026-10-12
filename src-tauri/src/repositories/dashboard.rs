//! Consultas del Panel (Etapa B). Solo lectura.

use crate::models::dashboard::{DiaActividad, PrestamoReciente};

/// Conteos base del inventario calculados en una sola consulta.
pub struct ConteosInventario {
    pub articulos_activos: i64,
    pub unidades_totales: i64,
    pub unidades_disponibles: i64,
    pub unidades_prestadas: i64,
    pub unidades_daniadas: i64,
    pub unidades_faltantes: i64,
}

/// Calcula las estadísticas generales del inventario.
///
/// `COALESCE` garantiza cero en tablas vacías. El conteo de artículos activos
/// suma 1 solo cuando `activo = 1`; los acumuladores de unidades consideran
/// todas las filas, tal como se especificó.
pub fn conteos_inventario(conn: &rusqlite::Connection) -> rusqlite::Result<ConteosInventario> {
    conn.query_row(
        "SELECT \
             COALESCE(SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END), 0), \
             COALESCE(SUM(cantidad_total), 0), \
             COALESCE(SUM(cantidad_disponible), 0), \
             COALESCE(SUM(cantidad_prestada), 0), \
             COALESCE(SUM(cantidad_daniada), 0), \
             COALESCE(SUM(cantidad_faltante), 0) \
         FROM articulo",
        [],
        |row| {
            Ok(ConteosInventario {
                articulos_activos: row.get(0)?,
                unidades_totales: row.get(1)?,
                unidades_disponibles: row.get(2)?,
                unidades_prestadas: row.get(3)?,
                unidades_daniadas: row.get(4)?,
                unidades_faltantes: row.get(5)?,
            })
        },
    )
}

/// Actividad de los últimos siete días naturales (incluyendo hoy).
///
/// Se genera la ventana con una CTE recursiva para devolver siempre siete
/// filas ordenadas, rellenando con cero los días sin préstamos. Se excluyen
/// los préstamos con estado `anulado`.
pub fn actividad_semanal(conn: &rusqlite::Connection) -> rusqlite::Result<Vec<DiaActividad>> {
    let mut stmt = conn.prepare(
        "WITH RECURSIVE dias(fecha) AS ( \
             SELECT date('now', 'localtime', '-6 days') \
             UNION ALL \
             SELECT date(fecha, '+1 day') FROM dias WHERE fecha < date('now', 'localtime') \
         ) \
         SELECT d.fecha, CAST(strftime('%w', d.fecha) AS INTEGER), COALESCE(c.total, 0) \
         FROM dias d \
         LEFT JOIN ( \
             SELECT date(fecha_prestamo) AS fecha, COUNT(*) AS total \
             FROM prestamo \
             WHERE estado <> 'anulado' \
               AND date(fecha_prestamo) >= date('now', 'localtime', '-6 days') \
             GROUP BY date(fecha_prestamo) \
         ) c ON c.fecha = d.fecha \
         ORDER BY d.fecha",
    )?;
    let rows = stmt.query_map([], |row| {
        let dia_semana: i64 = row.get(1)?;
        Ok(DiaActividad {
            fecha: row.get(0)?,
            etiqueta: etiqueta_dia(dia_semana).to_string(),
            prestamos: row.get(2)?,
        })
    })?;
    rows.collect()
}

/// Préstamos más recientes para el panel (por fecha descendente e id).
///
/// Incluye el nombre completo del estudiante y la cantidad de renglones.
pub fn prestamos_recientes(
    conn: &rusqlite::Connection,
    limite: i64,
) -> rusqlite::Result<Vec<PrestamoReciente>> {
    let mut stmt = conn.prepare(
        "SELECT p.id, \
                p.folio, \
                TRIM(COALESCE(e.nombres, '') || ' ' || COALESCE(e.apellidos, '')), \
                date(p.fecha_prestamo), \
                p.estado, \
                COUNT(d.id) \
         FROM prestamo p \
         JOIN estudiante e ON e.id = p.estudiante_id \
         LEFT JOIN prestamo_detalle d ON d.prestamo_id = p.id \
         GROUP BY p.id, p.folio, e.nombres, e.apellidos, p.fecha_prestamo, p.estado \
         ORDER BY p.fecha_prestamo DESC, p.id DESC \
         LIMIT ?1",
    )?;
    let rows = stmt.query_map([limite], |row| {
        Ok(PrestamoReciente {
            id: row.get(0)?,
            folio: row.get(1)?,
            estudiante: row.get(2)?,
            fecha: row.get(3)?,
            estado: row.get(4)?,
            articulos: row.get(5)?,
        })
    })?;
    rows.collect()
}

/// Etiqueta corta en español para el día de la semana (`strftime('%w')`).
fn etiqueta_dia(dia_semana: i64) -> &'static str {
    match dia_semana {
        0 => "Dom",
        1 => "Lun",
        2 => "Mar",
        3 => "Mié",
        4 => "Jue",
        5 => "Vie",
        6 => "Sáb",
        _ => "—",
    }
}
