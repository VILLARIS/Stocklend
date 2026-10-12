//! Comando del Panel (Etapa B).
//!
//! Solo lectura. Devuelve, en una sola llamada, toda la información que el
//! Dashboard necesita. No crea la base de datos ni enmascara errores con
//! valores ficticios: si la base falta, el esquema no está inicializado o hay
//! un error de lectura, responde con un error explícito.

use tauri::AppHandle;

use crate::commands::diagnostics;
use crate::core::paths;
use crate::db::connection;
use crate::models::dashboard::{DistribucionInventario, EstadisticasPanel, Panel};
use crate::repositories::dashboard as repo;

/// Obtiene todos los datos del Panel desde la base SQLite local.
#[tauri::command]
pub fn obtener_panel<R: tauri::Runtime>(app: AppHandle<R>) -> Result<Panel, String> {
    let location = paths::resolve_db_location(&app)?;

    if !location.path.is_file() {
        return Err(
            "No se encontró el archivo de base de datos. No se generaron datos de ejemplo."
                .to_string(),
        );
    }

    let conn = connection::open_read_only(&location.path)
        .map_err(|e| format!("No se pudo abrir la base en solo lectura: {e}"))?;

    let inicializado = diagnostics::esquema_inicializado(&conn)
        .map_err(|e| format!("No se pudo inspeccionar el esquema: {e}"))?;
    if !inicializado {
        return Err(
            "El esquema de la base de datos no está inicializado. No se generaron datos de ejemplo."
                .to_string(),
        );
    }

    let conteos = repo::conteos_inventario(&conn)
        .map_err(|e| format!("No se pudieron calcular las estadísticas: {e}"))?;

    let estadisticas = EstadisticasPanel {
        articulos_activos: conteos.articulos_activos,
        unidades_totales: conteos.unidades_totales,
        unidades_disponibles: conteos.unidades_disponibles,
        unidades_prestadas: conteos.unidades_prestadas,
        unidades_daniadas: conteos.unidades_daniadas,
        unidades_faltantes: conteos.unidades_faltantes,
    };

    let distribucion_inventario = DistribucionInventario {
        disponible: conteos.unidades_disponibles,
        prestado: conteos.unidades_prestadas,
        danado: conteos.unidades_daniadas,
        faltante: conteos.unidades_faltantes,
    };

    let actividad_semanal = repo::actividad_semanal(&conn)
        .map_err(|e| format!("No se pudo calcular la actividad semanal: {e}"))?;

    let prestamos_recientes = repo::prestamos_recientes(&conn, 4)
        .map_err(|e| format!("No se pudieron leer los préstamos recientes: {e}"))?;

    Ok(Panel {
        estadisticas,
        actividad_semanal,
        distribucion_inventario,
        prestamos_recientes,
    })
}
