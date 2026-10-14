//! Tests de Préstamos (Etapa B): comandos `listar_prestamos`,
//! `obtener_detalle_prestamo` y `obtener_estadisticas_prestamos` mediante el
//! despachador IPC real de Tauri (runtime simulado), sobre bases temporales con
//! el **esquema real** (`stocklend/data/migrations/0001_inicial.sql`). Nunca
//! tocan la base real.
//!
//! Cubren: base válida sin préstamos, préstamos `activo` / `cerrado` / `anulado`,
//! préstamo vencido, préstamo activo sin fecha límite, préstamo con varios
//! artículos, cantidades prestadas/devueltas/pendientes, unidades individuales,
//! préstamo inexistente, base ausente, esquema sin inicializar y solo lectura.
//!
//! El vencimiento se prueba con fechas muy anteriores y muy posteriores a la
//! fecha real, de modo que el resultado no depende del reloj de la máquina.
//!
//! Se ejecutan con: `cargo test` (desde `src-tauri`).

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;
use serde_json::json;
use stocklend_lib::core::paths;
use tauri::ipc::CallbackFn;
use tauri::test::{mock_builder, mock_context, noop_assets, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::WebviewWindowBuilder;

/// `STOCKLEND_DATA_DIR` es global al proceso: serializa los tests que la tocan.
static ENV_LOCK: Mutex<()> = Mutex::new(());

/// Los tres comandos de Préstamos, para iterar los casos de error.
const COMANDOS: [&str; 3] = [
    "listar_prestamos",
    "obtener_detalle_prestamo",
    "obtener_estadisticas_prestamos",
];

/// Referencia temporal usada en los `INSERT` de apoyo.
const AHORA: &str = "2026-01-01T10:00:00Z";

/// Fecha límite siempre anterior a cualquier reloj actual → vencida.
const LIMITE_PASADA: &str = "2000-01-01";

/// Fecha límite siempre posterior a cualquier reloj actual → vigente.
const LIMITE_FUTURA: &str = "2999-12-31";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

fn fresh_temp_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("stocklend_prestamos_{tag}"));
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

/// Construye la app simulada y despacha un comando por el IPC real.
fn despachar(
    cmd: &str,
    args: Option<serde_json::Value>,
) -> Result<serde_json::Value, serde_json::Value> {
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![
            stocklend_lib::commands::prestamos::listar_prestamos,
            stocklend_lib::commands::prestamos::obtener_detalle_prestamo,
            stocklend_lib::commands::prestamos::obtener_estadisticas_prestamos,
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

/// Invoca un comando sin `STOCKLEND_DATA_DIR` (usa la base real del proyecto).
fn invoke_real(
    cmd: &str,
    args: Option<serde_json::Value>,
) -> Result<serde_json::Value, serde_json::Value> {
    let _guard = ENV_LOCK.lock().unwrap();
    unsafe { std::env::remove_var(paths::ENV_DATA_DIR) };
    despachar(cmd, args)
}

fn conectar(dir: &Path) -> Connection {
    Connection::open(dir.join(paths::DB_FILENAME)).unwrap()
}

/// Crea un directorio temporal con el esquema real y un escenario de préstamos:
/// dos estudiantes, dos artículos (uno con control individual), cinco préstamos
/// (activo, activo vencido, cerrado, anulado y activo sin límite), renglones con
/// cantidades y unidades individuales.
fn sembrar_escenario(dir: &Path) {
    let conn = conectar(dir);
    conn.execute_batch(&esquema_real()).unwrap();
    conn.execute_batch(&format!(
        "INSERT INTO categoria (id, nombre, activo, creado_en) \
             VALUES (1, 'General', 1, '{AHORA}');
         INSERT INTO articulo (id, codigo, nombre, categoria_id, control_individual,
                               cantidad_total, cantidad_disponible, cantidad_prestada,
                               cantidad_daniada, cantidad_faltante, creado_en, actualizado_en)
             VALUES (1, 'ART-1', 'Olla grande', 1, 0, 0, 0, 0, 0, 0, '{AHORA}', '{AHORA}');
         INSERT INTO articulo (id, codigo, nombre, categoria_id, control_individual,
                               cantidad_total, cantidad_disponible, cantidad_prestada,
                               cantidad_daniada, cantidad_faltante, creado_en, actualizado_en)
             VALUES (2, 'ART-2', 'Cuchillo', 1, 1, 0, 0, 0, 0, 0, '{AHORA}', '{AHORA}');
         INSERT INTO estudiante (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en)
             VALUES (1, '2023-0001', 'Ana', 'Ramirez', 1, '{AHORA}', '{AHORA}');
         INSERT INTO estudiante (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en)
             VALUES (2, '2023-0002', 'Luis', 'Alvarez', 0, '{AHORA}', '{AHORA}');

         -- 1) activo, límite futuro → no vencido, dos renglones (uno con unidades).
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, comentario, creado_en)
             VALUES (1, 'PRE-2026-000001', 1, '2026-10-10T09:00:00Z', '{LIMITE_FUTURA}', 'activo', 'Entrega en laboratorio', '{AHORA}');
         -- 2) activo, límite pasado → vencido, renglón parcial.
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
             VALUES (2, 'PRE-2026-000002', 1, '2026-10-09T09:00:00Z', '{LIMITE_PASADA}', 'activo', '{AHORA}');
         -- 3) cerrado, límite pasado → no vencido (ya cerrado).
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en, cerrado_en)
             VALUES (3, 'PRE-2026-000003', 2, '2026-10-05T09:00:00Z', '{LIMITE_PASADA}', 'cerrado', '{AHORA}', '2026-10-06T09:00:00Z');
         -- 4) anulado, límite pasado → no vencido.
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
             VALUES (4, 'PRE-2026-000004', 1, '2026-10-01T09:00:00Z', '{LIMITE_PASADA}', 'anulado', '{AHORA}');
         -- 5) activo sin fecha límite → no vencido.
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
             VALUES (5, 'PRE-2026-000005', 2, '2026-10-08T09:00:00Z', NULL, 'activo', '{AHORA}');

         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (1, 1, 1, 2, 0, 0, 0, 'pendiente');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (2, 1, 2, 3, 0, 0, 0, 'pendiente');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, estado)
             VALUES (3, 2, 1, 4, 1, 'parcial');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, estado)
             VALUES (4, 3, 1, 1, 1, 'devuelto');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, estado)
             VALUES (5, 4, 1, 5, 'pendiente');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, estado)
             VALUES (6, 5, 1, 2, 'pendiente');

         -- Unidades individuales del renglón 2 (artículo 2, control individual).
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en)
             VALUES (1, 2, 'C-001', 'prestada', 2, '{AHORA}', '{AHORA}');
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en)
             VALUES (2, 2, 'C-002', 'prestada', 2, '{AHORA}', '{AHORA}');
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en)
             VALUES (3, 2, 'C-003', 'prestada', 2, '{AHORA}', '{AHORA}');",
    ))
    .unwrap();
}

fn buscar<'a>(arr: &'a serde_json::Value, id: i64) -> &'a serde_json::Value {
    arr.as_array()
        .unwrap()
        .iter()
        .find(|p| p["id"].as_i64() == Some(id))
        .unwrap_or_else(|| panic!("falta el préstamo {id}"))
}

// ---------------------------------------------------------------------------
// Base válida sin préstamos
// ---------------------------------------------------------------------------

#[test]
fn prestamos_base_vacia_devuelve_lista_vacia_y_cero() {
    let dir = fresh_temp_dir("vacia");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(&esquema_real()).unwrap();
    }

    let lista = invoke("listar_prestamos", None, &dir).expect("debe ser Ok");
    assert_eq!(lista.as_array().unwrap().len(), 0, "json={lista}");

    let stats =
        invoke("obtener_estadisticas_prestamos", None, &dir).expect("debe ser Ok");
    assert_eq!(stats["total"], 0, "json={stats}");
    assert_eq!(stats["activos"], 0);
    assert_eq!(stats["finalizados"], 0);
    assert_eq!(stats["vencidos"], 0);
    assert_eq!(stats["anulados"], 0);
    assert_eq!(stats["unidades_pendientes"], 0);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Lista, vencimiento y totales
// ---------------------------------------------------------------------------

#[test]
fn prestamos_lista_calcula_vencimiento_y_totales_por_estado() {
    let dir = fresh_temp_dir("lista");
    sembrar_escenario(&dir);

    let lista = invoke("listar_prestamos", None, &dir).expect("debe ser Ok");
    let arr = lista.as_array().unwrap();
    assert_eq!(arr.len(), 5, "json={lista}");

    // Orden por fecha descendente: 1 (10/10), 2 (10/09), 5 (10/08), 3 (10/05), 4 (10/01).
    let ids: Vec<i64> = arr.iter().map(|p| p["id"].as_i64().unwrap()).collect();
    assert_eq!(ids, vec![1, 2, 5, 3, 4]);

    let uno = buscar(&lista, 1);
    assert_eq!(uno["folio"], "PRE-2026-000001");
    assert_eq!(uno["estudiante_id"], 1);
    assert_eq!(uno["nombre_completo"], "Ana Ramirez");
    assert_eq!(uno["codigo_universitario"], "2023-0001");
    assert_eq!(uno["fecha_prestamo"], "2026-10-10");
    assert_eq!(uno["fecha_limite"], LIMITE_FUTURA);
    assert_eq!(uno["estado"], "activo");
    assert_eq!(uno["vencido"], false, "límite futuro no vence");
    assert_eq!(uno["comentario"], "Entrega en laboratorio");
    assert_eq!(uno["cerrado_en"], serde_json::Value::Null);
    assert_eq!(uno["renglones"], 2);
    assert_eq!(uno["unidades_prestadas"], 5, "2 + 3");
    assert_eq!(uno["unidades_pendientes"], 5);

    let dos = buscar(&lista, 2);
    assert_eq!(dos["estado"], "activo");
    assert_eq!(dos["vencido"], true, "activo con límite pasado vence");
    assert_eq!(dos["renglones"], 1);
    assert_eq!(dos["unidades_prestadas"], 4);
    assert_eq!(dos["unidades_pendientes"], 3, "4 prestadas - 1 devuelta");

    let tres = buscar(&lista, 3);
    assert_eq!(tres["estado"], "cerrado");
    assert_eq!(tres["vencido"], false, "un préstamo cerrado nunca vence");
    assert_eq!(tres["cerrado_en"], "2026-10-06");
    assert_eq!(tres["unidades_pendientes"], 0);

    let cuatro = buscar(&lista, 4);
    assert_eq!(cuatro["estado"], "anulado");
    assert_eq!(cuatro["vencido"], false, "un préstamo anulado nunca vence");

    let cinco = buscar(&lista, 5);
    assert_eq!(cinco["estado"], "activo");
    assert_eq!(cinco["fecha_limite"], serde_json::Value::Null);
    assert_eq!(cinco["vencido"], false, "sin fecha límite no vence");

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------------

#[test]
fn prestamo_detalle_incluye_renglones_cantidades_y_unidades() {
    let dir = fresh_temp_dir("detalle");
    sembrar_escenario(&dir);

    let detalle = invoke("obtener_detalle_prestamo", Some(json!({ "id": 1 })), &dir)
        .expect("debe ser Ok");
    assert_eq!(detalle["folio"], "PRE-2026-000001");
    assert_eq!(detalle["nombre_completo"], "Ana Ramirez");
    assert_eq!(detalle["codigo_universitario"], "2023-0001");
    assert_eq!(detalle["fecha_prestamo"], "2026-10-10");
    assert_eq!(detalle["fecha_limite"], LIMITE_FUTURA);
    assert_eq!(detalle["estado"], "activo");
    assert_eq!(detalle["vencido"], false);
    assert_eq!(detalle["creado_en"], "2026-01-01");
    assert_eq!(detalle["renglones"], 2);
    assert_eq!(detalle["unidades_prestadas"], 5);
    assert_eq!(detalle["unidades_pendientes"], 5);

    let lineas = detalle["lineas"].as_array().unwrap();
    assert_eq!(lineas.len(), 2, "json={detalle}");

    let olla = lineas.iter().find(|l| l["articulo"] == "Olla grande").unwrap();
    assert_eq!(olla["articulo_id"], 1);
    assert_eq!(olla["cantidad_prestada"], 2);
    assert_eq!(olla["cantidad_devuelta"], 0);
    assert_eq!(olla["cantidad_daniada"], 0);
    assert_eq!(olla["cantidad_perdida"], 0);
    assert_eq!(olla["cantidad_pendiente"], 2);
    assert_eq!(olla["estado"], "pendiente");
    assert_eq!(olla["unidades"].as_array().unwrap().len(), 0);

    let cuchillo = lineas.iter().find(|l| l["articulo"] == "Cuchillo").unwrap();
    assert_eq!(cuchillo["cantidad_prestada"], 3);
    assert_eq!(cuchillo["cantidad_pendiente"], 3);
    let codigos: Vec<&str> = cuchillo["unidades"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c.as_str().unwrap())
        .collect();
    assert_eq!(codigos, vec!["C-001", "C-002", "C-003"]);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn prestamo_detalle_parcial_refleja_cantidad_pendiente() {
    let dir = fresh_temp_dir("detalle_parcial");
    sembrar_escenario(&dir);

    let detalle = invoke("obtener_detalle_prestamo", Some(json!({ "id": 2 })), &dir)
        .expect("debe ser Ok");
    assert_eq!(detalle["vencido"], true);
    let lineas = detalle["lineas"].as_array().unwrap();
    assert_eq!(lineas.len(), 1);
    let linea = &lineas[0];
    assert_eq!(linea["cantidad_prestada"], 4);
    assert_eq!(linea["cantidad_devuelta"], 1);
    assert_eq!(linea["cantidad_pendiente"], 3);
    assert_eq!(linea["estado"], "parcial");
    assert_eq!(detalle["unidades_pendientes"], 3);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn prestamo_inexistente_es_error_en_detalle() {
    let dir = fresh_temp_dir("detalle_inexistente");
    sembrar_escenario(&dir);

    let err = invoke("obtener_detalle_prestamo", Some(json!({ "id": 999 })), &dir)
        .expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("No se encontró el préstamo"),
        "mensaje inesperado: {err}"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Estadísticas
// ---------------------------------------------------------------------------

#[test]
fn prestamos_estadisticas_no_duplican_y_coinciden_con_la_lista() {
    let dir = fresh_temp_dir("estadisticas");
    sembrar_escenario(&dir);

    let stats =
        invoke("obtener_estadisticas_prestamos", None, &dir).expect("debe ser Ok");
    assert_eq!(stats["total"], 5, "json={stats}");
    assert_eq!(stats["activos"], 3, "préstamos 1, 2 y 5");
    assert_eq!(stats["finalizados"], 1, "préstamo cerrado 3");
    assert_eq!(stats["anulados"], 1, "préstamo anulado 4");
    assert_eq!(stats["vencidos"], 1, "solo el préstamo activo 2");
    assert_eq!(stats["unidades_pendientes"], 10, "5 + 3 + 2 de los activos");

    // Coherencia con el listado: los recuentos no se contradicen ni duplican.
    let lista = invoke("listar_prestamos", None, &dir).expect("debe ser Ok");
    let arr = lista.as_array().unwrap();
    assert_eq!(arr.len() as i64, stats["total"].as_i64().unwrap());
    let contar = |estado: &str| {
        arr.iter()
            .filter(|p| p["estado"].as_str() == Some(estado))
            .count() as i64
    };
    let activos = contar("activo");
    let vencidos = arr.iter().filter(|p| p["vencido"] == true).count() as i64;
    assert_eq!(activos, stats["activos"].as_i64().unwrap());
    assert_eq!(vencidos, stats["vencidos"].as_i64().unwrap());
    assert_eq!(contar("cerrado"), stats["finalizados"].as_i64().unwrap());
    assert_eq!(contar("anulado"), stats["anulados"].as_i64().unwrap());

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Estados de error de apertura
// ---------------------------------------------------------------------------

#[test]
fn prestamos_base_ausente_es_error_y_no_crea_archivo() {
    let dir = fresh_temp_dir("ausente");
    for cmd in COMANDOS {
        let args = match cmd {
            "obtener_detalle_prestamo" => Some(json!({ "id": 1 })),
            _ => None,
        };
        let err = invoke(cmd, args, &dir).expect_err("debe ser Err");
        let msg = err.as_str().unwrap_or_default();
        assert!(msg.contains("No se encontró"), "{cmd}: mensaje inesperado: {err}");
    }
    assert!(
        !dir.join(paths::DB_FILENAME).exists(),
        "no debe crearse la base de datos"
    );
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn prestamos_esquema_no_inicializado_es_error() {
    // Base vacía (sin tablas).
    let dir = fresh_temp_dir("sin_esquema");
    {
        let _ = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
    }
    for cmd in COMANDOS {
        let args = match cmd {
            "obtener_detalle_prestamo" => Some(json!({ "id": 1 })),
            _ => None,
        };
        let err = invoke(cmd, args, &dir).expect_err("debe ser Err");
        assert!(
            err.as_str().unwrap_or_default().contains("no está inicializado"),
            "{cmd}: mensaje inesperado: {err}"
        );
    }
    let _ = std::fs::remove_dir_all(&dir);

    // Esquema parcial (falta la mayoría de tablas).
    let dir = fresh_temp_dir("parcial");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(
            "CREATE TABLE prestamo (id INTEGER PRIMARY KEY); \
             CREATE TABLE prestamo_detalle (id INTEGER PRIMARY KEY);",
        )
        .unwrap();
    }
    for cmd in COMANDOS {
        let args = match cmd {
            "obtener_detalle_prestamo" => Some(json!({ "id": 1 })),
            _ => None,
        };
        let err = invoke(cmd, args, &dir).expect_err("debe ser Err");
        assert!(
            err.as_str().unwrap_or_default().contains("no está inicializado"),
            "{cmd}: mensaje inesperado: {err}"
        );
    }
    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Solo lectura y base real
// ---------------------------------------------------------------------------

#[test]
fn prestamos_no_modifica_el_archivo_sqlite() {
    let dir = fresh_temp_dir("sin_cambios");
    sembrar_escenario(&dir);

    let ruta = dir.join(paths::DB_FILENAME);
    let antes = std::fs::read(&ruta).unwrap();

    let _ = invoke("listar_prestamos", None, &dir).expect("lista");
    let _ = invoke("obtener_detalle_prestamo", Some(json!({ "id": 1 })), &dir).expect("detalle");
    let _ = invoke("obtener_estadisticas_prestamos", None, &dir).expect("estadísticas");

    let despues = std::fs::read(&ruta).unwrap();
    assert_eq!(antes, despues, "la base no debe modificarse");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn prestamos_base_real_es_ok_con_forma_valida() {
    let lista = invoke_real("listar_prestamos", None).expect("préstamos reales");
    let stats = invoke_real("obtener_estadisticas_prestamos", None).expect("estadísticas reales");

    let arr = lista.as_array().unwrap();
    let total = stats["total"].as_i64().unwrap();
    assert_eq!(total, arr.len() as i64, "stats={stats} json={lista}");

    for p in arr {
        assert!(p["folio"].is_string());
        assert!(p["estudiante_id"].is_i64());
        assert!(p["nombre_completo"].is_string());
        assert!(p["estado"].is_string());
        assert!(p["vencido"].is_boolean());
        assert!(p["renglones"].is_i64());
        assert!(p["unidades_prestadas"].is_i64());
        assert!(p["unidades_pendientes"].is_i64());
    }

    // El detalle del primer préstamo (si existe) debe responder con sus renglones.
    if let Some(primero) = arr.first() {
        let id = primero["id"].as_i64().unwrap();
        let detalle = invoke_real("obtener_detalle_prestamo", Some(json!({ "id": id })))
            .expect("detalle real");
        assert_eq!(detalle["id"], id);
        assert_eq!(detalle["lineas"].as_array().unwrap().len() as i64, detalle["renglones"].as_i64().unwrap());
    }

    // Un identificador inexistente es un error explícito.
    let inexistente = arr.iter().filter_map(|p| p["id"].as_i64()).max().unwrap_or(0) + 1;
    let err = invoke_real("obtener_detalle_prestamo", Some(json!({ "id": inexistente })))
        .expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("No se encontró el préstamo"),
        "mensaje inesperado: {err}"
    );
}
