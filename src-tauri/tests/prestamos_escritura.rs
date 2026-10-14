//! Tests de escritura de Préstamos (Etapa E1): comando `registrar_prestamo`
//! mediante el despachador IPC real de Tauri (runtime simulado), sobre bases
//! temporales con el **esquema real** (`stocklend/data/migrations/0001_inicial.sql`).
//! Nunca tocan la base real.
//!
//! Cubren: registro de un artículo por cantidad, de varios artículos, control
//! individual (unidades concretas), agrupación por artículo (RN-18), folio
//! correlativo (RN-20), fecha límite opcional (RN-25), estudiantes y artículos
//! inválidos, disponibilidad insuficiente, atomicidad (rollback completo y folio
//! no consumido) y los estados de error de apertura.
//!
//! Se ejecutan con: `cargo test` (desde `src-tauri`).

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::{params, Connection};
use serde_json::{json, Value};
use stocklend_lib::core::paths;
use tauri::ipc::CallbackFn;
use tauri::test::{mock_builder, mock_context, noop_assets, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::WebviewWindowBuilder;

/// `STOCKLEND_DATA_DIR` es global al proceso: serializa los tests que la tocan.
static ENV_LOCK: Mutex<()> = Mutex::new(());

/// Marca temporal usada en los `INSERT` de apoyo.
const AHORA: &str = "2026-01-01T10:00:00Z";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

fn fresh_temp_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("stocklend_prestamos_escritura_{tag}"));
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

/// Directorio temporal con el esquema real y el escenario de apoyo.
///
/// - Artículo 1: sin control individual, prestable y activo (10 disponibles).
/// - Artículo 2: control individual, prestable y activo (3 unidades disponibles).
/// - Artículo 3: inactivo.
/// - Artículo 4: no prestable.
/// - Artículo 5: control individual con contadores «desviados" respecto a sus
///   unidades (total 5 con una única unidad), para forzar un fallo tardío.
/// - Estudiante 1 activo, estudiante 2 inactivo.
fn base(tag: &str) -> PathBuf {
    let dir = fresh_temp_dir(tag);
    let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
    conn.execute_batch(&esquema_real()).unwrap();
    conn.execute_batch(&format!(
        "INSERT INTO categoria (id, nombre, activo, creado_en) VALUES (1, 'Cat', 1, '{AHORA}');

         INSERT INTO articulo (id, codigo, nombre, categoria_id, control_individual,
             prestable, activo, cantidad_total, cantidad_disponible, cantidad_prestada,
             cantidad_daniada, cantidad_faltante, creado_en, actualizado_en)
             VALUES (1, 'ART-1', 'Olla', 1, 0, 1, 1, 10, 10, 0, 0, 0, '{AHORA}', '{AHORA}');
         INSERT INTO articulo (id, codigo, nombre, categoria_id, control_individual,
             prestable, activo, cantidad_total, cantidad_disponible, cantidad_prestada,
             cantidad_daniada, cantidad_faltante, creado_en, actualizado_en)
             VALUES (2, 'ART-2', 'Cuchillo', 1, 1, 1, 1, 3, 3, 0, 0, 0, '{AHORA}', '{AHORA}');
         INSERT INTO articulo (id, codigo, nombre, categoria_id, control_individual,
             prestable, activo, cantidad_total, cantidad_disponible, cantidad_prestada,
             cantidad_daniada, cantidad_faltante, creado_en, actualizado_en)
             VALUES (3, 'ART-3', 'Inactivo', 1, 0, 1, 0, 5, 5, 0, 0, 0, '{AHORA}', '{AHORA}');
         INSERT INTO articulo (id, codigo, nombre, categoria_id, control_individual,
             prestable, activo, cantidad_total, cantidad_disponible, cantidad_prestada,
             cantidad_daniada, cantidad_faltante, creado_en, actualizado_en)
             VALUES (4, 'ART-4', 'NoPrestable', 1, 0, 0, 1, 5, 5, 0, 0, 0, '{AHORA}', '{AHORA}');
         INSERT INTO articulo (id, codigo, nombre, categoria_id, control_individual,
             prestable, activo, cantidad_total, cantidad_disponible, cantidad_prestada,
             cantidad_daniada, cantidad_faltante, creado_en, actualizado_en)
             VALUES (5, 'ART-5', 'Desajustado', 1, 1, 1, 1, 5, 5, 0, 0, 0, '{AHORA}', '{AHORA}');

         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, creado_en, actualizado_en)
             VALUES (1, 2, 'U-001', 'disponible', '{AHORA}', '{AHORA}');
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, creado_en, actualizado_en)
             VALUES (2, 2, 'U-002', 'disponible', '{AHORA}', '{AHORA}');
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, creado_en, actualizado_en)
             VALUES (3, 2, 'U-003', 'disponible', '{AHORA}', '{AHORA}');
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, creado_en, actualizado_en)
             VALUES (50, 5, 'D-050', 'disponible', '{AHORA}', '{AHORA}');

         INSERT INTO estudiante (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en)
             VALUES (1, '2023-0001', 'Ana', 'Ramirez', 1, '{AHORA}', '{AHORA}');
         INSERT INTO estudiante (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en)
             VALUES (2, '2023-0002', 'Luis', 'Alvarez', 0, '{AHORA}', '{AHORA}');",
    ))
    .unwrap();
    dir
}

/// Despacha un comando por el IPC real con la app simulada.
fn despachar(args: Option<Value>) -> Result<Value, Value> {
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![
            stocklend_lib::commands::prestamos::registrar_prestamo,
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
            cmd: "registrar_prestamo".into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body,
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_string(),
        },
    );
    match res {
        Ok(cuerpo) => Ok(cuerpo.deserialize::<Value>().unwrap()),
        Err(err) => Err(err),
    }
}

/// Invoca `registrar_prestamo` fijando `STOCKLEND_DATA_DIR` a un temporal.
fn registrar(dir: &Path, args: Value) -> Result<Value, Value> {
    let _guard = ENV_LOCK.lock().unwrap();
    unsafe { std::env::set_var(paths::ENV_DATA_DIR, dir) };
    let out = despachar(Some(args));
    unsafe { std::env::remove_var(paths::ENV_DATA_DIR) };
    out
}

fn conectar(dir: &Path) -> Connection {
    Connection::open(dir.join(paths::DB_FILENAME)).unwrap()
}

fn anio(conn: &Connection) -> String {
    conn.query_row("SELECT strftime('%Y', 'now', 'localtime')", [], |r| r.get(0))
        .unwrap()
}

fn contadores(conn: &Connection, id: i64) -> (i64, i64, i64, i64, i64) {
    conn.query_row(
        "SELECT cantidad_total, cantidad_disponible, cantidad_prestada, \
                cantidad_daniada, cantidad_faltante FROM articulo WHERE id = ?1",
        [id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
    )
    .unwrap()
}

fn valor_config(conn: &Connection, clave: &str) -> Option<String> {
    conn.query_row("SELECT valor FROM configuracion WHERE clave = ?1", [clave], |r| {
        r.get(0)
    })
    .ok()
}

fn contar(conn: &Connection, tabla: &str) -> i64 {
    conn.query_row(&format!("SELECT COUNT(*) FROM {tabla}"), [], |r| r.get(0))
        .unwrap()
}

fn unidad_estado(conn: &Connection, id: i64) -> (String, Option<i64>) {
    conn.query_row(
        "SELECT estado, prestamo_detalle_id FROM articulo_unidad WHERE id = ?1",
        [id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )
    .unwrap()
}

fn detalle_id(conn: &Connection, prestamo_id: i64, articulo_id: i64) -> i64 {
    conn.query_row(
        "SELECT id FROM prestamo_detalle WHERE prestamo_id = ?1 AND articulo_id = ?2",
        params![prestamo_id, articulo_id],
        |r| r.get(0),
    )
    .unwrap()
}

fn linea_cantidad(articulo_id: i64, cantidad: i64) -> Value {
    json!({ "articulo_id": articulo_id, "cantidad": cantidad })
}

fn linea_unidades(articulo_id: i64, unidad_ids: &[i64]) -> Value {
    json!({ "articulo_id": articulo_id, "unidad_ids": unidad_ids })
}

fn args(estudiante_id: i64, lineas: Vec<Value>) -> Value {
    json!({
        "datos": {
            "estudiante_id": estudiante_id,
            "lineas": lineas,
            "fecha_limite": Value::Null,
            "comentario": Value::Null,
        }
    })
}

fn args_fecha(estudiante_id: i64, lineas: Vec<Value>, fecha_limite: Value) -> Value {
    json!({
        "datos": {
            "estudiante_id": estudiante_id,
            "lineas": lineas,
            "fecha_limite": fecha_limite,
            "comentario": Value::Null,
        }
    })
}

fn mensaje(res: Result<Value, Value>) -> String {
    res.expect_err("se esperaba un error").as_str().unwrap_or_default().to_string()
}

// ---------------------------------------------------------------------------
// Registro básico
// ---------------------------------------------------------------------------

#[test]
fn registro_simple_descuenta_disponible_y_aumenta_prestada() {
    let dir = base("simple");
    let res = registrar(&dir, args(1, vec![linea_cantidad(1, 2)])).expect("debe ser Ok");

    let conn = conectar(&dir);
    let folio = format!("PRE-{}-000001", anio(&conn));
    assert_eq!(res["folio"], folio, "json={res}");
    assert_eq!(res["estado"], "activo");
    assert_eq!(res["fecha_limite"], Value::Null);
    assert_eq!(res["vencido"], false);
    assert_eq!(res["renglones"], 1);
    assert_eq!(res["unidades_prestadas"], 2);
    let lineas = res["lineas"].as_array().unwrap();
    assert_eq!(lineas.len(), 1);
    assert_eq!(lineas[0]["articulo_id"], 1);
    assert_eq!(lineas[0]["cantidad_prestada"], 2);
    assert_eq!(lineas[0]["cantidad_pendiente"], 2);
    assert_eq!(lineas[0]["estado"], "pendiente");

    assert_eq!(contadores(&conn, 1), (10, 8, 2, 0, 0));
    assert_eq!(contar(&conn, "movimiento_inventario"), 1);
    let (tipo, referencia_tipo, referencia_id, cantidad): (String, String, i64, i64) = conn
        .query_row(
            "SELECT tipo, referencia_tipo, referencia_id, cantidad FROM movimiento_inventario",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .unwrap();
    assert_eq!(tipo, "prestamo");
    assert_eq!(referencia_tipo, "prestamo");
    assert_eq!(referencia_id, res["id"].as_i64().unwrap());
    assert_eq!(cantidad, 2);
    assert_eq!(
        valor_config(&conn, &format!("folio_prestamo_{}", anio(&conn))).as_deref(),
        Some("1")
    );

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn registro_multiarticulo_crea_un_renglon_por_articulo() {
    let dir = base("multi");
    let res = registrar(
        &dir,
        args(1, vec![linea_cantidad(1, 2), linea_unidades(2, &[1, 2])]),
    )
    .expect("debe ser Ok");

    assert_eq!(res["renglones"], 2);
    assert_eq!(res["unidades_prestadas"], 4);

    let conn = conectar(&dir);
    assert_eq!(contadores(&conn, 1), (10, 8, 2, 0, 0));
    assert_eq!(contadores(&conn, 2), (3, 1, 2, 0, 0));

    let prestamo_id = res["id"].as_i64().unwrap();
    let detalle_art2 = detalle_id(&conn, prestamo_id, 2);
    assert_eq!(unidad_estado(&conn, 1), ("prestada".to_string(), Some(detalle_art2)));
    assert_eq!(unidad_estado(&conn, 2), ("prestada".to_string(), Some(detalle_art2)));
    assert_eq!(unidad_estado(&conn, 3), ("disponible".to_string(), None));
    assert_eq!(contar(&conn, "movimiento_inventario"), 3, "1 por cantidad + 2 por unidad");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn estudiante_con_un_prestamo_activo_puede_recibir_otro() {
    let dir = base("rn16");
    let primero = registrar(&dir, args(1, vec![linea_cantidad(1, 1)])).expect("primero");
    let segundo = registrar(&dir, args(1, vec![linea_cantidad(1, 1)])).expect("segundo");

    let conn = conectar(&dir);
    let anio = anio(&conn);
    assert_eq!(primero["folio"], format!("PRE-{anio}-000001"));
    assert_eq!(segundo["folio"], format!("PRE-{anio}-000002"));
    assert_eq!(contar(&conn, "prestamo"), 2, "RN-16: dos préstamos activos");
    assert_eq!(valor_config(&conn, &format!("folio_prestamo_{anio}")).as_deref(), Some("2"));

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Validaciones de estudiante y artículo
// ---------------------------------------------------------------------------

#[test]
fn estudiante_inexistente_o_inactivo_se_rechaza() {
    let dir = base("estudiante");

    let msg = mensaje(registrar(&dir, args(999, vec![linea_cantidad(1, 1)])));
    assert!(msg.contains("No existe el estudiante"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(2, vec![linea_cantidad(1, 1)])));
    assert!(msg.contains("inactivo"), "mensaje: {msg}");

    let conn = conectar(&dir);
    assert_eq!(contar(&conn, "prestamo"), 0);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn articulo_inexistente_inactivo_o_no_prestable_se_rechaza() {
    let dir = base("articulo");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_cantidad(999, 1)])));
    assert!(msg.contains("No existe el artículo"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_cantidad(3, 1)])));
    assert!(msg.contains("desactivado"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_cantidad(4, 1)])));
    assert!(msg.contains("no puede prestarse"), "mensaje: {msg}");

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Validaciones de cantidades y líneas
// ---------------------------------------------------------------------------

#[test]
fn cantidad_cero_negativa_o_ausente_se_rechaza() {
    let dir = base("cantidad");
    for lineas in [
        vec![linea_cantidad(1, 0)],
        vec![linea_cantidad(1, -3)],
        vec![json!({ "articulo_id": 1 })],
    ] {
        let msg = mensaje(registrar(&dir, args(1, lineas)));
        assert!(msg.contains("mayor que cero"), "mensaje: {msg}");
    }
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn lista_vacia_se_rechaza() {
    let dir = base("vacia");
    let msg = mensaje(registrar(&dir, args(1, vec![])));
    assert!(msg.contains("al menos un artículo"), "mensaje: {msg}");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn disponibilidad_insuficiente_no_deja_rastro() {
    let dir = base("insuficiente");
    let msg = mensaje(registrar(&dir, args(1, vec![linea_cantidad(1, 11)])));
    assert!(msg.contains("Solo hay 10"), "mensaje: {msg}");

    let conn = conectar(&dir);
    assert_eq!(contar(&conn, "prestamo"), 0);
    assert_eq!(contar(&conn, "movimiento_inventario"), 0);
    assert_eq!(contadores(&conn, 1), (10, 10, 0, 0, 0));
    assert!(valor_config(&conn, &format!("folio_prestamo_{}", anio(&conn))).is_none());
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn articulo_repetido_se_agrupa_y_suma() {
    let dir = base("rn18");
    let res = registrar(
        &dir,
        args(1, vec![linea_cantidad(1, 1), linea_cantidad(1, 2)]),
    )
    .expect("debe ser Ok");

    assert_eq!(res["renglones"], 1, "RN-18: un solo renglón");
    assert_eq!(res["lineas"][0]["cantidad_prestada"], 3);
    assert_eq!(res["unidades_prestadas"], 3);

    let conn = conectar(&dir);
    assert_eq!(contar(&conn, "prestamo_detalle"), 1);
    assert_eq!(contar(&conn, "movimiento_inventario"), 1, "un único movimiento de 3");
    assert_eq!(contadores(&conn, 1), (10, 7, 3, 0, 0));
    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Fecha límite (RN-25)
// ---------------------------------------------------------------------------

#[test]
fn fecha_limite_ausente_valida_e_invalida() {
    let dir = base("fecha");

    let sin = registrar(&dir, args(1, vec![linea_cantidad(1, 1)])).expect("sin límite");
    assert_eq!(sin["fecha_limite"], Value::Null);

    let con = registrar(
        &dir,
        args_fecha(1, vec![linea_cantidad(1, 1)], json!("2999-12-31")),
    )
    .expect("fecha válida");
    assert_eq!(con["fecha_limite"], "2999-12-31");

    let msg = mensaje(registrar(
        &dir,
        args_fecha(1, vec![linea_cantidad(1, 1)], json!("no-es-una-fecha")),
    ));
    assert!(msg.contains("no es una fecha válida"), "mensaje: {msg}");

    let msg = mensaje(registrar(
        &dir,
        args_fecha(1, vec![linea_cantidad(1, 1)], json!("2000-01-01")),
    ));
    assert!(msg.contains("anterior"), "mensaje: {msg}");

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Folio correlativo (RN-20)
// ---------------------------------------------------------------------------

#[test]
fn folios_consecutivos_y_sin_consumo_al_fallar() {
    let dir = base("folio");
    let conn = conectar(&dir);
    let anio = anio(&conn);
    let clave = format!("folio_prestamo_{anio}");

    let uno = registrar(&dir, args(1, vec![linea_cantidad(1, 1)])).expect("uno");
    assert_eq!(uno["folio"], format!("PRE-{anio}-000001"));
    assert_eq!(valor_config(&conn, &clave).as_deref(), Some("1"));

    let _ = mensaje(registrar(&dir, args(1, vec![linea_cantidad(1, 99)])));
    assert_eq!(
        valor_config(&conn, &clave).as_deref(),
        Some("1"),
        "un fallo no consume el correlativo"
    );

    let dos = registrar(&dir, args(1, vec![linea_cantidad(1, 1)])).expect("dos");
    assert_eq!(dos["folio"], format!("PRE-{anio}-000002"));

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Atomicidad
// ---------------------------------------------------------------------------

#[test]
fn fallo_a_mitad_de_la_transaccion_revierte_todo() {
    let dir = base("rollback");

    // La segunda línea (artículo con control individual "desajustado") pasa la
    // validación pero rompe la conciliación RN-61 al escribir: la primera línea
    // ya escrita debe revertirse entera.
    let msg = mensaje(registrar(
        &dir,
        args(1, vec![linea_cantidad(1, 1), linea_unidades(5, &[50])]),
    ));
    assert!(msg.contains("no coinciden"), "mensaje: {msg}");

    let conn = conectar(&dir);
    assert_eq!(contar(&conn, "prestamo"), 0, "no debe quedar cabecera");
    assert_eq!(contar(&conn, "prestamo_detalle"), 0, "ni renglones");
    assert_eq!(contar(&conn, "movimiento_inventario"), 0, "ni movimientos");
    assert_eq!(contadores(&conn, 1), (10, 10, 0, 0, 0), "contadores intactos");
    assert_eq!(
        unidad_estado(&conn, 50),
        ("disponible".to_string(), None),
        "la unidad no debe quedar prestada"
    );
    assert!(valor_config(&conn, &format!("folio_prestamo_{}", anio(&conn))).is_none());

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Control individual (RN-50, RN-52, RN-53)
// ---------------------------------------------------------------------------

#[test]
fn control_individual_presta_unidades_concretas() {
    let dir = base("unidades");
    let res = registrar(&dir, args(1, vec![linea_unidades(2, &[1, 3])])).expect("debe ser Ok");

    let conn = conectar(&dir);
    assert_eq!(res["lineas"][0]["cantidad_prestada"], 2);
    let codigos: Vec<&str> = res["lineas"][0]["unidades"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c.as_str().unwrap())
        .collect();
    assert_eq!(codigos, vec!["U-001", "U-003"]);

    let prestamo_id = res["id"].as_i64().unwrap();
    let detalle = detalle_id(&conn, prestamo_id, 2);
    assert_eq!(unidad_estado(&conn, 1), ("prestada".to_string(), Some(detalle)));
    assert_eq!(unidad_estado(&conn, 3), ("prestada".to_string(), Some(detalle)));
    assert_eq!(unidad_estado(&conn, 2), ("disponible".to_string(), None));
    assert_eq!(contadores(&conn, 2), (3, 1, 2, 0, 0));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn control_individual_rechaza_unidades_incorrectas() {
    let dir = base("unidades_err");

    let msg = mensaje(registrar(&dir, args(1, vec![json!({ "articulo_id": 2, "cantidad": 2 })])));
    assert!(msg.contains("control individual"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_unidades(2, &[])])));
    assert!(msg.contains("indica las unidades"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_unidades(2, &[1, 1])])));
    assert!(msg.contains("más de una vez"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_unidades(2, &[999])])));
    assert!(msg.contains("No existe la unidad"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_unidades(2, &[50])])));
    assert!(msg.contains("no pertenece"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_unidades(1, &[1])])));
    assert!(msg.contains("no tiene control individual"), "mensaje: {msg}");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn no_se_puede_prestar_una_unidad_ya_prestada() {
    let dir = base("unidad_ocupada");

    registrar(&dir, args(1, vec![linea_unidades(2, &[1])])).expect("primera vez");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_unidades(2, &[1])])));
    assert!(msg.contains("no está disponible"), "mensaje: {msg}");

    let conn = conectar(&dir);
    assert_eq!(contar(&conn, "prestamo"), 1);
    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Apertura
// ---------------------------------------------------------------------------

#[test]
fn base_ausente_es_error_y_no_crea_archivo() {
    let dir = fresh_temp_dir("ausente");
    let msg = mensaje(registrar(&dir, args(1, vec![linea_cantidad(1, 1)])));
    assert!(msg.contains("No se encontró"), "mensaje: {msg}");
    assert!(!dir.join(paths::DB_FILENAME).exists());
    let _ = std::fs::remove_dir_all(&dir);
}
