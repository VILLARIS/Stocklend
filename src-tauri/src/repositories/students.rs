//! Consultas de Estudiantes (Etapa B). Solo lectura.
//!
//! No se inventan relaciones: cada `JOIN` y subconsulta corresponde a una llave
//! foránea real del esquema (`DATABASE_DESIGN.md` §6). Los recuentos del
//! directorio y las estadísticas se derivan de `prestamo`, `prestamo_detalle`
//! (a través de `v_prestamo_detalle`) e `incidente`; nunca se escriben a mano.

use rusqlite::{Connection, OptionalExtension};

use crate::models::students::{
    EstadisticasEstudiantes, EstudianteDirectorio, IncidenciaEstudiante, PrestamoEstudiante,
};

/// Columnas comunes de `listar_estudiantes` y `leer_estudiante`.
const SQL_ESTUDIANTE: &str = "SELECT e.id, e.codigo_universitario, e.nombres, e.apellidos, e.activo, \
          date(e.creado_en), \
          (SELECT COUNT(*) FROM prestamo p \
            WHERE p.estudiante_id = e.id AND p.estado = 'activo'), \
          (SELECT COUNT(*) FROM prestamo p \
            WHERE p.estudiante_id = e.id AND p.estado = 'cerrado'), \
          (SELECT COALESCE(SUM(v.cantidad_pendiente), 0) \
             FROM v_prestamo_detalle v \
             JOIN prestamo p ON p.id = v.prestamo_id \
            WHERE p.estudiante_id = e.id AND p.estado = 'activo'), \
          (SELECT COUNT(*) FROM incidente i WHERE i.estudiante_id = e.id) \
   FROM estudiante e";

/// Mapea una fila de [`SQL_ESTUDIANTE`] a un estudiante del directorio.
fn fila_estudiante(row: &rusqlite::Row<'_>) -> rusqlite::Result<EstudianteDirectorio> {
    let nombres: String = row.get(2)?;
    let apellidos: String = row.get(3)?;
    Ok(EstudianteDirectorio {
        id: row.get(0)?,
        codigo_universitario: row.get(1)?,
        nombre_completo: format!("{nombres} {apellidos}"),
        nombres,
        apellidos,
        activo: row.get::<_, i64>(4)? != 0,
        creado_en: row.get(5)?,
        prestamos_activos: row.get(6)?,
        prestamos_finalizados: row.get(7)?,
        unidades_activas: row.get(8)?,
        incidencias: row.get(9)?,
    })
}

/// Todos los estudiantes con sus recuentos derivados, ordenados por apellidos.
///
/// Incluye activos e inactivos. `unidades_activas` suma la cantidad pendiente
/// real de los préstamos `activo` (a través de `v_prestamo_detalle`), no el
/// total prestado, para reflejar cuántas unidades siguen fuera.
pub fn listar_estudiantes(conn: &Connection) -> rusqlite::Result<Vec<EstudianteDirectorio>> {
    let sql = format!(
        "{SQL_ESTUDIANTE} \
         ORDER BY e.apellidos COLLATE NOCASE, e.nombres COLLATE NOCASE, e.id"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], fila_estudiante)?;
    rows.collect()
}

/// Lee un estudiante con sus recuentos, o `None` si no existe.
pub fn leer_estudiante(
    conn: &Connection,
    id: i64,
) -> rusqlite::Result<Option<EstudianteDirectorio>> {
    let sql = format!("{SQL_ESTUDIANTE} WHERE e.id = ?1");
    conn.query_row(&sql, [id], fila_estudiante).optional()
}

/// Indicadores de las tarjetas del directorio, en una sola consulta.
///
/// `COALESCE`/`COUNT(DISTINCT ...)` devuelven cero en tablas vacías y no
/// duplican estudiantes que tengan varios préstamos o incidencias.
pub fn obtener_estadisticas(conn: &Connection) -> rusqlite::Result<EstadisticasEstudiantes> {
    conn.query_row(
        "SELECT \
             (SELECT COUNT(*) FROM estudiante), \
             (SELECT COUNT(DISTINCT estudiante_id) FROM prestamo WHERE estado = 'activo'), \
             (SELECT COUNT(DISTINCT estudiante_id) FROM incidente \
               WHERE estudiante_id IS NOT NULL)",
        [],
        |row| {
            Ok(EstadisticasEstudiantes {
                registrados: row.get(0)?,
                con_prestamos_activos: row.get(1)?,
                con_incidencias: row.get(2)?,
            })
        },
    )
}

/// Indica si existe un estudiante con el identificador dado.
///
/// Permite distinguir "estudiante inexistente" (error) de "estudiante sin
/// préstamos ni incidencias" (lista vacía, que no es un error).
pub fn existe_estudiante(conn: &Connection, estudiante_id: i64) -> rusqlite::Result<bool> {
    let existe: i64 = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM estudiante WHERE id = ?1)",
        [estudiante_id],
        |row| row.get(0),
    )?;
    Ok(existe != 0)
}

/// Préstamos de un estudiante, del más reciente al más antiguo.
///
/// Cada fila resume el préstamo: `unidades` es la suma real de
/// `cantidad_prestada` y `renglones` la cantidad de artículos distintos.
pub fn historial_prestamos(
    conn: &Connection,
    estudiante_id: i64,
) -> rusqlite::Result<Vec<PrestamoEstudiante>> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.folio, date(p.fecha_prestamo), p.fecha_limite, p.estado, \
                COALESCE(SUM(pd.cantidad_prestada), 0), COUNT(pd.id) \
         FROM prestamo p \
         LEFT JOIN prestamo_detalle pd ON pd.prestamo_id = p.id \
         WHERE p.estudiante_id = ?1 \
         GROUP BY p.id, p.folio, p.fecha_prestamo, p.fecha_limite, p.estado \
         ORDER BY p.fecha_prestamo DESC, p.id DESC",
    )?;
    let rows = stmt.query_map([estudiante_id], |row| {
        Ok(PrestamoEstudiante {
            id: row.get(0)?,
            folio: row.get(1)?,
            fecha: row.get(2)?,
            fecha_limite: row.get(3)?,
            estado: row.get(4)?,
            unidades: row.get(5)?,
            renglones: row.get(6)?,
        })
    })?;
    rows.collect()
}

/// Incidencias asociadas a un estudiante por `estudiante_id`, de la más
/// reciente a la más antigua.
///
/// El nombre del artículo se toma de `articulo.nombre` mediante la llave foránea
/// real; no se deduce a partir del nombre del estudiante.
pub fn incidencias_estudiante(
    conn: &Connection,
    estudiante_id: i64,
) -> rusqlite::Result<Vec<IncidenciaEstudiante>> {
    let mut stmt = conn.prepare(
        "SELECT i.id, i.tipo, i.estado, date(i.creado_en), a.nombre, i.cantidad, \
                i.descripcion, i.responsabilidad, p.folio \
         FROM incidente i \
         JOIN articulo a ON a.id = i.articulo_id \
         LEFT JOIN prestamo p ON p.id = i.prestamo_id \
         WHERE i.estudiante_id = ?1 \
         ORDER BY i.creado_en DESC, i.id DESC",
    )?;
    let rows = stmt.query_map([estudiante_id], |row| {
        Ok(IncidenciaEstudiante {
            id: row.get(0)?,
            tipo: row.get(1)?,
            estado: row.get(2)?,
            fecha: row.get(3)?,
            articulo: row.get(4)?,
            cantidad: row.get(5)?,
            descripcion: row.get(6)?,
            responsabilidad: row.get(7)?,
            folio: row.get(8)?,
        })
    })?;
    rows.collect()
}

// ---------------------------------------------------------------------------
// Escrituras de estudiante
// ---------------------------------------------------------------------------

/// Inserta un estudiante activo y devuelve su identificador.
pub fn insertar_estudiante(
    conn: &Connection,
    codigo_universitario: &str,
    nombres: &str,
    apellidos: &str,
) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO estudiante \
         (codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en) \
         VALUES (?1, ?2, ?3, 1, \
                 strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), \
                 strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))",
        rusqlite::params![codigo_universitario, nombres, apellidos],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Actualiza código, nombres y apellidos. No toca `activo` ni el historial.
/// Devuelve las filas afectadas (0 si no existe).
pub fn actualizar_estudiante(
    conn: &Connection,
    id: i64,
    codigo_universitario: &str,
    nombres: &str,
    apellidos: &str,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE estudiante \
         SET codigo_universitario = ?1, nombres = ?2, apellidos = ?3, \
             actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') \
         WHERE id = ?4",
        rusqlite::params![codigo_universitario, nombres, apellidos, id],
    )
}

/// Activa (`true`) o desactiva (`false`) un estudiante. Nunca lo borra.
/// Devuelve las filas afectadas (0 si no existe).
pub fn cambiar_activo_estudiante(
    conn: &Connection,
    id: i64,
    activo: bool,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE estudiante \
         SET activo = ?1, \
             actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') \
         WHERE id = ?2",
        rusqlite::params![activo as i64, id],
    )
}

/// Indica si otro estudiante usa ya ese código universitario (RN-11).
///
/// La columna es `COLLATE NOCASE`, así que la comparación ignora mayúsculas.
/// `excluir` permite editar sin que el propio registro cuente como duplicado.
pub fn codigo_existe(
    conn: &Connection,
    codigo_universitario: &str,
    excluir: Option<i64>,
) -> rusqlite::Result<bool> {
    let existe: i64 = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM estudiante \
         WHERE codigo_universitario = ?1 AND (?2 IS NULL OR id <> ?2))",
        rusqlite::params![codigo_universitario, excluir],
        |row| row.get(0),
    )?;
    Ok(existe != 0)
}

/// Indica si el estudiante tiene al menos un préstamo en estado `activo`.
pub fn tiene_prestamos_activos(conn: &Connection, id: i64) -> rusqlite::Result<bool> {
    let existe: i64 = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM prestamo \
         WHERE estudiante_id = ?1 AND estado = 'activo')",
        [id],
        |row| row.get(0),
    )?;
    Ok(existe != 0)
}
