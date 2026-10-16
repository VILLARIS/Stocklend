//! Tests de escritura de Devoluciones (Etapa E1): comando `registrar_devolucion`
//! mediante el despachador IPC real de Tauri (runtime simulado), sobre bases
//! temporales con el **esquema real** (`stocklend/data/migrations/0001_inicial.sql`).
//! Nunca tocan la base real.
//!
//! Cubren: devolución completa y parcial por cantidad, varias devoluciones
//! sucesivas, cierre automático (RN-35) y permanencia activa con pendientes
//! (RN-36), varios renglones, control individual con unidades concretas,
//! validaciones de cantidades (negativas, cero, superar el pendiente), préstamo
//! inexistente / cerrado / anulado / sin pendientes, renglón ajeno o inexistente,
//! daño y pérdida que nunca van a `disponible` (RN-31, RN-32), incidentes
//! obligatorios (RN-33), unidad duplicada / ajena / ya devuelta, ausencia de doble
//! ajuste de inventario y atomicidad (rollback completo).
//!
//! Se ejecutan con: `cargo test` (desde `src-tauri`).

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;
use serde_json::{json, Value};
use stocklend_lib::core::paths;
use tauri::ipc::CallbackFn;
use tauri::test::{mock_builder, mock_context, noop_assets, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::WebviewWindowBuilder;

/// `STOCKLEND_DATA_DIR` es global al proceso: serializa los tests que la tocan.
static ENV_LOCK: Mutex<()> = Mutex::new(());

/// Marca temporal usada en los `INSERT` de apoyo (prestamos.rs usa `Z`).
const AHORA: &str = "2026-01-01T10:00:00Z";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

fn fresh_temp_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("stocklend_devoluciones_escritura_{tag}"));
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

/// Directorio temporal con el esquema real y el escenario de devoluciones.
///
/// - Artículo 1 «Olla»: sin control individual (30 totales, 6 prestadas).
/// - Artículo 2 «Cuchillo»: control individual (3 unidades `U-001..003`).
/// - Artículo 3 «Desajustado»: control individual con contadores incoherentes,
///   para forzar un fallo tardío tras aplicar un movimiento.
/// - Préstamo 1 `activo` estudiante 1: renglones de Olla (1), Cuchillo (2) y
///   Desajustado (8).
/// - Préstamo 2 `cerrado`, préstamo 3 `anulado`, préstamo 4 `activo` sin
///   pendientes, préstamos 5 y 6 `activo`.
/// - Estudiante 2 activo (para probar responsable ajeno).
fn base(tag: &str) -> PathBuf {
    let dir = fresh_temp_dir(tag);
    let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
    conn.execute_batch(&esquema_real()).unwrap();
    conn.execute_batch(&format!(
        "INSERT INTO categoria (id, nombre, activo, creado_en) VALUES (1, 'General', 1, '{AHORA}');

         INSERT INTO articulo (id, codigo, nombre, categoria_id, control_individual,
             prestable, activo, cantidad_total, cantidad_disponible, cantidad_prestada,
             cantidad_daniada, cantidad_faltante, creado_en, actualizado_en)
             VALUES (1, 'ART-1', 'Olla', 1, 0, 1, 1, 30, 24, 6, 0, 0, '{AHORA}', '{AHORA}');
         INSERT INTO articulo (id, codigo, nombre, categoria_id, control_individual,
             prestable, activo, cantidad_total, cantidad_disponible, cantidad_prestada,
             cantidad_daniada, cantidad_faltante, creado_en, actualizado_en)
             VALUES (2, 'ART-2', 'Cuchillo', 1, 1, 1, 1, 3, 0, 3, 0, 0, '{AHORA}', '{AHORA}');
         INSERT INTO articulo (id, codigo, nombre, categoria_id, control_individual,
             prestable, activo, cantidad_total, cantidad_disponible, cantidad_prestada,
             cantidad_daniada, cantidad_faltante, creado_en, actualizado_en)
             VALUES (3, 'ART-3', 'Desajustado', 1, 1, 1, 1, 5, 5, 0, 0, 0, '{AHORA}', '{AHORA}');

         INSERT INTO estudiante (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en)
             VALUES (1, '2023-0001', 'Ana', 'Ramirez', 1, '{AHORA}', '{AHORA}');
         INSERT INTO estudiante (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en)
             VALUES (2, '2023-0002', 'Luis', 'Alvarez', 1, '{AHORA}', '{AHORA}');

         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, comentario, creado_en)
             VALUES (1, 'PRE-2026-000001', 1, '2026-10-10T09:00:00', '2999-12-31', 'activo', 'Lab', '{AHORA}');
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en, cerrado_en)
             VALUES (2, 'PRE-2026-000002', 1, '2026-10-05T09:00:00', '2999-12-31', 'cerrado', '{AHORA}', '2026-10-06T09:00:00');
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
             VALUES (3, 'PRE-2026-000003', 1, '2026-10-05T09:00:00', '2999-12-31', 'anulado', '{AHORA}');
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
             VALUES (4, 'PRE-2026-000004', 1, '2026-10-05T09:00:00', '2999-12-31', 'activo', '{AHORA}');
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
             VALUES (5, 'PRE-2026-000005', 1, '2026-10-05T09:00:00', '2999-12-31', 'activo', '{AHORA}');
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
             VALUES (6, 'PRE-2026-000006', 1, '2026-10-07T09:00:00', '2999-12-31', 'activo', '{AHORA}');

         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (1, 1, 1, 6, 0, 0, 0, 'pendiente');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (2, 1, 2, 3, 0, 0, 0, 'pendiente');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (3, 2, 1, 2, 2, 0, 0, 'devuelto');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (4, 3, 1, 2, 0, 0, 0, 'pendiente');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (5, 4, 1, 1, 1, 0, 0, 'devuelto');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (6, 5, 3, 1, 0, 0, 0, 'pendiente');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (7, 6, 1, 2, 0, 0, 0, 'pendiente');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (8, 1, 3, 1, 0, 0, 0, 'pendiente');

         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en)
             VALUES (1, 2, 'U-001', 'prestada', 2, '{AHORA}', '{AHORA}');
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en)
             VALUES (2, 2, 'U-002', 'prestada', 2, '{AHORA}', '{AHORA}');
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en)
             VALUES (3, 2, 'U-003', 'prestada', 2, '{AHORA}', '{AHORA}');
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en)
             VALUES (50, 3, 'D-050', 'prestada', 6, '{AHORA}', '{AHORA}');
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en)
             VALUES (51, 3, 'D-051', 'prestada', 8, '{AHORA}', '{AHORA}');",
    ))
    .unwrap();
    dir
}

/// Despacha `registrar_devolucion` por el IPC real con la app simulada.
fn despachar(args: Option<Value>) -> Result<Value, Value> {
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![
            stocklend_lib::commands::devoluciones::registrar_devolucion,
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
            cmd: "registrar_devolucion".into(),
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

/// Invoca `registrar_devolucion` fijando `STOCKLEND_DATA_DIR` a un temporal.
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

fn contadores(conn: &Connection, id: i64) -> (i64, i64, i64, i64, i64) {
    conn.query_row(
        "SELECT cantidad_total, cantidad_disponible, cantidad_prestada, \
                cantidad_daniada, cantidad_faltante FROM articulo WHERE id = ?1",
        [id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
    )
    .unwrap()
}

fn contar(conn: &Connection, tabla: &str) -> i64 {
    conn.query_row(&format!("SELECT COUNT(*) FROM {tabla}"), [], |r| r.get(0))
        .unwrap()
}

fn estado_prestamo(conn: &Connection, id: i64) -> String {
    conn.query_row("SELECT estado FROM prestamo WHERE id = ?1", [id], |r| r.get(0))
        .unwrap()
}

fn estado_detalle(conn: &Connection, id: i64) -> (String, i64, i64, i64, i64) {
    conn.query_row(
        "SELECT estado, cantidad_devuelta, cantidad_daniada, cantidad_perdida, \
                cantidad_prestada - cantidad_devuelta - cantidad_daniada - cantidad_perdida \
           FROM prestamo_detalle WHERE id = ?1",
        [id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
    )
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

/// Cuenta los movimientos de un tipo y suma sus cantidades.
fn movimiento(conn: &Connection, tipo: &str) -> (i64, i64) {
    conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(cantidad), 0) FROM movimiento_inventario WHERE tipo = ?1",
        [tipo],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )
    .unwrap()
}

fn linea_cantidad(detalle_id: i64, devuelta: i64, daniada: i64, perdida: i64) -> Value {
    json!({
        "prestamo_detalle_id": detalle_id,
        "cantidad_devuelta": devuelta,
        "cantidad_daniada": daniada,
        "cantidad_perdida": perdida,
    })
}

fn linea_unidades(detalle_id: i64, unidades: &[(i64, &str)]) -> Value {
    let lista: Vec<Value> = unidades
        .iter()
        .map(|(id, condicion)| json!({ "unidad_id": id, "condicion": condicion }))
        .collect();
    json!({ "prestamo_detalle_id": detalle_id, "unidades": lista })
}

fn args(prestamo_id: i64, lineas: Vec<Value>) -> Value {
    json!({ "datos": { "prestamo_id": prestamo_id, "lineas": lineas } })
}

fn mensaje(res: Result<Value, Value>) -> String {
    res.expect_err("se esperaba un error")
        .as_str()
        .unwrap_or_default()
        .to_string()
}

// ---------------------------------------------------------------------------
// Devolución por cantidad (sin control individual)
// ---------------------------------------------------------------------------

#[test]
fn devolucion_completa_cierra_el_prestamo() {
    let dir = base("completa");
    let res = registrar(&dir, args(6, vec![linea_cantidad(7, 2, 0, 0)])).expect("debe ser Ok");

    assert_eq!(res["prestamo_id"], 6, "json={res}");
    assert_eq!(res["folio"], "PRE-2026-000006");
    assert_eq!(res["cantidad_devuelta"], 2);
    assert_eq!(res["prestamo_estado"], "cerrado");
    assert_eq!(res["prestamo_unidades_pendientes"], 0);
    assert!(res["fecha_devolucion"].as_str().unwrap().len() >= 10);
    assert_eq!(res["lineas"][0]["prestamo_detalle_id"], 7);
    assert_eq!(res["lineas"][0]["cantidad_devuelta"], 2);

    let conn = conectar(&dir);
    assert_eq!(contadores(&conn, 1), (30, 26, 4, 0, 0), "disponible+2, prestada-2");
    assert_eq!(estado_detalle(&conn, 7), ("devuelto".to_string(), 2, 0, 0, 0));
    assert_eq!(estado_prestamo(&conn, 6), "cerrado");
    assert!(
        conn.query_row("SELECT cerrado_en FROM prestamo WHERE id = 6", [], |r| r
            .get::<_, Option<String>>(0))
            .unwrap()
            .is_some(),
        "el cierre registra la fecha"
    );
    assert_eq!(movimiento(&conn, "devolucion"), (1, 2));
    assert_eq!(contar(&conn, "movimiento_inventario"), 1, "sin doble ajuste");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn devolucion_parcial_mantiene_el_prestamo_activo() {
    let dir = base("parcial");
    let res = registrar(&dir, args(6, vec![linea_cantidad(7, 1, 0, 0)])).expect("debe ser Ok");

    assert_eq!(res["prestamo_estado"], "activo");
    assert_eq!(res["prestamo_unidades_pendientes"], 1);

    let conn = conectar(&dir);
    assert_eq!(estado_detalle(&conn, 7), ("parcial".to_string(), 1, 0, 0, 1));
    assert_eq!(contadores(&conn, 1), (30, 25, 5, 0, 0));
    assert_eq!(estado_prestamo(&conn, 6), "activo");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn varias_devoluciones_sucesivas_cierran_al_final() {
    let dir = base("sucesivas");
    let primero = registrar(&dir, args(6, vec![linea_cantidad(7, 1, 0, 0)])).expect("primera");
    assert_eq!(primero["prestamo_estado"], "activo");

    let segundo = registrar(&dir, args(6, vec![linea_cantidad(7, 1, 0, 0)])).expect("segunda");
    assert_eq!(segundo["prestamo_estado"], "cerrado");
    assert_eq!(segundo["prestamo_unidades_pendientes"], 0);

    let conn = conectar(&dir);
    assert_eq!(contar(&conn, "devolucion"), 2, "RN-38: dos eventos independientes");
    assert_eq!(contar(&conn, "devolucion_detalle"), 2);
    assert_eq!(movimiento(&conn, "devolucion"), (2, 2));
    assert_eq!(estado_detalle(&conn, 7), ("devuelto".to_string(), 2, 0, 0, 0));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn varios_renglones_en_una_sola_devolucion() {
    let dir = base("multi");
    let res = registrar(
        &dir,
        args(1, vec![linea_cantidad(1, 1, 0, 0), linea_unidades(2, &[(1, "bueno")])]),
    )
    .expect("debe ser Ok");

    assert_eq!(res["lineas"].as_array().unwrap().len(), 2);
    assert_eq!(res["cantidad_devuelta"], 2);

    let conn = conectar(&dir);
    assert_eq!(estado_detalle(&conn, 1), ("parcial".to_string(), 1, 0, 0, 5));
    assert_eq!(estado_detalle(&conn, 2), ("parcial".to_string(), 1, 0, 0, 2));
    assert_eq!(contadores(&conn, 1), (30, 25, 5, 0, 0));
    assert_eq!(contadores(&conn, 2), (3, 1, 2, 0, 0));
    assert_eq!(estado_prestamo(&conn, 1), "activo");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn observaciones_se_guardan() {
    let dir = base("obs");
    let mut payload = args(6, vec![linea_cantidad(7, 1, 0, 0)]);
    payload["datos"]["observaciones"] = json!("Con retraso");
    let res = registrar(&dir, payload).expect("debe ser Ok");

    assert_eq!(res["observaciones"], "Con retraso");
    let conn = conectar(&dir);
    let guardada: Option<String> = conn
        .query_row("SELECT observaciones FROM devolucion", [], |r| r.get(0))
        .unwrap();
    assert_eq!(guardada.as_deref(), Some("Con retraso"));

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Daño y pérdida (RN-31, RN-32, RN-33)
// ---------------------------------------------------------------------------

#[test]
fn devolucion_danada_nunca_suma_a_disponible() {
    let dir = base("danada");
    let mut payload = args(6, vec![linea_cantidad(7, 0, 1, 0)]);
    payload["datos"]["lineas"][0]["descripcion"] = json!("Golpe en el borde");
    let res = registrar(&dir, payload).expect("debe ser Ok");

    assert_eq!(res["cantidad_daniada"], 1);
    assert_eq!(res["cantidad_devuelta"], 0);

    let conn = conectar(&dir);
    assert_eq!(contadores(&conn, 1), (30, 24, 5, 1, 0), "disponible intacto");
    assert_eq!(estado_detalle(&conn, 7), ("con_incidente".to_string(), 0, 1, 0, 1));
    assert_eq!(movimiento(&conn, "danio_prestado"), (1, 1));
    assert_eq!(movimiento(&conn, "devolucion"), (0, 0));

    let (tipo, estado, origen, descripcion, responsabilidad): (String, String, String, String, String) =
        conn.query_row(
            "SELECT tipo, estado, origen, descripcion, responsabilidad FROM incidente",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .unwrap();
    assert_eq!(tipo, "danio");
    assert_eq!(estado, "abierto");
    assert_eq!(origen, "devolucion");
    assert_eq!(descripcion, "Golpe en el borde");
    assert_eq!(responsabilidad, "sin_determinar");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn devolucion_perdida_nunca_suma_a_disponible() {
    let dir = base("perdida");
    let mut payload = args(6, vec![linea_cantidad(7, 0, 0, 1)]);
    payload["datos"]["lineas"][0]["descripcion"] = json!("No volvió");
    let res = registrar(&dir, payload).expect("debe ser Ok");

    assert_eq!(res["cantidad_perdida"], 1);

    let conn = conectar(&dir);
    assert_eq!(contadores(&conn, 1), (30, 24, 5, 0, 1), "disponible intacto");
    assert_eq!(movimiento(&conn, "perdida_prestado"), (1, 1));
    let tipo: String = conn
        .query_row("SELECT tipo FROM incidente", [], |r| r.get(0))
        .unwrap();
    assert_eq!(tipo, "perdida");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn devolucion_mixta_crea_ambos_incidentes() {
    let dir = base("mixta");
    let mut payload = args(1, vec![linea_cantidad(1, 1, 1, 1)]);
    payload["datos"]["lineas"][0]["descripcion"] = json!("Una rota y una perdida");
    let res = registrar(&dir, payload).expect("debe ser Ok");

    assert_eq!(res["cantidad_devuelta"], 1);
    assert_eq!(res["cantidad_daniada"], 1);
    assert_eq!(res["cantidad_perdida"], 1);

    let conn = conectar(&dir);
    assert_eq!(contadores(&conn, 1), (30, 25, 3, 1, 1));
    assert_eq!(estado_detalle(&conn, 1), ("con_incidente".to_string(), 1, 1, 1, 3));
    assert_eq!(contar(&conn, "incidente"), 2, "uno por daño y uno por pérdida");
    assert_eq!(movimiento(&conn, "devolucion"), (1, 1));
    assert_eq!(movimiento(&conn, "danio_prestado"), (1, 1));
    assert_eq!(movimiento(&conn, "perdida_prestado"), (1, 1));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn danio_o_perdida_sin_descripcion_se_rechaza_sin_escribir() {
    let dir = base("sin_desc");
    let msg = mensaje(registrar(&dir, args(6, vec![linea_cantidad(7, 0, 1, 0)])));
    assert!(msg.contains("exige una descripción"), "mensaje: {msg}");

    let conn = conectar(&dir);
    assert_eq!(contar(&conn, "devolucion"), 0);
    assert_eq!(contar(&conn, "incidente"), 0);
    assert_eq!(contar(&conn, "movimiento_inventario"), 0);
    assert_eq!(contadores(&conn, 1), (30, 24, 6, 0, 0));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn responsable_ajeno_se_rechaza() {
    let dir = base("responsable");
    let mut payload = args(6, vec![linea_cantidad(7, 0, 1, 0)]);
    payload["datos"]["lineas"][0]["descripcion"] = json!("Roto");
    payload["datos"]["lineas"][0]["estudiante_id"] = json!(2);
    let msg = mensaje(registrar(&dir, payload));
    assert!(msg.contains("no corresponde al estudiante"), "mensaje: {msg}");

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Validaciones de cantidades
// ---------------------------------------------------------------------------

#[test]
fn cantidad_negativa_se_rechaza() {
    let dir = base("negativa");
    let msg = mensaje(registrar(&dir, args(6, vec![linea_cantidad(7, -1, 0, 0)])));
    assert!(msg.contains("no pueden ser negativas"), "mensaje: {msg}");

    let conn = conectar(&dir);
    assert_eq!(contar(&conn, "devolucion"), 0);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn cantidad_supera_el_pendiente_se_rechaza() {
    let dir = base("excede");
    let msg = mensaje(registrar(&dir, args(6, vec![linea_cantidad(7, 3, 0, 0)])));
    assert!(msg.contains("Solo quedan 2"), "mensaje: {msg}");

    let conn = conectar(&dir);
    assert_eq!(contar(&conn, "devolucion"), 0, "no queda rastro");
    assert_eq!(contadores(&conn, 1), (30, 24, 6, 0, 0));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn devolucion_sin_cantidades_positivas_se_rechaza() {
    let dir = base("vacia");
    let msg = mensaje(registrar(&dir, args(6, vec![linea_cantidad(7, 0, 0, 0)])));
    assert!(msg.contains("al menos un renglón"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(6, vec![])));
    assert!(msg.contains("al menos un renglón"), "mensaje: {msg}");

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Validaciones de préstamo y renglón
// ---------------------------------------------------------------------------

#[test]
fn prestamo_inexistente_se_rechaza() {
    let dir = base("inexistente");
    let msg = mensaje(registrar(&dir, args(999, vec![linea_cantidad(7, 1, 0, 0)])));
    assert!(msg.contains("No se encontró el préstamo"), "mensaje: {msg}");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn prestamo_cerrado_o_anulado_se_rechaza() {
    let dir = base("no_activo");

    let msg = mensaje(registrar(&dir, args(2, vec![linea_cantidad(3, 0, 0, 0)])));
    assert!(msg.contains("préstamo activo"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(3, vec![linea_cantidad(4, 1, 0, 0)])));
    assert!(msg.contains("préstamo activo"), "mensaje: {msg}");

    let conn = conectar(&dir);
    assert_eq!(contar(&conn, "devolucion"), 0);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn prestamo_sin_pendientes_se_rechaza() {
    let dir = base("sin_pendientes");
    let msg = mensaje(registrar(&dir, args(4, vec![linea_cantidad(5, 1, 0, 0)])));
    assert!(msg.contains("no tiene unidades pendientes"), "mensaje: {msg}");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn renglon_ajeno_o_inexistente_se_rechaza() {
    let dir = base("renglon");

    let msg = mensaje(registrar(&dir, args(6, vec![linea_cantidad(1, 1, 0, 0)])));
    assert!(msg.contains("no pertenece al préstamo"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(6, vec![linea_cantidad(999, 1, 0, 0)])));
    assert!(msg.contains("No existe el renglón"), "mensaje: {msg}");

    let conn = conectar(&dir);
    assert_eq!(contar(&conn, "devolucion"), 0);
    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Control individual (RN-50, RN-53)
// ---------------------------------------------------------------------------

#[test]
fn control_individual_devuelve_unidades_concretas() {
    let dir = base("unidades");
    let res = registrar(&dir, args(1, vec![linea_unidades(2, &[(1, "bueno"), (2, "bueno")])]))
        .expect("debe ser Ok");

    assert_eq!(res["cantidad_devuelta"], 2);
    assert_eq!(res["prestamo_estado"], "activo");

    let conn = conectar(&dir);
    assert_eq!(unidad_estado(&conn, 1), ("disponible".to_string(), None));
    assert_eq!(unidad_estado(&conn, 2), ("disponible".to_string(), None));
    assert_eq!(unidad_estado(&conn, 3), ("prestada".to_string(), Some(2)));
    assert_eq!(contadores(&conn, 2), (3, 2, 1, 0, 0));
    assert_eq!(estado_detalle(&conn, 2), ("parcial".to_string(), 2, 0, 0, 1));
    assert_eq!(movimiento(&conn, "devolucion"), (2, 2));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn control_individual_danada_crea_incidente_de_la_unidad() {
    let dir = base("unidad_danada");
    let mut payload = args(1, vec![linea_unidades(2, &[(1, "danado")])]);
    payload["datos"]["lineas"][0]["descripcion"] = json!("Mango roto");
    registrar(&dir, payload).expect("debe ser Ok");

    let conn = conectar(&dir);
    assert_eq!(unidad_estado(&conn, 1), ("danada".to_string(), None));
    assert_eq!(contadores(&conn, 2), (3, 0, 2, 1, 0));
    let (tipo, articulo_unidad_id, cantidad): (String, Option<i64>, i64) = conn
        .query_row(
            "SELECT tipo, articulo_unidad_id, cantidad FROM incidente",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap();
    assert_eq!(tipo, "danio");
    assert_eq!(articulo_unidad_id, Some(1));
    assert_eq!(cantidad, 1);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn control_individual_rechaza_unidades_incorrectas() {
    let dir = base("unidades_err");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_cantidad(2, 1, 0, 0)])));
    assert!(msg.contains("tiene control individual"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_unidades(2, &[(1, "bueno"), (1, "bueno")])])));
    assert!(msg.contains("más de una vez"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_unidades(2, &[(999, "bueno")])])));
    assert!(msg.contains("No existe la unidad"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_unidades(2, &[(50, "bueno")])])));
    assert!(msg.contains("no pertenece a este préstamo"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_unidades(1, &[(1, "bueno")])])));
    assert!(msg.contains("no tiene control individual"), "mensaje: {msg}");

    let msg = mensaje(registrar(&dir, args(1, vec![linea_unidades(2, &[(1, "excelente")])])));
    assert!(msg.contains("no es válida"), "mensaje: {msg}");

    let conn = conectar(&dir);
    assert_eq!(contar(&conn, "devolucion"), 0);
    assert_eq!(unidad_estado(&conn, 1), ("prestada".to_string(), Some(2)));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn no_se_puede_devolver_una_unidad_ya_devuelta() {
    let dir = base("unidad_doble");
    registrar(&dir, args(1, vec![linea_unidades(2, &[(1, "bueno")])])).expect("primera");
    let msg = mensaje(registrar(&dir, args(1, vec![linea_unidades(2, &[(1, "bueno")])])));
    assert!(msg.contains("no está prestada"), "mensaje: {msg}");

    let conn = conectar(&dir);
    assert_eq!(unidad_estado(&conn, 1), ("disponible".to_string(), None));
    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Atomicidad
// ---------------------------------------------------------------------------

#[test]
fn fallo_tardio_revierte_toda_la_transaccion() {
    let dir = base("rollback");

    // El primer renglón se escribe; el segundo (artículo "desajustado") pasa la
    // validación pero rompe el inventario al aplicar el movimiento. Todo debe
    // revertirse: no puede quedar devolución, detalle, movimiento ni cambio de
    // contadores.
    let msg = mensaje(registrar(
        &dir,
        args(1, vec![linea_cantidad(1, 1, 0, 0), linea_unidades(8, &[(51, "bueno")])]),
    ));
    assert!(msg.contains("por debajo de cero"), "mensaje: {msg}");

    let conn = conectar(&dir);
    assert_eq!(contar(&conn, "devolucion"), 0, "sin cabecera");
    assert_eq!(contar(&conn, "devolucion_detalle"), 0, "sin renglones");
    assert_eq!(contar(&conn, "movimiento_inventario"), 0, "sin movimientos");
    assert_eq!(contadores(&conn, 1), (30, 24, 6, 0, 0), "contadores intactos");
    assert_eq!(contadores(&conn, 3), (5, 5, 0, 0, 0), "contadores intactos");
    assert_eq!(unidad_estado(&conn, 51), ("prestada".to_string(), Some(8)));
    assert_eq!(estado_detalle(&conn, 1), ("pendiente".to_string(), 0, 0, 0, 6));
    assert_eq!(estado_prestamo(&conn, 1), "activo");

    let _ = std::fs::remove_dir_all(&dir);
}
