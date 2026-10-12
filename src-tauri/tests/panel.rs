//! Tests de la Etapa B: comando `obtener_panel` mediante el despachador IPC
//! real de Tauri (runtime simulado), sobre bases temporales controladas.
//!
//! No usan navegador. Se ejecutan con: `cargo test` (desde `src-tauri`).

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::{params, Connection};
use stocklend_lib::core::paths;
use tauri::ipc::CallbackFn;
use tauri::test::{mock_builder, mock_context, noop_assets, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::WebviewWindowBuilder;

/// `STOCKLEND_DATA_DIR` es global al proceso: serializa los tests que la tocan.
static ENV_LOCK: Mutex<()> = Mutex::new(());

/// Esquema mínimo con las 11 tablas esperadas. Solo `articulo`, `estudiante`,
/// `prestamo` y `prestamo_detalle` incluyen las columnas que consulta el panel.
const ESQUEMA_MINIMO: &str = "
CREATE TABLE categoria (id INTEGER PRIMARY KEY);
CREATE TABLE articulo (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    cantidad_total INTEGER NOT NULL DEFAULT 0,
    cantidad_disponible INTEGER NOT NULL DEFAULT 0,
    cantidad_prestada INTEGER NOT NULL DEFAULT 0,
    cantidad_daniada INTEGER NOT NULL DEFAULT 0,
    cantidad_faltante INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE articulo_unidad (id INTEGER PRIMARY KEY);
CREATE TABLE estudiante (
    id INTEGER PRIMARY KEY,
    codigo_universitario TEXT,
    nombres TEXT,
    apellidos TEXT
);
CREATE TABLE prestamo (
    id INTEGER PRIMARY KEY,
    folio TEXT NOT NULL,
    estudiante_id INTEGER NOT NULL,
    fecha_prestamo TEXT NOT NULL,
    estado TEXT NOT NULL
);
CREATE TABLE prestamo_detalle (
    id INTEGER PRIMARY KEY,
    prestamo_id INTEGER NOT NULL,
    articulo_id INTEGER NOT NULL,
    cantidad_prestada INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE devolucion (id INTEGER PRIMARY KEY);
CREATE TABLE devolucion_detalle (id INTEGER PRIMARY KEY);
CREATE TABLE incidente (id INTEGER PRIMARY KEY);
CREATE TABLE movimiento_inventario (id INTEGER PRIMARY KEY);
CREATE TABLE configuracion (id INTEGER PRIMARY KEY);
";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

fn fresh_temp_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("stocklend_panel_{tag}"));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// Crea un directorio temporal con una base que tiene el esquema completo
/// (sin registros). Devuelve el directorio, no la ruta del archivo.
fn dir_con_esquema(tag: &str) -> PathBuf {
    let dir = fresh_temp_dir(tag);
    let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
    conn.execute_batch(ESQUEMA_MINIMO).unwrap();
    dir
}

fn abrir_escritura(dir: &Path) -> Connection {
    Connection::open(dir.join(paths::DB_FILENAME)).unwrap()
}

/// Invoca `obtener_panel` mediante el despachador IPC real de Tauri.
fn invoke_panel() -> Result<serde_json::Value, serde_json::Value> {
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![
            stocklend_lib::commands::dashboard::obtener_panel
        ])
        .build(mock_context(noop_assets()))
        .expect("mock app");
    let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .expect("mock webview");
    let res = tauri::test::get_ipc_response(
        &webview,
        InvokeRequest {
            cmd: "obtener_panel".into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: tauri::ipc::InvokeBody::default(),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_string(),
        },
    );
    match res {
        Ok(body) => Ok(body.deserialize::<serde_json::Value>().unwrap()),
        Err(err) => Err(err),
    }
}

/// Igual que `invoke_panel`, fijando (o limpiando) `STOCKLEND_DATA_DIR`.
fn invoke_panel_with_data_dir(dir: Option<&Path>) -> Result<serde_json::Value, serde_json::Value> {
    let _guard = ENV_LOCK.lock().unwrap();
    match dir {
        Some(d) => unsafe { std::env::set_var(paths::ENV_DATA_DIR, d) },
        None => unsafe { std::env::remove_var(paths::ENV_DATA_DIR) },
    }
    let out = invoke_panel();
    unsafe { std::env::remove_var(paths::ENV_DATA_DIR) };
    out
}

/// Lee una fecha local calculada por SQLite (permite construir expectativas sin
/// depender de una librería de fechas en Rust).
fn fecha_relativa(conn: &Connection, offset: &str) -> String {
    conn.query_row(
        "SELECT date('now', 'localtime', ?1)",
        [offset],
        |r| r.get(0),
    )
    .unwrap()
}

fn insertar_prestamo(
    conn: &Connection,
    id: i64,
    folio: &str,
    estudiante_id: i64,
    offset: &str,
    estado: &str,
) {
    conn.execute(
        "INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, estado) \
         VALUES (?1, ?2, ?3, date('now', 'localtime', ?4) || 'T10:00:00', ?5)",
        params![id, folio, estudiante_id, offset, estado],
    )
    .unwrap();
}

// ---------------------------------------------------------------------------
// Base válida pero vacía
// ---------------------------------------------------------------------------

#[test]
fn panel_base_vacia_devuelve_ceros_y_siete_dias() {
    let dir = dir_con_esquema("vacia");
    let json = invoke_panel_with_data_dir(Some(&dir)).expect("debe ser Ok");

    let est = &json["estadisticas"];
    for k in [
        "articulos_activos",
        "unidades_totales",
        "unidades_disponibles",
        "unidades_prestadas",
        "unidades_daniadas",
        "unidades_faltantes",
    ] {
        assert_eq!(est[k], 0, "campo {k} json={json}");
    }

    let dist = &json["distribucion_inventario"];
    for k in ["disponible", "prestado", "danado", "faltante"] {
        assert_eq!(dist[k], 0, "campo {k} json={json}");
    }

    let semana = json["actividad_semanal"].as_array().unwrap();
    assert_eq!(semana.len(), 7, "json={json}");
    assert!(semana.iter().all(|d| d["prestamos"] == 0));

    assert_eq!(json["prestamos_recientes"].as_array().unwrap().len(), 0);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Estadísticas generales y distribución
// ---------------------------------------------------------------------------

#[test]
fn panel_totales_y_distribucion_coinciden() {
    let dir = dir_con_esquema("totales");
    {
        let conn = abrir_escritura(&dir);
        conn.execute_batch(
            "INSERT INTO articulo VALUES (1, 'Activo', 1, 50, 25, 20, 5, 0);
             INSERT INTO articulo VALUES (2, 'Inactivo', 0, 120, 100, 20, 0, 0);",
        )
        .unwrap();
    }

    let json = invoke_panel_with_data_dir(Some(&dir)).expect("debe ser Ok");
    let est = &json["estadisticas"];
    assert_eq!(est["articulos_activos"], 1, "solo cuenta activos: {json}");
    assert_eq!(est["unidades_totales"], 170);
    assert_eq!(est["unidades_disponibles"], 125);
    assert_eq!(est["unidades_prestadas"], 40);
    assert_eq!(est["unidades_daniadas"], 5);
    assert_eq!(est["unidades_faltantes"], 0);

    let dist = &json["distribucion_inventario"];
    assert_eq!(dist["disponible"], 125);
    assert_eq!(dist["prestado"], 40);
    assert_eq!(dist["danado"], 5);
    assert_eq!(dist["faltante"], 0);

    let suma =
        dist["disponible"].as_i64().unwrap() + dist["prestado"].as_i64().unwrap()
            + dist["danado"].as_i64().unwrap()
            + dist["faltante"].as_i64().unwrap();
    assert_eq!(suma, est["unidades_totales"].as_i64().unwrap());

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Actividad de los últimos siete días
// ---------------------------------------------------------------------------

#[test]
fn panel_actividad_semanal_siete_dias_ordenados_con_huecos() {
    let dir = dir_con_esquema("semanal");
    {
        let conn = abrir_escritura(&dir);
        conn.execute("INSERT INTO estudiante (id) VALUES (1)", [])
            .unwrap();
        insertar_prestamo(&conn, 1, "F-1", 1, "0 days", "activo");
        insertar_prestamo(&conn, 2, "F-2", 1, "-3 days", "cerrado");
        insertar_prestamo(&conn, 3, "F-3", 1, "0 days", "anulado");
    }

    let json = invoke_panel_with_data_dir(Some(&dir)).expect("debe ser Ok");
    let semana = json["actividad_semanal"].as_array().unwrap();
    assert_eq!(semana.len(), 7);

    let conn = abrir_escritura(&dir);
    let hoy = fecha_relativa(&conn, "0 days");
    let hace3 = fecha_relativa(&conn, "-3 days");
    drop(conn);

    for par in semana.windows(2) {
        assert!(
            par[0]["fecha"].as_str().unwrap() < par[1]["fecha"].as_str().unwrap(),
            "fechas deben ser ascendentes"
        );
    }
    assert_eq!(semana.last().unwrap()["fecha"], hoy, "último día es hoy");

    let total: i64 = semana
        .iter()
        .map(|d| d["prestamos"].as_i64().unwrap())
        .sum();
    assert_eq!(total, 2, "excluye el préstamo anulado: {json}");

    let dia = |fecha: &str| {
        semana
            .iter()
            .find(|d| d["fecha"] == fecha)
            .unwrap_or_else(|| panic!("falta el día {fecha}"))
    };
    assert_eq!(dia(&hoy)["prestamos"], 1);
    assert_eq!(dia(&hace3)["prestamos"], 1);
    assert!(semana.iter().all(|d| !d["etiqueta"].as_str().unwrap().is_empty()));

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Préstamos recientes
// ---------------------------------------------------------------------------

#[test]
fn panel_prestamos_recientes_limite_4_y_orden() {
    let dir = dir_con_esquema("recientes");
    {
        let conn = abrir_escritura(&dir);
        conn.execute(
            "INSERT INTO estudiante (id, nombres, apellidos) VALUES (1, 'Carlos Alberto', 'Ramirez Torres')",
            [],
        )
        .unwrap();
        // id 1 = más antiguo (1 renglón) ... id 5 = más reciente (5 renglones).
        for (id, offset) in [(1, "-4 days"), (2, "-3 days"), (3, "-2 days"), (4, "-1 days"), (5, "0 days")] {
            insertar_prestamo(&conn, id, &format!("F-{id}"), 1, offset, "activo");
            for linea in 1..=id {
                conn.execute(
                    "INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada) \
                     VALUES (?1, ?2, 1, 1)",
                    params![id * 10 + linea, id],
                )
                .unwrap();
            }
        }
    }

    let json = invoke_panel_with_data_dir(Some(&dir)).expect("debe ser Ok");
    let recientes = json["prestamos_recientes"].as_array().unwrap();
    assert_eq!(recientes.len(), 4, "solo los cuatro más recientes: {json}");
    let ids: Vec<i64> = recientes.iter().map(|p| p["id"].as_i64().unwrap()).collect();
    assert_eq!(ids, vec![5, 4, 3, 2]);
    let articulos: Vec<i64> = recientes
        .iter()
        .map(|p| p["articulos"].as_i64().unwrap())
        .collect();
    assert_eq!(articulos, vec![5, 4, 3, 2]);
    assert_eq!(recientes[0]["folio"], "F-5");
    assert_eq!(recientes[0]["estudiante"], "Carlos Alberto Ramirez Torres");
    assert_eq!(recientes[0]["estado"], "activo");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn panel_prestamos_recientes_empatan_por_id_descendente() {
    let dir = dir_con_esquema("empate");
    {
        let conn = abrir_escritura(&dir);
        conn.execute(
            "INSERT INTO estudiante (id, nombres, apellidos) VALUES (1, 'Ana', 'Perez')",
            [],
        )
        .unwrap();
        insertar_prestamo(&conn, 7, "F-7", 1, "0 days", "activo");
        insertar_prestamo(&conn, 8, "F-8", 1, "0 days", "activo");
    }

    let json = invoke_panel_with_data_dir(Some(&dir)).expect("debe ser Ok");
    let recientes = json["prestamos_recientes"].as_array().unwrap();
    let ids: Vec<i64> = recientes.iter().map(|p| p["id"].as_i64().unwrap()).collect();
    assert_eq!(ids, vec![8, 7], "misma fecha: id descendente");

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Estados de error
// ---------------------------------------------------------------------------

#[test]
fn panel_base_ausente_es_error_y_no_crea_archivo() {
    let dir = fresh_temp_dir("ausente");
    let err = invoke_panel_with_data_dir(Some(&dir)).expect_err("debe ser Err");
    let msg = err.as_str().unwrap_or_default();
    assert!(msg.contains("No se encontró"), "mensaje inesperado: {err}");
    assert!(
        !dir.join(paths::DB_FILENAME).exists(),
        "no debe crearse la base de datos"
    );
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn panel_esquema_no_inicializado_es_error() {
    // Archivo vacío (cero tablas).
    let dir = fresh_temp_dir("sin_esquema");
    {
        let _conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
    }
    let err = invoke_panel_with_data_dir(Some(&dir)).expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("no está inicializado"),
        "mensaje inesperado: {err}"
    );
    let _ = std::fs::remove_dir_all(&dir);

    // Esquema parcial (solo una de las 11 tablas).
    let dir = fresh_temp_dir("parcial");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch("CREATE TABLE articulo (id INTEGER PRIMARY KEY);")
            .unwrap();
    }
    let err = invoke_panel_with_data_dir(Some(&dir)).expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("no está inicializado"),
        "mensaje inesperado: {err}"
    );
    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Solo lectura y base real
// ---------------------------------------------------------------------------

#[test]
fn panel_no_modifica_el_archivo_sqlite() {
    let dir = dir_con_esquema("sin_cambios");
    {
        let conn = abrir_escritura(&dir);
        conn.execute_batch(
            "INSERT INTO articulo VALUES (1, 'A', 1, 10, 5, 5, 0, 0);
             INSERT INTO estudiante (id, nombres, apellidos) VALUES (1, 'Ana', 'Perez');
             INSERT INTO prestamo VALUES (1, 'F-1', 1, date('now','localtime') || 'T09:00:00', 'activo');",
        )
        .unwrap();
    }
    let ruta = dir.join(paths::DB_FILENAME);
    let antes = std::fs::read(&ruta).unwrap();

    let _ = invoke_panel_with_data_dir(Some(&dir)).expect("debe ser Ok");

    let despues = std::fs::read(&ruta).unwrap();
    assert_eq!(antes, despues, "la base no debe modificarse");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn panel_base_real_es_ok_con_forma_valida() {
    let json = invoke_panel_with_data_dir(None).expect("la base real debe abrirse");

    let est = &json["estadisticas"];
    let total = est["unidades_totales"].as_i64().unwrap();
    let suma = est["unidades_disponibles"].as_i64().unwrap()
        + est["unidades_prestadas"].as_i64().unwrap()
        + est["unidades_daniadas"].as_i64().unwrap()
        + est["unidades_faltantes"].as_i64().unwrap();
    assert_eq!(suma, total, "invariante disponibles+prestadas+dañadas+faltantes");

    assert_eq!(json["actividad_semanal"].as_array().unwrap().len(), 7);
    assert!(json["prestamos_recientes"].as_array().unwrap().len() <= 4);
}
