//! Comandos de Devoluciones. Lecturas (Etapa B) y registro (Etapa E1).
//!
//! Reutilizan la resolución de ruta, la apertura de conexión y la validación de
//! esquema ya existentes (`commands::diagnostics`), igual que Préstamos. Nunca
//! crean la base: si el archivo falta, el esquema no está inicializado o una
//! consulta falla, se devuelve un error explícito. `registrar_devolucion` abre la
//! base en modo escritura y envuelve el servicio en una transacción `IMMEDIATE`.

use tauri::AppHandle;

use crate::commands::diagnostics;
use crate::core::paths;
use crate::db::connection;
use crate::models::devoluciones::{
    DetalleDevolucion, DevolucionHistorial, DevolucionRegistrada, EstadisticasDevoluciones,
    PrestamoDevolucionResumen, RegistrarDevolucionInput,
};
use crate::repositories::devoluciones as repo;
use crate::repositories::prestamos as repo_prestamos;
use crate::services::devoluciones as service;

/// Abre la base real en solo lectura, validando existencia y esquema.
///
/// Compartido por los comandos para no repetir la apertura ni la noción de
/// "esquema inicializado".
fn abrir_devoluciones<R: tauri::Runtime>(
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

/// Préstamos activos con cantidades pendientes de devolución.
#[tauri::command]
pub fn listar_devoluciones_pendientes<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<PrestamoDevolucionResumen>, String> {
    let conn = abrir_devoluciones(&app)?;
    let hoy = repo_prestamos::fecha_hoy(&conn)
        .map_err(|e| format!("No se pudo obtener la fecha de referencia: {e}"))?;
    repo::listar_pendientes(&conn, &hoy)
        .map_err(|e| format!("No se pudieron leer las devoluciones pendientes: {e}"))
}

/// Detalle de un préstamo para preparar una devolución.
///
/// Un préstamo inexistente es un error explícito; uno no activo se devuelve con
/// `elegible = false` para consultar su historial.
#[tauri::command(rename_all = "snake_case")]
pub fn obtener_detalle_devolucion<R: tauri::Runtime>(
    app: AppHandle<R>,
    prestamo_id: i64,
) -> Result<DetalleDevolucion, String> {
    let conn = abrir_devoluciones(&app)?;
    let hoy = repo_prestamos::fecha_hoy(&conn)
        .map_err(|e| format!("No se pudo obtener la fecha de referencia: {e}"))?;
    repo::obtener_detalle(&conn, prestamo_id, &hoy)
        .map_err(|e| format!("No se pudo leer el detalle del préstamo: {e}"))?
        .ok_or_else(|| "No se encontró el préstamo indicado.".to_string())
}

/// Devoluciones ya registradas, opcionalmente filtradas por préstamo.
#[tauri::command(rename_all = "snake_case")]
pub fn listar_historial_devoluciones<R: tauri::Runtime>(
    app: AppHandle<R>,
    prestamo_id: Option<i64>,
) -> Result<Vec<DevolucionHistorial>, String> {
    let conn = abrir_devoluciones(&app)?;
    repo::listar_historial(&conn, prestamo_id)
        .map_err(|e| format!("No se pudo leer el historial de devoluciones: {e}"))
}

/// Tarjetas resumen de Devoluciones.
#[tauri::command]
pub fn obtener_estadisticas_devoluciones<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<EstadisticasDevoluciones, String> {
    let conn = abrir_devoluciones(&app)?;
    let hoy = repo_prestamos::fecha_hoy(&conn)
        .map_err(|e| format!("No se pudo obtener la fecha de referencia: {e}"))?;
    repo::obtener_estadisticas(&conn, &hoy)
        .map_err(|e| format!("No se pudieron leer las estadísticas de devoluciones: {e}"))
}

/// Abre la base real en modo escritura, validando existencia y esquema.
///
/// Comparte con las lecturas la resolución de ruta y la noción de "esquema
/// inicializado"; activa `PRAGMA foreign_keys` y permite escrituras. Nunca crea
/// el archivo. Es la base de `registrar_devolucion`.
fn abrir_devoluciones_escritura<R: tauri::Runtime>(
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

/// Registra una devolución (completa o parcial) y devuelve el evento creado.
///
/// La fecha la fija el backend. Validar el préstamo y los renglones, escribir la
/// devolución, mover el inventario, crear los incidentes de daño o pérdida y
/// cerrar el préstamo si corresponde ocurre en una sola transacción: si algo
/// falla no queda ningún registro (RN-26, RN-28, RN-33, RN-35, RN-38).
#[tauri::command(rename_all = "snake_case")]
pub fn registrar_devolucion<R: tauri::Runtime>(
    app: AppHandle<R>,
    datos: RegistrarDevolucionInput,
) -> Result<DevolucionRegistrada, String> {
    let mut conn = abrir_devoluciones_escritura(&app)?;
    let tx = connection::transaccion_immediate(&mut conn)
        .map_err(|e| format!("No se pudo iniciar la transacción: {e}"))?;

    let lineas: Vec<service::LineaDevolucion> = datos
        .lineas
        .iter()
        .map(|linea| service::LineaDevolucion {
            prestamo_detalle_id: linea.prestamo_detalle_id,
            cantidad_devuelta: linea.cantidad_devuelta,
            cantidad_daniada: linea.cantidad_daniada,
            cantidad_perdida: linea.cantidad_perdida,
            unidades: linea
                .unidades
                .iter()
                .map(|unidad| service::UnidadDevolucion {
                    unidad_id: unidad.unidad_id,
                    condicion: unidad.condicion.clone(),
                })
                .collect(),
            descripcion: linea.descripcion.clone(),
            notas: linea.notas.clone(),
            estudiante_id: linea.estudiante_id,
        })
        .collect();

    let id = service::registrar(
        &tx,
        datos.prestamo_id,
        &lineas,
        datos.observaciones.as_deref(),
    )
    .map_err(|e| e.to_string())?;

    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la operación: {e}"))?;

    repo::obtener_registrada(&conn, id)
        .map_err(|e| format!("No se pudo leer la devolución registrada: {e}"))?
        .ok_or_else(|| "No se encontró la devolución recién registrada.".to_string())
}
