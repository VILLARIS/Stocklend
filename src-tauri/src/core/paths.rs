//! Resolución de la ruta de la base de datos (ARCHITECTURE §8.1).
//!
//! Nunca se depende del directorio de trabajo actual. El orden es:
//! 1. `STOCKLEND_DATA_DIR` (pruebas, portabilidad o uso compartido).
//! 2. Aplicación instalada: carpeta local de datos de la aplicación (API de Tauri).
//! 3. Desarrollo: `data/` del repositorio.

use std::path::{Path, PathBuf};

use serde::Serialize;

/// Nombre del archivo de base de datos (`stocklend.core.constants.DB_FILENAME`).
pub const DB_FILENAME: &str = "stocklend.sqlite";

/// Variable de entorno que fuerza el directorio de datos.
pub const ENV_DATA_DIR: &str = "STOCKLEND_DATA_DIR";

/// De dónde salió la ruta resuelta. Se informa en el diagnóstico.
///
/// Cada construcción está detrás de `cfg!(debug_assertions)`, así que una
/// variante queda sin usar en cada perfil de compilación; por eso el `allow`.
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DataDirOrigin {
    /// Directorio forzado con `STOCKLEND_DATA_DIR`.
    EnvOverride,
    /// Compilación de desarrollo: `data/` del repositorio.
    DevelopmentRepo,
    /// Aplicación instalada: carpeta de datos local de la aplicación.
    InstalledAppData,
}

/// Ruta resuelta de la base de datos y su procedencia.
#[derive(Debug, Clone)]
pub struct DbLocation {
    pub path: PathBuf,
    pub origin: DataDirOrigin,
}

/// Resuelve la ruta de la base de datos.
///
/// Nunca se usa el directorio de trabajo actual ni se presupone que el
/// directorio de desarrollo exista en una aplicación instalada.
pub fn resolve_db_location<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<DbLocation, String> {
    if let Some(dir) = env_data_dir() {
        return Ok(DbLocation {
            path: dir.join(DB_FILENAME),
            origin: DataDirOrigin::EnvOverride,
        });
    }

    #[cfg(debug_assertions)]
    {
        // En desarrollo, la API de Tauri todavía no aporta nada útil: la base
        // vive junto al repositorio, igual que en la aplicación Python.
        let _ = app;
        let dir = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("data");
        return Ok(DbLocation {
            path: dir.join(DB_FILENAME),
            origin: DataDirOrigin::DevelopmentRepo,
        });
    }

    #[cfg(not(debug_assertions))]
    {
        use tauri::Manager;
        let dir = app
            .path()
            .app_local_data_dir()
            .map_err(|e| format!("No se pudo resolver la carpeta de datos de la aplicación: {e}"))?;
        return Ok(DbLocation {
            path: dir.join(DB_FILENAME),
            origin: DataDirOrigin::InstalledAppData,
        });
    }
}

/// Directorio indicado por `STOCKLEND_DATA_DIR`, si está definido y no vacío.
fn env_data_dir() -> Option<PathBuf> {
    let value = std::env::var(ENV_DATA_DIR).ok()?;
    let value = value.trim();
    if value.is_empty() {
        return None;
    }
    Some(PathBuf::from(value))
}
