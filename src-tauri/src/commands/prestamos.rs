//! Comandos de Préstamos.
//!
//! Las lecturas (`listar_prestamos`, `obtener_detalle_prestamo`,
//! `obtener_estadisticas_prestamos`, Etapa B) reutilizan la resolución de ruta,
//! la apertura en solo lectura y la validación de esquema ya existentes
//! (`commands::diagnostics`). La Etapa E1 añade `registrar_prestamo`, que abre la
//! base en escritura y envuelve el servicio de préstamos en una transacción
//! `IMMEDIATE`. Nunca se crea la base: si el archivo falta, el esquema no está
//! inicializado o una operación falla, se devuelve un error explícito. Editar,
//! anular y devolver préstamos son etapas posteriores.

use tauri::AppHandle;

use crate::commands::diagnostics;
use crate::core::paths;
use crate::db::connection;
use crate::models::prestamos::{
    EstadisticasPrestamos, PrestamoDetalle, PrestamoResumen, RegistrarPrestamoInput,
};
use crate::repositories::prestamos as repo;
use crate::services::prestamos as service;

/// Abre la base real en solo lectura, validando existencia y esquema.
///
/// Compartido por los tres comandos para no repetir la apertura ni la noción de
/// "esquema inicializado".
fn abrir_prestamos<R: tauri::Runtime>(
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
/// lecturas; activa `PRAGMA foreign_keys` y permite escrituras. En ningún caso
/// crea el archivo. Es la base de `registrar_prestamo`.
fn abrir_prestamos_escritura<R: tauri::Runtime>(
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

/// Fecha de referencia local (`YYYY-MM-DD`) para derivar el vencimiento.
fn hoy(conn: &rusqlite::Connection) -> Result<String, String> {
    repo::fecha_hoy(conn).map_err(|e| format!("No se pudo obtener la fecha de referencia: {e}"))
}

/// Lista los préstamos con sus totales, del más reciente al más antiguo.
#[tauri::command]
pub fn listar_prestamos<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<PrestamoResumen>, String> {
    let conn = abrir_prestamos(&app)?;
    let hoy = hoy(&conn)?;
    repo::listar_prestamos(&conn, &hoy)
        .map_err(|e| format!("No se pudieron leer los préstamos: {e}"))
}

/// Devuelve el detalle de un préstamo, con sus renglones.
///
/// Un préstamo inexistente es un error explícito.
#[tauri::command]
pub fn obtener_detalle_prestamo<R: tauri::Runtime>(
    app: AppHandle<R>,
    id: i64,
) -> Result<PrestamoDetalle, String> {
    let conn = abrir_prestamos(&app)?;
    let hoy = hoy(&conn)?;
    repo::obtener_detalle(&conn, id, &hoy)
        .map_err(|e| format!("No se pudo leer el detalle del préstamo: {e}"))?
        .ok_or_else(|| "No se encontró el préstamo indicado.".to_string())
}

/// Estadísticas de las tarjetas resumen de Préstamos.
#[tauri::command]
pub fn obtener_estadisticas_prestamos<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<EstadisticasPrestamos, String> {
    let conn = abrir_prestamos(&app)?;
    let hoy = hoy(&conn)?;
    repo::obtener_estadisticas(&conn, &hoy)
        .map_err(|e| format!("No se pudieron calcular las estadísticas de préstamos: {e}"))
}

// ---------------------------------------------------------------------------
// Escritura (Etapa E1). Transacción `IMMEDIATE`; devuelve el préstamo registrado
// con sus renglones y unidades para que el frontend lo muestre sin releer.
// ---------------------------------------------------------------------------

/// Registra un préstamo real y devuelve su detalle persistido.
///
/// La fecha, el folio y los totales los fija el backend. Toda la operación
/// (validaciones, folio, cabecera, renglones, inventario y movimientos) ocurre en
/// una sola transacción: si algo falla no queda ningún registro ni se consume el
/// folio (RN-21, RN-48).
#[tauri::command]
pub fn registrar_prestamo<R: tauri::Runtime>(
    app: AppHandle<R>,
    datos: RegistrarPrestamoInput,
) -> Result<PrestamoDetalle, String> {
    let mut conn = abrir_prestamos_escritura(&app)?;
    let tx = connection::transaccion_immediate(&mut conn)
        .map_err(|e| format!("No se pudo iniciar la transacción: {e}"))?;

    let lineas: Vec<service::LineaPrestamo> = datos
        .lineas
        .iter()
        .map(|linea| service::LineaPrestamo {
            articulo_id: linea.articulo_id,
            cantidad: linea.cantidad,
            unidad_ids: linea.unidad_ids.clone(),
        })
        .collect();

    let id = service::registrar(
        &tx,
        datos.estudiante_id,
        &lineas,
        datos.fecha_limite.as_deref(),
        datos.comentario.as_deref(),
    )
    .map_err(|e| e.to_string())?;

    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la operación: {e}"))?;

    let hoy = hoy(&conn)?;
    repo::obtener_detalle(&conn, id, &hoy)
        .map_err(|e| format!("No se pudo leer el préstamo registrado: {e}"))?
        .ok_or_else(|| "No se encontró el préstamo recién registrado.".to_string())
}
