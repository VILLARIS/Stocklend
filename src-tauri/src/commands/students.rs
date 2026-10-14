//! Comandos de Estudiantes (Etapa B). Solo lectura.
//!
//! Reutilizan la resolución de ruta, la apertura en solo lectura y la validación
//! de esquema ya existentes. Nunca crean la base: si el archivo falta, el esquema
//! no está inicializado o una consulta falla, devuelven un error explícito (mismo
//! criterio que `obtener_panel` y los comandos de Inventario). Los estados vacíos
//! (base sin estudiantes, estudiante sin préstamos o sin incidencias) se devuelven
//! como listas vacías, no como errores.

use tauri::AppHandle;

use crate::commands::diagnostics;
use crate::core::paths;
use crate::db::connection;
use crate::models::students::{
    ActualizarEstudianteInput, CambiarEstadoEstudianteInput, CrearEstudianteInput,
    EstadisticasEstudiantes, EstudianteDirectorio, IncidenciaEstudiante, PrestamoEstudiante,
};
use crate::repositories::students;
use crate::services::estudiantes as service;

/// Abre la base real en solo lectura, validando existencia y esquema.
///
/// Compartido por los cuatro comandos para no repetir la apertura ni la noción
/// de "esquema inicializado".
fn abrir_estudiantes<R: tauri::Runtime>(
    app: &AppHandle<R>,
) -> Result<rusqlite::Connection, String> {
    let location = paths::resolve_db_location(app)?;

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

    Ok(conn)
}

/// Abre la base real en modo escritura, validando existencia y esquema.
///
/// Comparte la resolución de ruta y la noción de "esquema inicializado" con las
/// lecturas. Activa `PRAGMA foreign_keys` y permite escrituras; en ningún caso
/// crea el archivo. Base para las operaciones de escritura de estudiantes.
fn abrir_estudiantes_escritura<R: tauri::Runtime>(
    app: &AppHandle<R>,
) -> Result<rusqlite::Connection, String> {
    let location = paths::resolve_db_location(app)?;

    if !location.path.is_file() {
        return Err(
            "No se encontró el archivo de base de datos. No se puede escribir.".to_string(),
        );
    }

    let conn = connection::open_read_write(&location.path)
        .map_err(|e| format!("No se pudo abrir la base en modo escritura: {e}"))?;

    let inicializado = diagnostics::esquema_inicializado(&conn)
        .map_err(|e| format!("No se pudo inspeccionar el esquema: {e}"))?;
    if !inicializado {
        return Err(
            "El esquema de la base de datos no está inicializado. No se puede escribir.".to_string(),
        );
    }

    Ok(conn)
}

/// Lista los estudiantes del directorio con sus recuentos derivados.
#[tauri::command]
pub fn listar_estudiantes<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<EstudianteDirectorio>, String> {
    let conn = abrir_estudiantes(&app)?;
    students::listar_estudiantes(&conn)
        .map_err(|e| format!("No se pudieron leer los estudiantes: {e}"))
}

/// Estadísticas de las tarjetas del directorio de Estudiantes.
#[tauri::command]
pub fn obtener_estadisticas_estudiantes<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<EstadisticasEstudiantes, String> {
    let conn = abrir_estudiantes(&app)?;
    students::obtener_estadisticas(&conn)
        .map_err(|e| format!("No se pudieron calcular las estadísticas de estudiantes: {e}"))
}

/// Historial de préstamos de un estudiante, del más reciente al más antiguo.
///
/// Un estudiante inexistente es un error explícito; uno sin préstamos devuelve
/// una lista vacía.
#[tauri::command]
pub fn obtener_historial_estudiante<R: tauri::Runtime>(
    app: AppHandle<R>,
    id: i64,
) -> Result<Vec<PrestamoEstudiante>, String> {
    let conn = abrir_estudiantes(&app)?;
    exigir_estudiante(&conn, id)?;
    students::historial_prestamos(&conn, id)
        .map_err(|e| format!("No se pudo leer el historial del estudiante: {e}"))
}

/// Incidencias asociadas a un estudiante, de la más reciente a la más antigua.
///
/// Un estudiante inexistente es un error explícito; uno sin incidencias devuelve
/// una lista vacía.
#[tauri::command]
pub fn obtener_incidencias_estudiante<R: tauri::Runtime>(
    app: AppHandle<R>,
    id: i64,
) -> Result<Vec<IncidenciaEstudiante>, String> {
    let conn = abrir_estudiantes(&app)?;
    exigir_estudiante(&conn, id)?;
    students::incidencias_estudiante(&conn, id)
        .map_err(|e| format!("No se pudieron leer las incidencias del estudiante: {e}"))
}

/// Verifica que el estudiante exista; si no, devuelve un error explícito.
fn exigir_estudiante(conn: &rusqlite::Connection, id: i64) -> Result<(), String> {
    let existe = students::existe_estudiante(conn, id)
        .map_err(|e| format!("No se pudo verificar el estudiante: {e}"))?;
    if !existe {
        return Err("No se encontró el estudiante indicado.".to_string());
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Escrituras de estudiante. Transacción `IMMEDIATE`; devuelven la fila con sus
// recuentos para que el frontend refresque sin una segunda consulta.
// ---------------------------------------------------------------------------

/// Registra un estudiante y devuelve su fila del directorio.
#[tauri::command]
pub fn crear_estudiante<R: tauri::Runtime>(
    app: AppHandle<R>,
    datos: CrearEstudianteInput,
) -> Result<EstudianteDirectorio, String> {
    let mut conn = abrir_estudiantes_escritura(&app)?;
    let tx = connection::transaccion_immediate(&mut conn)
        .map_err(|e| format!("No se pudo iniciar la transacción: {e}"))?;

    let id = service::crear(
        &tx,
        &datos.codigo_universitario,
        &datos.nombres,
        &datos.apellidos,
    )
    .map_err(|e| e.to_string())?;
    let estudiante = leer_estudiante_obligatorio(&tx, id)?;

    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la operación: {e}"))?;
    Ok(estudiante)
}

/// Corrige los datos de un estudiante y devuelve su fila del directorio.
#[tauri::command]
pub fn actualizar_estudiante<R: tauri::Runtime>(
    app: AppHandle<R>,
    datos: ActualizarEstudianteInput,
) -> Result<EstudianteDirectorio, String> {
    let mut conn = abrir_estudiantes_escritura(&app)?;
    let tx = connection::transaccion_immediate(&mut conn)
        .map_err(|e| format!("No se pudo iniciar la transacción: {e}"))?;

    service::actualizar(
        &tx,
        datos.id,
        &datos.codigo_universitario,
        &datos.nombres,
        &datos.apellidos,
    )
    .map_err(|e| e.to_string())?;
    let estudiante = leer_estudiante_obligatorio(&tx, datos.id)?;

    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la operación: {e}"))?;
    Ok(estudiante)
}

/// Activa o desactiva un estudiante sin borrarlo (RN-14).
#[tauri::command]
pub fn cambiar_estado_estudiante<R: tauri::Runtime>(
    app: AppHandle<R>,
    datos: CambiarEstadoEstudianteInput,
) -> Result<EstudianteDirectorio, String> {
    let mut conn = abrir_estudiantes_escritura(&app)?;
    let tx = connection::transaccion_immediate(&mut conn)
        .map_err(|e| format!("No se pudo iniciar la transacción: {e}"))?;

    service::cambiar_estado(&tx, datos.id, datos.activo).map_err(|e| e.to_string())?;
    let estudiante = leer_estudiante_obligatorio(&tx, datos.id)?;

    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la operación: {e}"))?;
    Ok(estudiante)
}

/// Lee el estudiante recién operado, tratando su ausencia como error interno.
fn leer_estudiante_obligatorio(
    conn: &rusqlite::Connection,
    id: i64,
) -> Result<EstudianteDirectorio, String> {
    students::leer_estudiante(conn, id)
        .map_err(|e| format!("No se pudo leer el estudiante: {e}"))?
        .ok_or_else(|| "No se encontró el estudiante indicado.".to_string())
}
