//! Tests de la Etapa A: apertura de SQLite en solo lectura y comando de
//! diagnóstico `diagnosticar_bd` a través del despachador IPC de Tauri
//! (runtime simulado). No usan navegador.
//!
//! Se ejecutan con: `cargo test` (desde `src-tauri`).

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;
use stocklend_lib::commands::diagnostics::EXPECTED_TABLES;
use stocklend_lib::core::paths;
use stocklend_lib::db::connection;
use tauri::ipc::CallbackFn;
use tauri::test::{mock_builder, mock_context, noop_assets, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::WebviewWindowBuilder;

/// `STOCKLEND_DATA_DIR` es global al proceso: serializa los tests que la tocan.
static ENV_LOCK: Mutex<()> = Mutex::new(());

/// Invoca `diagnosticar_bd` mediante el despachador IPC real de Tauri.
fn invoke_ipc() -> serde_json::Value {
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![
            stocklend_lib::commands::diagnostics::diagnosticar_bd
        ])
        .build(mock_context(noop_assets()))
        .expect("mock app");
    let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .expect("mock webview");
    let body = tauri::test::get_ipc_response(
        &webview,
        InvokeRequest {
            cmd: "diagnosticar_bd".into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: tauri::ipc::InvokeBody::default(),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_string(),
        },
    )
    .expect("la respuesta IPC debe ser Ok");
    body.deserialize::<serde_json::Value>().unwrap()
}

/// Igual que `invoke_ipc`, fijando (o limpiando) `STOCKLEND_DATA_DIR`.
fn invoke_ipc_with_data_dir(dir: Option<&Path>) -> serde_json::Value {
    let _guard = ENV_LOCK.lock().unwrap();
    match dir {
        Some(d) => unsafe { std::env::set_var(paths::ENV_DATA_DIR, d) },
        None => unsafe { std::env::remove_var(paths::ENV_DATA_DIR) },
    }
    let out = invoke_ipc();
    unsafe { std::env::remove_var(paths::ENV_DATA_DIR) };
    out
}

fn fresh_temp_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("stocklend_diag_{tag}"));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

// ---------------------------------------------------------------------------
// Comando a través de Tauri (IPC)
// ---------------------------------------------------------------------------

#[test]
fn ipc_base_real_es_ok_y_solo_lectura() {
    let json = invoke_ipc_with_data_dir(None);
    assert_eq!(json["estado"], "ok", "json={json}");
    assert_eq!(json["existe_archivo"], true);
    assert_eq!(json["solo_lectura"], true);
    assert_eq!(json["tablas_faltantes"].as_array().unwrap().len(), 0);
    assert_eq!(json["tiene_registros_articulo"], true);
    let ruta = json["ruta"].as_str().unwrap();
    assert!(
        ruta.ends_with(&format!("data\\{}", paths::DB_FILENAME))
            || ruta.ends_with(&format!("data/{}", paths::DB_FILENAME)),
        "ruta inesperada: {ruta}"
    );
}

#[test]
fn ipc_base_ausente_no_crea_archivo() {
    let dir = fresh_temp_dir("ausente");
    let json = invoke_ipc_with_data_dir(Some(&dir));
    assert_eq!(json["estado"], "missing", "json={json}");
    assert_eq!(json["existe_archivo"], false);
    assert_eq!(json["origen"], "env_override");
    assert!(
        !dir.join(paths::DB_FILENAME).exists(),
        "no debe crearse la base de datos"
    );
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn ipc_base_vacia_es_esquema_no_inicializado() {
    let dir = fresh_temp_dir("esquema");
    {
        let _creator = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
    }
    let json = invoke_ipc_with_data_dir(Some(&dir));
    assert_eq!(json["estado"], "schema_not_initialized", "json={json}");
    assert_eq!(json["existe_archivo"], true);
    assert_eq!(
        json["tablas_faltantes"].as_array().unwrap().len(),
        EXPECTED_TABLES.len()
    );
    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Garantías de solo lectura de `open_read_only`
// ---------------------------------------------------------------------------

#[test]
fn abrir_archivo_inexistente_falla_y_no_lo_crea() {
    let dir = fresh_temp_dir("inexistente");
    let path = dir.join("nada.sqlite");
    assert!(connection::open_read_only(&path).is_err());
    assert!(!path.exists(), "no debe crearse el archivo");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn la_conexion_read_only_no_escribe() {
    let dir = fresh_temp_dir("solo_lectura");
    let path = dir.join("rw.sqlite");
    {
        let creator = Connection::open(&path).unwrap();
        creator
            .execute_batch("CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1);")
            .unwrap();
    }
    let conn = connection::open_read_only(&path).unwrap();
    assert!(conn.execute_batch("INSERT INTO t VALUES (2);").is_err());
    assert!(conn.execute_batch("DROP TABLE t;").is_err());
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM t", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1);
    let _ = std::fs::remove_dir_all(&dir);
}
