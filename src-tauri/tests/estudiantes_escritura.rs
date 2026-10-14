//! Tests de escritura de Estudiantes: comandos `crear_estudiante`,
//! `actualizar_estudiante` y `cambiar_estado_estudiante` mediante el despachador
//! IPC real de Tauri (runtime simulado), sobre bases temporales con el **esquema
//! real** (`stocklend/data/migrations/0001_inicial.sql`). Nunca tocan la base real.
//!
//! Cubren las reglas RN-11 (código obligatorio y único), RN-12 (nombres y
//! apellidos obligatorios), RN-14/RN-46 (nunca se borra: se marca inactivo, y no
//! se inactiva a quien tenga préstamos activos) y RN-15 (editar no toca el
//! historial), además de los estados de error de apertura.
//!
//! Se ejecutan con: `cargo test` (desde `src-tauri`).

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::{params, Connection};
use serde_json::json;
use stocklend_lib::core::paths;
use tauri::ipc::CallbackFn;
use tauri::test::{mock_builder, mock_context, noop_assets, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::WebviewWindowBuilder;

/// `STOCKLEND_DATA_DIR` es global al proceso: serializa los tests que la tocan.
static ENV_LOCK: Mutex<()> = Mutex::new(());

/// Los tres comandos de escritura, para iterar los casos de error de apertura.
const COMANDOS_ESCRITURA: [&str; 3] = [
    "crear_estudiante",
    "actualizar_estudiante",
    "cambiar_estado_estudiante",
];

/// Marca temporal usada en los `INSERT` de apoyo.
const AHORA: &str = "2026-01-01T10:00:00Z";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

fn fresh_temp_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("stocklend_estudiantes_escritura_{tag}"));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn esquema_real() -> String {
    let ruta = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("stocklend")
        .join("data")
        .join("migrations")
        .join("0001_inicial.sql");
    std::fs::read_to_string(&ruta)
        .unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", ruta.display()))
}

fn dir_con_esquema(tag: &str) -> PathBuf {
    let dir = fresh_temp_dir(tag);
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(&esquema_real()).unwrap();
    }
    dir
}

/// Despacha un comando por el IPC real con la app simulada.
fn despachar(
    cmd: &str,
    args: Option<serde_json::Value>,
) -> Result<serde_json::Value, serde_json::Value> {
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![
            stocklend_lib::commands::students::listar_estudiantes,
            stocklend_lib::commands::students::crear_estudiante,
            stocklend_lib::commands::students::actualizar_estudiante,
            stocklend_lib::commands::students::cambiar_estado_estudiante,
        ])
        .build(mock_context(noop_assets()))
        .expect("mock app");
    let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .expect("mock webview");
    let body = match args {
        Some(valor) => tauri::ipc::InvokeBody::Json(valor),
        None => tauri::ipc::InvokeBody::default(),
    };
    let res = tauri::test::get_ipc_response(
        &webview,
        InvokeRequest {
            cmd: cmd.into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body,
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_string(),
        },
    );
    match res {
        Ok(cuerpo) => Ok(cuerpo.deserialize::<serde_json::Value>().unwrap()),
        Err(err) => Err(err),
    }
}

/// Invoca un comando fijando `STOCKLEND_DATA_DIR` a un directorio temporal.
fn invoke(
    cmd: &str,
    args: Option<serde_json::Value>,
    dir: &Path,
) -> Result<serde_json::Value, serde_json::Value> {
    let _guard = ENV_LOCK.lock().unwrap();
    unsafe { std::env::set_var(paths::ENV_DATA_DIR, dir) };
    let out = despachar(cmd, args);
    unsafe { std::env::remove_var(paths::ENV_DATA_DIR) };
    out
}

fn conectar(dir: &Path) -> Connection {
    Connection::open(dir.join(paths::DB_FILENAME)).unwrap()
}

fn crear_args(codigo: &str, nombres: &str, apellidos: &str) -> serde_json::Value {
    json!({
        "datos": {
            "codigo_universitario": codigo,
            "nombres": nombres,
            "apellidos": apellidos,
        }
    })
}

fn actualizar_args(id: i64, codigo: &str, nombres: &str, apellidos: &str) -> serde_json::Value {
    json!({
        "datos": {
            "id": id,
            "codigo_universitario": codigo,
            "nombres": nombres,
            "apellidos": apellidos,
        }
    })
}

fn estado_args(id: i64, activo: bool) -> serde_json::Value {
    json!({ "datos": { "id": id, "activo": activo } })
}

fn sembrar_estudiante(dir: &Path, id: i64, codigo: &str, nombres: &str, apellidos: &str, activo: bool) {
    conectar(dir)
        .execute(
            "INSERT INTO estudiante \
             (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![id, codigo, nombres, apellidos, activo as i64, AHORA],
        )
        .unwrap();
}

fn sembrar_prestamo(dir: &Path, id: i64, folio: &str, estudiante_id: i64, estado: &str) {
    conectar(dir)
        .execute(
            "INSERT INTO prestamo \
             (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en) \
             VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?4)",
            params![id, folio, estudiante_id, AHORA, estado],
        )
        .unwrap();
}

/// Cuenta los estudiantes en la base (evidencia de que nada se borra).
fn contar_estudiantes(dir: &Path) -> i64 {
    conectar(dir)
        .query_row("SELECT COUNT(*) FROM estudiante", [], |row| row.get(0))
        .unwrap()
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

#[test]
fn crear_estudiante_persiste_y_devuelve_la_fila() {
    let dir = dir_con_esquema("crear");

    let creado = invoke("crear_estudiante", Some(crear_args("A-1", "Ana", "Uno")), &dir)
        .expect("debe ser Ok");
    assert_eq!(creado["id"], 1, "json={creado}");
    assert_eq!(creado["codigo_universitario"], "A-1");
    assert_eq!(creado["nombres"], "Ana");
    assert_eq!(creado["apellidos"], "Uno");
    assert_eq!(creado["nombre_completo"], "Ana Uno");
    assert_eq!(creado["activo"], true, "el alta nace activa");
    assert_eq!(creado["prestamos_activos"], 0);
    assert_eq!(creado["prestamos_finalizados"], 0);
    assert_eq!(creado["unidades_activas"], 0);
    assert_eq!(creado["incidencias"], 0);

    // Persistió y aparece en el directorio.
    let lista = invoke("listar_estudiantes", None, &dir).expect("debe ser Ok");
    assert_eq!(lista.as_array().unwrap().len(), 1, "json={lista}");
    assert_eq!(lista[0]["codigo_universitario"], "A-1");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_estudiante_recorta_espacios_de_los_textos() {
    let dir = dir_con_esquema("crear_trim");

    let creado = invoke(
        "crear_estudiante",
        Some(crear_args("  B-2  ", "  Beto  ", "  Dos  ")),
        &dir,
    )
    .expect("debe ser Ok");
    assert_eq!(creado["codigo_universitario"], "B-2");
    assert_eq!(creado["nombres"], "Beto");
    assert_eq!(creado["apellidos"], "Dos");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_estudiante_codigo_duplicado_es_error_y_no_duplica() {
    let dir = dir_con_esquema("crear_duplicado");
    sembrar_estudiante(&dir, 1, "A-1", "Ana", "Uno", true);

    // Mismo código con otra caja: la columna es COLLATE NOCASE.
    let err = invoke("crear_estudiante", Some(crear_args("a-1", "Otra", "Persona")), &dir)
        .expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("Ya existe un estudiante"),
        "mensaje inesperado: {err}"
    );
    assert_eq!(contar_estudiantes(&dir), 1, "no debe crear un duplicado");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_estudiante_con_campos_vacios_es_error() {
    let dir = dir_con_esquema("crear_vacios");

    for (codigo, nombres, apellidos) in [
        ("   ", "Ana", "Uno"),
        ("A-1", "   ", "Uno"),
        ("A-1", "Ana", "   "),
    ] {
        let err = invoke(
            "crear_estudiante",
            Some(crear_args(codigo, nombres, apellidos)),
            &dir,
        )
        .expect_err("debe ser Err");
        let msg = err.as_str().unwrap_or_default();
        assert!(!msg.is_empty(), "debe traer un mensaje");
    }
    assert_eq!(contar_estudiantes(&dir), 0, "ningún alta debe persistir");

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Edición
// ---------------------------------------------------------------------------

#[test]
fn actualizar_estudiante_corrige_datos_y_conserva_el_historial() {
    let dir = dir_con_esquema("editar");
    sembrar_estudiante(&dir, 1, "A-1", "Ana", "Uno", true);
    sembrar_prestamo(&dir, 1, "PRE-2026-000001", 1, "activo");

    let actualizado = invoke(
        "actualizar_estudiante",
        Some(actualizar_args(1, "A-9", "Ana María", "Uno Pérez")),
        &dir,
    )
    .expect("debe ser Ok");
    assert_eq!(actualizado["id"], 1);
    assert_eq!(actualizado["codigo_universitario"], "A-9");
    assert_eq!(actualizado["nombres"], "Ana María");
    assert_eq!(actualizado["apellidos"], "Uno Pérez");
    assert_eq!(
        actualizado["prestamos_activos"], 1,
        "el historial no se altera (RN-15)"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn actualizar_estudiante_codigo_duplicado_es_error() {
    let dir = dir_con_esquema("editar_duplicado");
    sembrar_estudiante(&dir, 1, "A-1", "Ana", "Uno", true);
    sembrar_estudiante(&dir, 2, "B-2", "Beto", "Dos", true);

    let err = invoke(
        "actualizar_estudiante",
        Some(actualizar_args(2, "A-1", "Beto", "Dos")),
        &dir,
    )
    .expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("Ya existe un estudiante"),
        "mensaje inesperado: {err}"
    );

    // El propio código no cuenta como duplicado.
    let mismo = invoke(
        "actualizar_estudiante",
        Some(actualizar_args(2, "B-2", "Beto", "Dos")),
        &dir,
    )
    .expect("debe ser Ok");
    assert_eq!(mismo["codigo_universitario"], "B-2");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn actualizar_estudiante_inexistente_es_error() {
    let dir = dir_con_esquema("editar_inexistente");

    let err = invoke(
        "actualizar_estudiante",
        Some(actualizar_args(999, "A-1", "Ana", "Uno")),
        &dir,
    )
    .expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("No se encontró el estudiante"),
        "mensaje inesperado: {err}"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Estado (nunca se borra)
// ---------------------------------------------------------------------------

#[test]
fn cambiar_estado_inactiva_y_reactiva_sin_borrar() {
    let dir = dir_con_esquema("estado");
    sembrar_estudiante(&dir, 1, "A-1", "Ana", "Uno", true);

    let inactivo = invoke("cambiar_estado_estudiante", Some(estado_args(1, false)), &dir)
        .expect("debe ser Ok");
    assert_eq!(inactivo["activo"], false);
    assert_eq!(contar_estudiantes(&dir), 1, "no se borra, solo se marca");

    let reactivado = invoke("cambiar_estado_estudiante", Some(estado_args(1, true)), &dir)
        .expect("debe ser Ok");
    assert_eq!(reactivado["activo"], true);
    assert_eq!(contar_estudiantes(&dir), 1);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn cambiar_estado_bloquea_inactivar_con_prestamos_activos() {
    let dir = dir_con_esquema("estado_bloqueado");
    sembrar_estudiante(&dir, 1, "A-1", "Ana", "Uno", true);
    sembrar_estudiante(&dir, 2, "B-2", "Beto", "Dos", true);
    sembrar_prestamo(&dir, 1, "PRE-2026-000001", 1, "activo");
    sembrar_prestamo(&dir, 2, "PRE-2026-000002", 2, "cerrado");

    // Con un préstamo activo no se puede inactivar.
    let err = invoke("cambiar_estado_estudiante", Some(estado_args(1, false)), &dir)
        .expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("préstamos activos"),
        "mensaje inesperado: {err}"
    );
    assert_eq!(
        conectar(&dir)
            .query_row("SELECT activo FROM estudiante WHERE id = 1", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        1,
        "el estado no debe cambiar"
    );

    // Un préstamo cerrado no impide inactivar.
    let ok = invoke("cambiar_estado_estudiante", Some(estado_args(2, false)), &dir)
        .expect("debe ser Ok");
    assert_eq!(ok["activo"], false);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn cambiar_estado_inexistente_es_error() {
    let dir = dir_con_esquema("estado_inexistente");

    let err = invoke("cambiar_estado_estudiante", Some(estado_args(999, false)), &dir)
        .expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("No se encontró el estudiante"),
        "mensaje inesperado: {err}"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Estados de error de apertura
// ---------------------------------------------------------------------------

#[test]
fn escritura_base_ausente_es_error_y_no_crea_archivo() {
    let dir = fresh_temp_dir("ausente");
    for cmd in COMANDOS_ESCRITURA {
        let args = match cmd {
            "crear_estudiante" => Some(crear_args("A-1", "Ana", "Uno")),
            "actualizar_estudiante" => Some(actualizar_args(1, "A-1", "Ana", "Uno")),
            _ => Some(estado_args(1, false)),
        };
        let err = invoke(cmd, args, &dir).expect_err("debe ser Err");
        assert!(
            err.as_str().unwrap_or_default().contains("No se encontró"),
            "{cmd}: mensaje inesperado: {err}"
        );
    }
    assert!(
        !dir.join(paths::DB_FILENAME).exists(),
        "no debe crearse la base de datos"
    );
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn escritura_esquema_no_inicializado_es_error() {
    // Base vacía (sin tablas).
    let dir = fresh_temp_dir("sin_esquema");
    {
        let _ = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
    }
    for cmd in COMANDOS_ESCRITURA {
        let args = match cmd {
            "crear_estudiante" => Some(crear_args("A-1", "Ana", "Uno")),
            "actualizar_estudiante" => Some(actualizar_args(1, "A-1", "Ana", "Uno")),
            _ => Some(estado_args(1, false)),
        };
        let err = invoke(cmd, args, &dir).expect_err("debe ser Err");
        assert!(
            err.as_str().unwrap_or_default().contains("no está inicializado"),
            "{cmd}: mensaje inesperado: {err}"
        );
    }
    let _ = std::fs::remove_dir_all(&dir);
}
