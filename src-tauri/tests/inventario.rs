//! Tests de Inventario: comandos `listar_articulos`, `listar_unidades`,
//! `listar_categorias` y `obtener_estadisticas_inventario` mediante el
//! despachador IPC real de Tauri (runtime simulado), sobre bases temporales
//! controladas. También se contrasta con `obtener_panel` para asegurar que los
//! contadores no se contradicen.
//!
//! No usan navegador. Se ejecutan con: `cargo test` (desde `src-tauri`).

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;
use stocklend_lib::core::paths;
use tauri::ipc::CallbackFn;
use tauri::test::{mock_builder, mock_context, noop_assets, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::WebviewWindowBuilder;

/// `STOCKLEND_DATA_DIR` es global al proceso: serializa los tests que la tocan.
static ENV_LOCK: Mutex<()> = Mutex::new(());

/// Los cuatro comandos de Inventario, para iterar los casos de error.
const COMANDOS: [&str; 4] = [
    "listar_articulos",
    "listar_unidades",
    "listar_categorias",
    "obtener_estadisticas_inventario",
];

/// Esquema mínimo con las 11 tablas esperadas y las columnas que consultan los
/// comandos de Inventario (y el Panel, para la comparación de contadores).
const ESQUEMA_MINIMO: &str = "
CREATE TABLE categoria (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE articulo (
    id INTEGER PRIMARY KEY,
    codigo TEXT,
    nombre TEXT NOT NULL,
    categoria_id INTEGER NOT NULL,
    notas TEXT,
    cantidad_total INTEGER NOT NULL DEFAULT 0,
    cantidad_disponible INTEGER NOT NULL DEFAULT 0,
    cantidad_prestada INTEGER NOT NULL DEFAULT 0,
    cantidad_daniada INTEGER NOT NULL DEFAULT 0,
    cantidad_faltante INTEGER NOT NULL DEFAULT 0,
    prestable INTEGER NOT NULL DEFAULT 1,
    control_individual INTEGER NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE articulo_unidad (
    id INTEGER PRIMARY KEY,
    articulo_id INTEGER NOT NULL,
    codigo TEXT NOT NULL,
    estado TEXT NOT NULL,
    prestamo_detalle_id INTEGER,
    creado_en TEXT NOT NULL DEFAULT ''
);
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
CREATE TABLE incidente (
    id INTEGER PRIMARY KEY,
    tipo TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'abierto',
    articulo_unidad_id INTEGER,
    creado_en TEXT NOT NULL DEFAULT ''
);
CREATE TABLE movimiento_inventario (id INTEGER PRIMARY KEY);
CREATE TABLE configuracion (id INTEGER PRIMARY KEY);
";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

fn fresh_temp_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("stocklend_inventario_{tag}"));
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

/// Invoca un comando de Inventario (o el Panel) por el despachador IPC real.
fn invoke(cmd: &str) -> Result<serde_json::Value, serde_json::Value> {
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![
            stocklend_lib::commands::dashboard::obtener_panel,
            stocklend_lib::commands::inventory::listar_articulos,
            stocklend_lib::commands::inventory::listar_unidades,
            stocklend_lib::commands::inventory::listar_categorias,
            stocklend_lib::commands::inventory::obtener_estadisticas_inventario,
        ])
        .build(mock_context(noop_assets()))
        .expect("mock app");
    let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .expect("mock webview");
    let res = tauri::test::get_ipc_response(
        &webview,
        InvokeRequest {
            cmd: cmd.into(),
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

/// Igual que `invoke`, fijando (o limpiando) `STOCKLEND_DATA_DIR`.
fn invoke_with_data_dir(cmd: &str, dir: Option<&Path>) -> Result<serde_json::Value, serde_json::Value> {
    let _guard = ENV_LOCK.lock().unwrap();
    match dir {
        Some(d) => unsafe { std::env::set_var(paths::ENV_DATA_DIR, d) },
        None => unsafe { std::env::remove_var(paths::ENV_DATA_DIR) },
    }
    let out = invoke(cmd);
    unsafe { std::env::remove_var(paths::ENV_DATA_DIR) };
    out
}

// ---------------------------------------------------------------------------
// Base válida pero vacía
// ---------------------------------------------------------------------------

#[test]
fn inventario_base_vacia_devuelve_listas_vacias_y_cero() {
    let dir = dir_con_esquema("vacia");

    for cmd in ["listar_articulos", "listar_unidades", "listar_categorias"] {
        let json = invoke_with_data_dir(cmd, Some(&dir)).expect("debe ser Ok");
        assert_eq!(json.as_array().unwrap().len(), 0, "{cmd} json={json}");
    }

    let stats = invoke_with_data_dir("obtener_estadisticas_inventario", Some(&dir)).expect("debe ser Ok");
    for k in [
        "articulos_registrados",
        "articulos_activos",
        "unidades_totales",
        "unidades_disponibles",
        "unidades_prestadas",
        "unidades_daniadas",
        "unidades_faltantes",
    ] {
        assert_eq!(stats[k], 0, "campo {k} json={stats}");
    }

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Artículos
// ---------------------------------------------------------------------------

#[test]
fn inventario_articulos_con_categoria_contadores_e_indicadores() {
    let dir = dir_con_esquema("articulos");
    {
        let conn = abrir_escritura(&dir);
        conn.execute_batch(
            "INSERT INTO categoria (id, nombre, descripcion, activo) VALUES (1, 'Calzado', 'Todo el calzado', 1);
             INSERT INTO articulo (id, codigo, nombre, categoria_id, cantidad_total, cantidad_disponible,
                                   cantidad_prestada, cantidad_daniada, cantidad_faltante, prestable,
                                   control_individual, activo)
                VALUES (1, 'ART-001', 'Zapato de seguridad', 1, 10, 7, 2, 1, 0, 1, 0, 1);
             INSERT INTO articulo (id, codigo, nombre, categoria_id, cantidad_total, cantidad_disponible,
                                   cantidad_prestada, cantidad_daniada, cantidad_faltante, prestable,
                                   control_individual, activo)
                VALUES (2, NULL, 'Camiseta', 1, 5, 5, 0, 0, 0, 0, 1, 0);",
        )
        .unwrap();
    }

    let json = invoke_with_data_dir("listar_articulos", Some(&dir)).expect("debe ser Ok");
    let arr = json.as_array().unwrap();
    assert_eq!(arr.len(), 2, "json={json}");

    // Orden por nombre (NOCASE): Camiseta antes que Zapato de seguridad.
    assert_eq!(arr[0]["id"], 2);
    assert_eq!(arr[0]["codigo"], serde_json::Value::Null);
    assert_eq!(arr[0]["nombre"], "Camiseta");
    assert_eq!(arr[0]["categoria"], "Calzado");
    assert_eq!(arr[0]["cantidad_total"], 5);
    assert_eq!(arr[0]["cantidad_disponible"], 5);
    assert_eq!(arr[0]["prestable"], false);
    assert_eq!(arr[0]["control_individual"], true);
    assert_eq!(arr[0]["activo"], false);

    assert_eq!(arr[1]["id"], 1);
    assert_eq!(arr[1]["codigo"], "ART-001");
    assert_eq!(arr[1]["categoria"], "Calzado");
    assert_eq!(arr[1]["cantidad_total"], 10);
    assert_eq!(arr[1]["cantidad_disponible"], 7);
    assert_eq!(arr[1]["cantidad_prestada"], 2);
    assert_eq!(arr[1]["cantidad_daniada"], 1);
    assert_eq!(arr[1]["cantidad_faltante"], 0);
    assert_eq!(arr[1]["prestable"], true);
    assert_eq!(arr[1]["control_individual"], false);
    assert_eq!(arr[1]["activo"], true);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

#[test]
fn inventario_categorias_cuentan_articulos_incluidos_inactivos() {
    let dir = dir_con_esquema("categorias");
    {
        let conn = abrir_escritura(&dir);
        conn.execute_batch(
            "INSERT INTO categoria (id, nombre, descripcion, activo) VALUES (1, 'Calzado', 'Todo el calzado', 1);
             INSERT INTO categoria (id, nombre, descripcion, activo) VALUES (2, 'Papelería', NULL, 0);
             INSERT INTO articulo (id, nombre, categoria_id, activo) VALUES (1, 'A', 1, 1);
             INSERT INTO articulo (id, nombre, categoria_id, activo) VALUES (2, 'B', 1, 0);
             INSERT INTO articulo (id, nombre, categoria_id, activo) VALUES (3, 'C', 2, 1);",
        )
        .unwrap();
    }

    let json = invoke_with_data_dir("listar_categorias", Some(&dir)).expect("debe ser Ok");
    let arr = json.as_array().unwrap();
    assert_eq!(arr.len(), 2, "json={json}");

    assert_eq!(arr[0]["id"], 1);
    assert_eq!(arr[0]["nombre"], "Calzado");
    assert_eq!(arr[0]["descripcion"], "Todo el calzado");
    assert_eq!(arr[0]["activo"], true);
    assert_eq!(arr[0]["articulos"], 2, "cuenta activos e inactivos: {json}");

    assert_eq!(arr[1]["id"], 2);
    assert_eq!(arr[1]["nombre"], "Papelería");
    assert_eq!(arr[1]["descripcion"], serde_json::Value::Null);
    assert_eq!(arr[1]["activo"], false);
    assert_eq!(arr[1]["articulos"], 1);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Unidades
// ---------------------------------------------------------------------------

#[test]
fn inventario_unidades_con_prestamo_estudiante_y_sin_asociaciones() {
    let dir = dir_con_esquema("unidades");
    {
        let conn = abrir_escritura(&dir);
        conn.execute_batch(
            "INSERT INTO categoria (id, nombre) VALUES (1, 'Calzado');
             INSERT INTO articulo (id, nombre, categoria_id) VALUES (1, 'Zapato', 1);
             INSERT INTO estudiante (id, nombres, apellidos) VALUES (1, 'Ana', 'Perez');
             INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, estado)
                VALUES (1, 'P-0001', 1, date('now', 'localtime') || 'T09:00:00', 'activo');
             INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada) VALUES (1, 1, 1, 1);
             INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id)
                VALUES (1, 1, 'U-001', 'prestada', 1);
             INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id)
                VALUES (2, 1, 'U-002', 'disponible', NULL);",
        )
        .unwrap();
    }

    let json = invoke_with_data_dir("listar_unidades", Some(&dir)).expect("debe ser Ok");
    let arr = json.as_array().unwrap();
    assert_eq!(arr.len(), 2, "json={json}");

    let u1 = &arr[0];
    assert_eq!(u1["id"], 1);
    assert_eq!(u1["codigo"], "U-001");
    assert_eq!(u1["articulo_id"], 1);
    assert_eq!(u1["articulo"], "Zapato");
    assert_eq!(u1["categoria"], "Calzado");
    assert_eq!(u1["estado"], "prestada");
    assert_eq!(u1["prestamo_detalle_id"], 1);
    assert_eq!(u1["prestamo_id"], 1);
    assert_eq!(u1["prestamo_folio"], "P-0001");
    assert_eq!(u1["prestamo_estado"], "activo");
    assert_eq!(u1["estudiante_id"], 1);
    assert_eq!(u1["estudiante"], "Ana Perez");
    assert_eq!(u1["incidente_id"], serde_json::Value::Null);
    assert!(u1["prestamo_fecha"].as_str().unwrap().len() == 10, "fecha ISO: {u1}");

    let u2 = &arr[1];
    assert_eq!(u2["id"], 2);
    assert_eq!(u2["estado"], "disponible");
    for k in [
        "prestamo_detalle_id",
        "prestamo_id",
        "prestamo_folio",
        "prestamo_estado",
        "prestamo_fecha",
        "estudiante_id",
        "estudiante",
        "incidente_id",
        "incidente_tipo",
        "incidente_estado",
    ] {
        assert_eq!(u2[k], serde_json::Value::Null, "campo {k} json={json}");
    }

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn inventario_unidad_prioriza_incidente_abierto() {
    let dir = dir_con_esquema("incidentes");
    {
        let conn = abrir_escritura(&dir);
        conn.execute_batch(
            "INSERT INTO categoria (id, nombre) VALUES (1, 'General');
             INSERT INTO articulo (id, nombre, categoria_id) VALUES (1, 'Equipo', 1);
             INSERT INTO articulo_unidad (id, articulo_id, codigo, estado) VALUES (1, 1, 'U-001', 'danada');
             INSERT INTO articulo_unidad (id, articulo_id, codigo, estado) VALUES (2, 1, 'U-002', 'faltante');
             -- U-001: un incidente abierto antiguo y uno resuelto más reciente.
             INSERT INTO incidente (id, tipo, estado, articulo_unidad_id, creado_en)
                VALUES (1, 'perdida', 'resuelto', 1, '2026-10-11T10:00:00');
             INSERT INTO incidente (id, tipo, estado, articulo_unidad_id, creado_en)
                VALUES (2, 'danio', 'abierto', 1, '2026-10-01T10:00:00');
             -- U-002: un único incidente resuelto.
             INSERT INTO incidente (id, tipo, estado, articulo_unidad_id, creado_en)
                VALUES (3, 'perdida', 'resuelto', 2, '2026-10-05T10:00:00');",
        )
        .unwrap();
    }

    let json = invoke_with_data_dir("listar_unidades", Some(&dir)).expect("debe ser Ok");
    let arr = json.as_array().unwrap();
    assert_eq!(arr.len(), 2, "json={json}");

    assert_eq!(arr[0]["codigo"], "U-001");
    assert_eq!(arr[0]["incidente_id"], 2, "el abierto tiene prioridad: {json}");
    assert_eq!(arr[0]["incidente_tipo"], "danio");
    assert_eq!(arr[0]["incidente_estado"], "abierto");

    assert_eq!(arr[1]["codigo"], "U-002");
    assert_eq!(arr[1]["incidente_id"], 3);
    assert_eq!(arr[1]["incidente_estado"], "resuelto");

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Estadísticas
// ---------------------------------------------------------------------------

#[test]
fn inventario_estadisticas_coinciden_con_el_panel() {
    let dir = dir_con_esquema("estadisticas");
    {
        let conn = abrir_escritura(&dir);
        conn.execute_batch(
            "INSERT INTO categoria (id, nombre) VALUES (1, 'General');
             INSERT INTO articulo (id, nombre, categoria_id, cantidad_total, cantidad_disponible,
                                   cantidad_prestada, cantidad_daniada, cantidad_faltante, activo)
                VALUES (1, 'A', 1, 50, 25, 20, 5, 0, 1);
             INSERT INTO articulo (id, nombre, categoria_id, cantidad_total, cantidad_disponible,
                                   cantidad_prestada, cantidad_daniada, cantidad_faltante, activo)
                VALUES (2, 'B', 1, 120, 100, 20, 0, 0, 0);",
        )
        .unwrap();
    }

    let stats = invoke_with_data_dir("obtener_estadisticas_inventario", Some(&dir)).expect("Ok");
    assert_eq!(stats["articulos_registrados"], 2, "cuenta activos e inactivos: {stats}");
    assert_eq!(stats["articulos_activos"], 1);
    assert_eq!(stats["unidades_totales"], 170);
    assert_eq!(stats["unidades_disponibles"], 125);
    assert_eq!(stats["unidades_prestadas"], 40);
    assert_eq!(stats["unidades_daniadas"], 5);
    assert_eq!(stats["unidades_faltantes"], 0);

    let suma = stats["unidades_disponibles"].as_i64().unwrap()
        + stats["unidades_prestadas"].as_i64().unwrap()
        + stats["unidades_daniadas"].as_i64().unwrap()
        + stats["unidades_faltantes"].as_i64().unwrap();
    assert_eq!(suma, stats["unidades_totales"].as_i64().unwrap(), "invariante");

    // No debe contradecir los contadores del Dashboard.
    let panel = invoke_with_data_dir("obtener_panel", Some(&dir)).expect("Ok");
    let p = &panel["estadisticas"];
    assert_eq!(stats["articulos_activos"], p["articulos_activos"], "panel={panel}");
    assert_eq!(stats["unidades_totales"], p["unidades_totales"]);
    assert_eq!(stats["unidades_disponibles"], p["unidades_disponibles"]);
    assert_eq!(stats["unidades_prestadas"], p["unidades_prestadas"]);
    assert_eq!(stats["unidades_daniadas"], p["unidades_daniadas"]);
    assert_eq!(stats["unidades_faltantes"], p["unidades_faltantes"]);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Estados de error
// ---------------------------------------------------------------------------

#[test]
fn inventario_base_ausente_es_error_y_no_crea_archivo() {
    let dir = fresh_temp_dir("ausente");
    for cmd in COMANDOS {
        let err = invoke_with_data_dir(cmd, Some(&dir)).expect_err("debe ser Err");
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
fn inventario_esquema_no_inicializado_es_error() {
    // Base vacía (sin tablas).
    let dir = fresh_temp_dir("sin_esquema");
    {
        let _ = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
    }
    for cmd in COMANDOS {
        let err = invoke_with_data_dir(cmd, Some(&dir)).expect_err("debe ser Err");
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
        conn.execute_batch("CREATE TABLE articulo (id INTEGER PRIMARY KEY);")
            .unwrap();
    }
    for cmd in COMANDOS {
        let err = invoke_with_data_dir(cmd, Some(&dir)).expect_err("debe ser Err");
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
fn inventario_no_modifica_el_archivo_sqlite() {
    let dir = dir_con_esquema("sin_cambios");
    {
        let conn = abrir_escritura(&dir);
        conn.execute_batch(
            "INSERT INTO categoria (id, nombre) VALUES (1, 'General');
             INSERT INTO articulo (id, nombre, categoria_id) VALUES (1, 'A', 1);
             INSERT INTO articulo_unidad (id, articulo_id, codigo, estado) VALUES (1, 1, 'U-001', 'disponible');",
        )
        .unwrap();
    }
    let ruta = dir.join(paths::DB_FILENAME);
    let antes = std::fs::read(&ruta).unwrap();

    for cmd in COMANDOS {
        let _ = invoke_with_data_dir(cmd, Some(&dir)).expect("debe ser Ok");
    }

    let despues = std::fs::read(&ruta).unwrap();
    assert_eq!(antes, despues, "la base no debe modificarse");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn inventario_base_real_es_ok_con_forma_valida() {
    let articulos = invoke_with_data_dir("listar_articulos", None).expect("artículos reales");
    let unidades = invoke_with_data_dir("listar_unidades", None).expect("unidades reales");
    let categorias = invoke_with_data_dir("listar_categorias", None).expect("categorías reales");
    let stats =
        invoke_with_data_dir("obtener_estadisticas_inventario", None).expect("estadísticas reales");

    let n_articulos = articulos.as_array().unwrap().len() as i64;
    assert_eq!(stats["articulos_registrados"].as_i64().unwrap(), n_articulos);

    // La suma de artículos por categoría coincide con el total de artículos.
    let suma_categorias: i64 = categorias
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c["articulos"].as_i64().unwrap())
        .sum();
    assert_eq!(suma_categorias, n_articulos);

    // Las unidades (si las hay) referencian artículos existentes.
    for u in unidades.as_array().unwrap() {
        assert!(u["codigo"].is_string());
        assert!(u["estado"].is_string());
        assert!(u["articulo"].is_string());
    }

    // Invariante del Dashboard.
    let suma = stats["unidades_disponibles"].as_i64().unwrap()
        + stats["unidades_prestadas"].as_i64().unwrap()
        + stats["unidades_daniadas"].as_i64().unwrap()
        + stats["unidades_faltantes"].as_i64().unwrap();
    assert_eq!(suma, stats["unidades_totales"].as_i64().unwrap());

    let panel = invoke_with_data_dir("obtener_panel", None).expect("panel real");
    assert_eq!(
        stats["unidades_totales"], panel["estadisticas"]["unidades_totales"],
        "no debe contradecir al Dashboard"
    );
    assert_eq!(
        stats["articulos_activos"], panel["estadisticas"]["articulos_activos"],
        "no debe contradecir al Dashboard"
    );
}
