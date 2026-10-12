//! Comando de diagnóstico de la base de datos (Etapa A).
//!
//! Solo lectura. No expone rutas configurables desde el frontend ni ejecuta
//! SQL recibido como parámetro: el único SQL vive en el backend.

use std::collections::HashSet;

use serde::Serialize;
use tauri::AppHandle;

use crate::core::paths::{self, DataDirOrigin};
use crate::db::connection;

/// Tablas que debe tener una base inicializada (`DATABASE_DESIGN.md` §6).
pub const EXPECTED_TABLES: [&str; 11] = [
    "categoria",
    "articulo",
    "articulo_unidad",
    "estudiante",
    "prestamo",
    "prestamo_detalle",
    "devolucion",
    "devolucion_detalle",
    "incidente",
    "movimiento_inventario",
    "configuracion",
];

/// Estado de la base de datos observado en el diagnóstico.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseStatus {
    /// El archivo existe y el esquema está inicializado (puede tener o no filas).
    Ok,
    /// El archivo de base de datos no existe. No se creó ninguno.
    Missing,
    /// El archivo existe pero el esquema no está inicializado.
    SchemaNotInitialized,
}

/// Resultado del diagnóstico. Se devuelve al frontend como JSON.
#[derive(Debug, Serialize)]
pub struct Diagnostics {
    pub estado: DatabaseStatus,
    pub ruta: String,
    pub origen: DataDirOrigin,
    pub existe_archivo: bool,
    pub solo_lectura: bool,
    pub version_esquema: Option<i64>,
    pub total_tablas: usize,
    pub tablas_faltantes: Vec<String>,
    /// `Some(true/false)` solo cuando `articulo` existe: distingue la base
    /// válida **sin registros** de una con datos. `None` si no es aplicable.
    pub tiene_registros_articulo: Option<bool>,
    pub mensaje: String,
}

/// Diagnostica el acceso a la base de datos local (solo lectura).
#[tauri::command]
pub fn diagnosticar_bd<R: tauri::Runtime>(app: AppHandle<R>) -> Result<Diagnostics, String> {
    let location = paths::resolve_db_location(&app)?;
    let ruta = location.path.to_string_lossy().into_owned();

    if !location.path.is_file() {
        return Ok(Diagnostics {
            estado: DatabaseStatus::Missing,
            ruta,
            origen: location.origin,
            existe_archivo: false,
            solo_lectura: true,
            version_esquema: None,
            total_tablas: 0,
            tablas_faltantes: EXPECTED_TABLES
                .iter()
                .map(|t| (*t).to_string())
                .collect(),
            tiene_registros_articulo: None,
            mensaje: "No se encontró el archivo de base de datos. No se creó ninguno."
                .to_string(),
        });
    }

    let conn = connection::open_read_only(&location.path)
        .map_err(|e| format!("No se pudo abrir la base en solo lectura: {e}"))?;

    let version_esquema: i64 = conn
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap_or(0);

    let nombres = collect_table_names(&conn)
        .map_err(|e| format!("No se pudo leer el esquema: {e}"))?;

    let mut tablas_faltantes: Vec<String> = EXPECTED_TABLES
        .iter()
        .filter(|t| !nombres.contains(**t))
        .map(|t| (*t).to_string())
        .collect();
    tablas_faltantes.sort();

    let esquema_inicializado = tablas_faltantes.is_empty();

    if !esquema_inicializado {
        return Ok(Diagnostics {
            estado: DatabaseStatus::SchemaNotInitialized,
            ruta,
            origen: location.origin,
            existe_archivo: true,
            solo_lectura: true,
            version_esquema: Some(version_esquema),
            total_tablas: nombres.len(),
            tablas_faltantes,
            tiene_registros_articulo: None,
            mensaje: "El archivo existe pero el esquema no está inicializado."
                .to_string(),
        });
    }

    let tiene_registros = if nombres.contains("articulo") {
        Some(has_any_article(&conn).unwrap_or(false))
    } else {
        None
    };

    Ok(Diagnostics {
        estado: DatabaseStatus::Ok,
        ruta,
        origen: location.origin,
        existe_archivo: true,
        solo_lectura: true,
        version_esquema: Some(version_esquema),
        total_tablas: nombres.len(),
        tablas_faltantes,
        tiene_registros_articulo: tiene_registros,
        mensaje: "Base de datos accesible en solo lectura.".to_string(),
    })
}

/// Indica si la base tiene todas las tablas esperadas (`EXPECTED_TABLES`).
///
/// Compartido con otros comandos de solo lectura para no duplicar la noción de
/// "esquema inicializado".
pub fn esquema_inicializado(conn: &rusqlite::Connection) -> rusqlite::Result<bool> {
    let nombres = collect_table_names(conn)?;
    Ok(EXPECTED_TABLES.iter().all(|t| nombres.contains(*t)))
}

fn collect_table_names(conn: &rusqlite::Connection) -> rusqlite::Result<HashSet<String>> {
    let mut stmt = conn.prepare(
        "SELECT name FROM sqlite_master \
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    rows.collect()
}

fn has_any_article(conn: &rusqlite::Connection) -> rusqlite::Result<bool> {
    let exists: i64 = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM articulo LIMIT 1)",
        [],
        |row| row.get(0),
    )?;
    Ok(exists != 0)
}
