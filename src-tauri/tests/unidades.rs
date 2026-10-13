//! Pruebas de las unidades individuales (Fase F4): creación de artículos con
//! control individual, alta/edición de unidades y transiciones de estado.
//!
//! Igual que el resto de la suite, se ejecutan sobre bases SQLite temporales con
//! el esquema real y a través del despachador IPC de Tauri. La base real nunca se
//! toca.
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

static ENV_LOCK: Mutex<()> = Mutex::new(());

const AHORA: &str = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

fn fresh_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("stocklend_f4_{tag}"));
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

fn dir_con_esquema_real(tag: &str) -> PathBuf {
    let dir = fresh_dir(tag);
    let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
    conn.execute_batch(&esquema_real()).unwrap();
    dir
}

fn ruta_db(dir: &Path) -> PathBuf {
    dir.join(paths::DB_FILENAME)
}

fn conectar(dir: &Path) -> Connection {
    Connection::open(ruta_db(dir)).unwrap()
}

fn dir_con_categoria(tag: &str) -> PathBuf {
    let dir = dir_con_esquema_real(tag);
    let conn = conectar(&dir);
    conn.execute(
        &format!(
            "INSERT INTO categoria (id, nombre, activo, creado_en) VALUES (1, 'General', 1, {AHORA})"
        ),
        [],
    )
    .unwrap();
    dir
}

/// Inserta un artículo con control individual y contadores dados.
fn sembrar_articulo_control(
    dir: &Path,
    id: i64,
    categoria_id: i64,
    c: (i64, i64, i64, i64, i64),
) {
    let conn = conectar(dir);
    conn.execute(
        &format!(
            "INSERT INTO articulo \
             (id, nombre, categoria_id, control_individual, prestable, activo, \
              cantidad_total, cantidad_disponible, cantidad_prestada, \
              cantidad_daniada, cantidad_faltante, creado_en, actualizado_en) \
             VALUES (?1, 'Conjunto', ?2, 1, 1, 1, ?3, ?4, ?5, ?6, ?7, {AHORA}, {AHORA})"
        ),
        params![id, categoria_id, c.0, c.1, c.2, c.3, c.4],
    )
    .unwrap();
}

fn sembrar_unidad(dir: &Path, articulo_id: i64, codigo: &str, estado: &str) {
    let conn = conectar(dir);
    conn.execute(
        &format!(
            "INSERT INTO articulo_unidad (articulo_id, codigo, estado, creado_en, actualizado_en) \
             VALUES (?1, ?2, ?3, {AHORA}, {AHORA})"
        ),
        params![articulo_id, codigo, estado],
    )
    .unwrap();
}

/// Inserta una unidad `prestada` con el préstamo y renglón mínimos que exige el
/// esquema (`prestada` requiere `prestamo_detalle_id`).
fn sembrar_unidad_prestada(dir: &Path, articulo_id: i64, codigo: &str) {
    let conn = conectar(dir);
    conn.execute(
        &format!(
            "INSERT INTO estudiante \
             (id, codigo_universitario, nombres, apellidos, creado_en, actualizado_en) \
             VALUES (1, 'EST-1', 'Ana', 'Pérez', {AHORA}, {AHORA})"
        ),
        [],
    )
    .unwrap();
    conn.execute(
        &format!(
            "INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, estado, creado_en) \
             VALUES (1, 'P-1', 1, date('now'), 'activo', {AHORA})"
        ),
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO prestamo_detalle \
         (id, prestamo_id, articulo_id, cantidad_prestada, estado) \
         VALUES (1, 1, ?1, 1, 'pendiente')",
        [articulo_id],
    )
    .unwrap();
    conn.execute(
        &format!(
            "INSERT INTO articulo_unidad \
             (articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en) \
             VALUES (?1, ?2, 'prestada', 1, {AHORA}, {AHORA})"
        ),
        params![articulo_id, codigo],
    )
    .unwrap();
}

fn contadores(dir: &Path, id: i64) -> (i64, i64, i64, i64, i64) {
    let conn = conectar(dir);
    conn.query_row(
        "SELECT cantidad_total, cantidad_disponible, cantidad_prestada, \
                cantidad_daniada, cantidad_faltante \
         FROM articulo WHERE id = ?1",
        [id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
    )
    .unwrap()
}

fn estado_unidad(dir: &Path, id: i64) -> String {
    let conn = conectar(dir);
    conn.query_row("SELECT estado FROM articulo_unidad WHERE id = ?1", [id], |r| r.get(0))
        .unwrap()
}

fn contar_unidades(dir: &Path, articulo_id: i64) -> i64 {
    let conn = conectar(dir);
    conn.query_row(
        "SELECT COUNT(*) FROM articulo_unidad WHERE articulo_id = ?1",
        [articulo_id],
        |r| r.get(0),
    )
    .unwrap()
}

fn contar_movimientos(dir: &Path) -> i64 {
    let conn = conectar(dir);
    conn.query_row("SELECT COUNT(*) FROM movimiento_inventario", [], |r| r.get(0))
        .unwrap()
}

/// `(tipo, cantidad, referencia_tipo, articulo_unidad_id)` del último movimiento.
fn ultimo_movimiento(dir: &Path) -> (String, i64, Option<String>, Option<i64>) {
    let conn = conectar(dir);
    conn.query_row(
        "SELECT tipo, cantidad, referencia_tipo, articulo_unidad_id \
         FROM movimiento_inventario ORDER BY id DESC LIMIT 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    )
    .unwrap()
}

fn invoke(
    cmd: &str,
    args: Option<serde_json::Value>,
    dir: &Path,
) -> Result<serde_json::Value, serde_json::Value> {
    let _guard = ENV_LOCK.lock().unwrap();
    unsafe { std::env::set_var(paths::ENV_DATA_DIR, dir) };
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![
            stocklend_lib::commands::inventory::listar_articulos,
            stocklend_lib::commands::inventory::listar_unidades,
            stocklend_lib::commands::inventory::crear_articulo,
            stocklend_lib::commands::inventory::agregar_unidad,
            stocklend_lib::commands::inventory::actualizar_unidad,
            stocklend_lib::commands::inventory::cambiar_estado_unidad,
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
    unsafe { std::env::remove_var(paths::ENV_DATA_DIR) };
    match res {
        Ok(cuerpo) => Ok(cuerpo.deserialize::<serde_json::Value>().unwrap()),
        Err(err) => Err(err),
    }
}

fn mensaje_de_error(err: serde_json::Value) -> String {
    err.as_str().unwrap_or_default().to_string()
}

// ---------------------------------------------------------------------------
// Alta de artículos con unidades
// ---------------------------------------------------------------------------

#[test]
fn crear_articulo_con_unidades_registra_un_solo_alta_agregada() {
    let dir = dir_con_categoria("crear_unidades");

    let creado = invoke(
        "crear_articulo",
        Some(json!({ "datos": {
            "nombre": "Taladros",
            "categoria_id": 1,
            "cantidad_inicial": 3,
            "control_individual": true,
            "unidades": [
                { "codigo": "T-1", "descripcion": "  Punta fina  " },
                { "codigo": "T-2" },
                { "codigo": "T-3" }
            ]
        } })),
        &dir,
    )
    .expect("debe crear");

    assert_eq!(creado["control_individual"], true);
    assert_eq!(creado["cantidad_total"], 3);
    assert_eq!(creado["cantidad_disponible"], 3);
    assert_eq!(contar_unidades(&dir, 1), 3);
    assert_eq!(estado_unidad(&dir, 1), "disponible");

    let descripcion: Option<String> = conectar(&dir)
        .query_row("SELECT descripcion FROM articulo_unidad WHERE id = 1", [], |r| r.get(0))
        .unwrap();
    assert_eq!(descripcion.as_deref(), Some("Punta fina"), "descripción recortada");

    assert_eq!(contar_movimientos(&dir), 1, "un solo movimiento agregado");
    let (tipo, cantidad, referencia_tipo, _) = ultimo_movimiento(&dir);
    assert_eq!(tipo, "alta");
    assert_eq!(cantidad, 3);
    assert_eq!(referencia_tipo, None);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_rechaza_codigos_repetidos_en_el_lote() {
    let dir = dir_con_categoria("crear_dup_lote");

    let err = invoke(
        "crear_articulo",
        Some(json!({ "datos": {
            "nombre": "Taladros",
            "categoria_id": 1,
            "cantidad_inicial": 2,
            "control_individual": true,
            "unidades": [ { "codigo": "T-1" }, { "codigo": "  t-1 " } ]
        } })),
        &dir,
    )
    .expect_err("códigos repetidos");
    let mensaje = mensaje_de_error(err);
    assert!(mensaje.contains("Ya existe una unidad"), "mensaje={mensaje}");
    assert_eq!(contar_unidades(&dir, 1), 0, "rollback");
    assert_eq!(contar_movimientos(&dir), 0);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_rechaza_codigo_ya_existente() {
    let dir = dir_con_categoria("crear_dup_base");
    sembrar_articulo_control(&dir, 1, 1, (1, 1, 0, 0, 0));
    sembrar_unidad(&dir, 1, "T-1", "disponible");

    let err = invoke(
        "crear_articulo",
        Some(json!({ "datos": {
            "nombre": "Otros taladros",
            "categoria_id": 1,
            "cantidad_inicial": 1,
            "control_individual": true,
            "unidades": [ { "codigo": "t-1" } ]
        } })),
        &dir,
    )
    .expect_err("código global duplicado");
    assert!(mensaje_de_error(err).contains("Ya existe una unidad"));
    assert_eq!(contar_unidades(&dir, 1), 1, "no se agregó nada");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_rechaza_codigo_vacio() {
    let dir = dir_con_categoria("crear_codigo_vacio");

    let err = invoke(
        "crear_articulo",
        Some(json!({ "datos": {
            "nombre": "Taladros",
            "categoria_id": 1,
            "cantidad_inicial": 1,
            "control_individual": true,
            "unidades": [ { "codigo": "   " } ]
        } })),
        &dir,
    )
    .expect_err("código obligatorio");
    assert!(mensaje_de_error(err).contains("obligatorio"));

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Agregar unidad
// ---------------------------------------------------------------------------

#[test]
fn agregar_unidad_suma_disponible_y_registra_movimiento() {
    let dir = dir_con_categoria("agregar_ok");
    sembrar_articulo_control(&dir, 1, 1, (2, 2, 0, 0, 0));
    sembrar_unidad(&dir, 1, "T-1", "disponible");
    sembrar_unidad(&dir, 1, "T-2", "disponible");

    let unidad = invoke(
        "agregar_unidad",
        Some(json!({ "datos": { "articulo_id": 1, "codigo": "T-3", "descripcion": "Nueva" } })),
        &dir,
    )
    .expect("debe agregar");

    assert_eq!(unidad["codigo"], "T-3");
    assert_eq!(unidad["estado"], "disponible");
    assert_eq!(unidad["articulo_id"], 1);
    assert_eq!(contar_unidades(&dir, 1), 3);
    assert_eq!(contadores(&dir, 1), (3, 3, 0, 0, 0));

    let (tipo, cantidad, referencia_tipo, _) = ultimo_movimiento(&dir);
    assert_eq!(tipo, "ajuste_positivo");
    assert_eq!(cantidad, 1);
    assert_eq!(referencia_tipo.as_deref(), Some("ajuste"));

    let conn = conectar(&dir);
    let unidad_id: Option<i64> = conn
        .query_row(
            "SELECT articulo_unidad_id FROM movimiento_inventario ORDER BY id DESC LIMIT 1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert!(unidad_id.is_some(), "el movimiento queda ligado a la unidad");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn agregar_unidad_rechaza_articulo_sin_control_individual() {
    let dir = dir_con_categoria("agregar_sin_control");
    let conn = conectar(&dir);
    conn.execute(
        &format!(
            "INSERT INTO articulo \
             (id, nombre, categoria_id, control_individual, prestable, activo, \
              cantidad_total, cantidad_disponible, cantidad_prestada, cantidad_daniada, \
              cantidad_faltante, creado_en, actualizado_en) \
             VALUES (1, 'Suelto', 1, 0, 1, 1, 5, 5, 0, 0, 0, {AHORA}, {AHORA})"
        ),
        [],
    )
    .unwrap();

    let err = invoke(
        "agregar_unidad",
        Some(json!({ "datos": { "articulo_id": 1, "codigo": "X-1" } })),
        &dir,
    )
    .expect_err("sin control individual");
    assert!(mensaje_de_error(err).contains("control individual"));
    assert_eq!(contar_movimientos(&dir), 0);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn agregar_unidad_rechaza_codigo_duplicado_sin_distinguir_mayusculas() {
    let dir = dir_con_categoria("agregar_dup");
    sembrar_articulo_control(&dir, 1, 1, (1, 1, 0, 0, 0));
    sembrar_unidad(&dir, 1, "T-1", "disponible");

    let err = invoke(
        "agregar_unidad",
        Some(json!({ "datos": { "articulo_id": 1, "codigo": "t-1" } })),
        &dir,
    )
    .expect_err("código duplicado");
    assert!(mensaje_de_error(err).contains("Ya existe una unidad"));
    assert_eq!(contar_unidades(&dir, 1), 1);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn agregar_unidad_en_articulo_inexistente_falla() {
    let dir = dir_con_categoria("agregar_inexistente");

    let err = invoke(
        "agregar_unidad",
        Some(json!({ "datos": { "articulo_id": 42, "codigo": "X-1" } })),
        &dir,
    )
    .expect_err("artículo inexistente");
    assert!(mensaje_de_error(err).contains("No se encontró el artículo"));

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Editar unidad
// ---------------------------------------------------------------------------

#[test]
fn actualizar_unidad_cambia_datos_sin_tocar_contadores_ni_movimientos() {
    let dir = dir_con_categoria("editar_unidad");
    sembrar_articulo_control(&dir, 1, 1, (2, 1, 0, 1, 0));
    sembrar_unidad(&dir, 1, "T-1", "disponible");
    sembrar_unidad(&dir, 1, "T-2", "danada");

    let antes = contadores(&dir, 1);
    let unidad = invoke(
        "actualizar_unidad",
        Some(json!({ "datos": { "id": 1, "codigo": " T-1B ", "descripcion": "  Media  ", "notas": "  ok  " } })),
        &dir,
    )
    .expect("debe actualizar");

    assert_eq!(unidad["codigo"], "T-1B");
    assert_eq!(estado_unidad(&dir, 1), "disponible", "estado intacto");
    assert_eq!(contadores(&dir, 1), antes, "contadores intactos");
    assert_eq!(contar_movimientos(&dir), 0, "editar no genera movimientos");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn actualizar_unidad_permite_conservar_su_codigo() {
    let dir = dir_con_categoria("editar_unidad_propio");
    sembrar_articulo_control(&dir, 1, 1, (1, 1, 0, 0, 0));
    sembrar_unidad(&dir, 1, "T-1", "disponible");

    let unidad = invoke(
        "actualizar_unidad",
        Some(json!({ "datos": { "id": 1, "codigo": "t-1" } })),
        &dir,
    )
    .expect("no es duplicado de sí mismo");
    assert_eq!(unidad["codigo"], "t-1");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn actualizar_unidad_rechaza_codigo_de_otra_unidad() {
    let dir = dir_con_categoria("editar_unidad_dup");
    sembrar_articulo_control(&dir, 1, 1, (2, 2, 0, 0, 0));
    sembrar_unidad(&dir, 1, "T-1", "disponible");
    sembrar_unidad(&dir, 1, "T-2", "disponible");

    let err = invoke(
        "actualizar_unidad",
        Some(json!({ "datos": { "id": 1, "codigo": "T-2" } })),
        &dir,
    )
    .expect_err("código de otra unidad");
    assert!(mensaje_de_error(err).contains("Ya existe una unidad"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn actualizar_unidad_inexistente_falla() {
    let dir = dir_con_categoria("editar_unidad_inexistente");

    let err = invoke(
        "actualizar_unidad",
        Some(json!({ "datos": { "id": 99, "codigo": "X-1" } })),
        &dir,
    )
    .expect_err("no existe");
    assert!(mensaje_de_error(err).contains("No se encontró la unidad"));

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Cambiar estado
// ---------------------------------------------------------------------------

#[test]
fn cambiar_estado_danada_a_disponible_mueve_de_cubo() {
    let dir = dir_con_categoria("estado_reparada");
    sembrar_articulo_control(&dir, 1, 1, (2, 1, 0, 1, 0));
    sembrar_unidad(&dir, 1, "T-1", "disponible");
    sembrar_unidad(&dir, 1, "T-2", "danada");

    let unidad = invoke(
        "cambiar_estado_unidad",
        Some(json!({ "datos": { "id": 2, "estado": "disponible", "motivo": "Reparada" } })),
        &dir,
    )
    .expect("debe cambiar");

    assert_eq!(unidad["estado"], "disponible");
    assert_eq!(contadores(&dir, 1), (2, 2, 0, 0, 0), "daniada baja, disponible sube");
    let (tipo, cantidad, _, _) = ultimo_movimiento(&dir);
    assert_eq!(tipo, "reingreso_reparacion");
    assert_eq!(cantidad, 1);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn cambiar_estado_danada_a_baja_descuenta_del_total() {
    let dir = dir_con_categoria("baja_danada");
    sembrar_articulo_control(&dir, 1, 1, (2, 1, 0, 1, 0));
    sembrar_unidad(&dir, 1, "T-1", "disponible");
    sembrar_unidad(&dir, 1, "T-2", "danada");

    let unidad = invoke(
        "cambiar_estado_unidad",
        Some(json!({ "datos": { "id": 2, "estado": "baja", "motivo": "Destruida" } })),
        &dir,
    )
    .expect("debe dar de baja");

    assert_eq!(unidad["estado"], "baja");
    assert_eq!(contadores(&dir, 1), (1, 1, 0, 0, 0), "el total excluye la baja");
    let (tipo, cantidad, _, _) = ultimo_movimiento(&dir);
    assert_eq!(tipo, "baja_daniada");
    assert_eq!(cantidad, 1);
    assert_eq!(estado_unidad(&dir, 2), "baja", "la unidad dada de baja");
    assert_eq!(estado_unidad(&dir, 1), "disponible", "la otra unidad intacta");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn cambiar_estado_faltante_a_baja() {
    let dir = dir_con_categoria("baja_faltante");
    sembrar_articulo_control(&dir, 1, 1, (2, 1, 0, 0, 1));
    sembrar_unidad(&dir, 1, "T-1", "disponible");
    sembrar_unidad(&dir, 1, "T-2", "faltante");

    invoke(
        "cambiar_estado_unidad",
        Some(json!({ "datos": { "id": 2, "estado": "baja", "motivo": "No aparece" } })),
        &dir,
    )
    .expect("debe dar de baja");

    assert_eq!(contadores(&dir, 1), (1, 1, 0, 0, 0));
    let (tipo, _, _, _) = ultimo_movimiento(&dir);
    assert_eq!(tipo, "baja_faltante");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn cambiar_estado_rechaza_transiciones_no_permitidas() {
    let dir = dir_con_categoria("transiciones");
    sembrar_articulo_control(&dir, 1, 1, (3, 2, 0, 1, 0));
    sembrar_unidad(&dir, 1, "D", "disponible");
    sembrar_unidad(&dir, 1, "F", "faltante");
    sembrar_unidad(&dir, 1, "N", "danada");

    for (id, hacia) in [(1, "danada"), (1, "faltante"), (1, "baja"), (2, "disponible"), (2, "danada"), (3, "faltante")] {
        let err = invoke(
            "cambiar_estado_unidad",
            Some(json!({ "datos": { "id": id, "estado": hacia, "motivo": "x" } })),
            &dir,
        )
        .expect_err("transición no permitida");
        let mensaje = mensaje_de_error(err);
        assert!(
            mensaje.contains("No se puede pasar"),
            "id={id} hacia={hacia} mensaje={mensaje}"
        );
    }
    assert_eq!(contar_movimientos(&dir), 0, "ninguna transición rechazada registra movimiento");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn cambiar_estado_no_reactiva_una_unidad_de_baja() {
    let dir = dir_con_categoria("no_reactivar");
    sembrar_articulo_control(&dir, 1, 1, (1, 1, 0, 0, 0));
    sembrar_unidad(&dir, 1, "T-1", "baja");

    let err = invoke(
        "cambiar_estado_unidad",
        Some(json!({ "datos": { "id": 1, "estado": "disponible", "motivo": "x" } })),
        &dir,
    )
    .expect_err("no se reactiva");
    assert!(mensaje_de_error(err).contains("No se puede pasar"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn cambiar_estado_no_permite_tocar_unidades_prestadas() {
    let dir = dir_con_categoria("prestada");
    sembrar_articulo_control(&dir, 1, 1, (1, 0, 1, 0, 0));
    sembrar_unidad_prestada(&dir, 1, "T-1");

    for hacia in ["disponible", "danada", "faltante", "baja"] {
        let err = invoke(
            "cambiar_estado_unidad",
            Some(json!({ "datos": { "id": 1, "estado": hacia, "motivo": "x" } })),
            &dir,
        )
        .expect_err("prestada no se toca");
        assert!(mensaje_de_error(err).contains("No se puede pasar"), "hacia={hacia}");
    }

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn cambiar_estado_rechaza_motivo_vacio_o_muy_largo() {
    let dir = dir_con_categoria("motivo_estado");
    sembrar_articulo_control(&dir, 1, 1, (1, 0, 0, 1, 0));
    sembrar_unidad(&dir, 1, "T-1", "danada");

    let vacio = invoke(
        "cambiar_estado_unidad",
        Some(json!({ "datos": { "id": 1, "estado": "disponible", "motivo": "   " } })),
        &dir,
    )
    .expect_err("motivo vacío");
    assert!(mensaje_de_error(vacio).contains("motivo"));

    let largo = invoke(
        "cambiar_estado_unidad",
        Some(json!({ "datos": { "id": 1, "estado": "disponible", "motivo": "x".repeat(201) } })),
        &dir,
    )
    .expect_err("motivo largo");
    assert!(mensaje_de_error(largo).contains("200 caracteres"));

    assert_eq!(estado_unidad(&dir, 1), "danada");
    assert_eq!(contar_movimientos(&dir), 0);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn cambiar_estado_unidad_inexistente_falla() {
    let dir = dir_con_categoria("estado_inexistente");

    let err = invoke(
        "cambiar_estado_unidad",
        Some(json!({ "datos": { "id": 99, "estado": "disponible", "motivo": "x" } })),
        &dir,
    )
    .expect_err("no existe");
    assert!(mensaje_de_error(err).contains("No se encontró la unidad"));

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Invariantes y compatibilidad
// ---------------------------------------------------------------------------

#[test]
fn rn02_y_rn61_se_conservan_tras_una_secuencia() {
    let dir = dir_con_categoria("secuencia_unidades");
    sembrar_articulo_control(&dir, 1, 1, (3, 1, 0, 1, 1));
    sembrar_unidad(&dir, 1, "A", "disponible");
    sembrar_unidad(&dir, 1, "B", "danada");
    sembrar_unidad(&dir, 1, "C", "faltante");

    invoke(
        "agregar_unidad",
        Some(json!({ "datos": { "articulo_id": 1, "codigo": "D" } })),
        &dir,
    )
    .unwrap();
    invoke(
        "cambiar_estado_unidad",
        Some(json!({ "datos": { "id": 2, "estado": "disponible", "motivo": "Reparada" } })),
        &dir,
    )
    .unwrap();
    invoke(
        "cambiar_estado_unidad",
        Some(json!({ "datos": { "id": 3, "estado": "baja", "motivo": "Perdida" } })),
        &dir,
    )
    .unwrap();

    assert_eq!(contadores(&dir, 1), (3, 3, 0, 0, 0));

    let incoherencias: i64 = conectar(&dir)
        .query_row(
            "SELECT COUNT(*) FROM articulo \
             WHERE cantidad_total <> cantidad_disponible + cantidad_prestada \
                                    + cantidad_daniada + cantidad_faltante",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(incoherencias, 0, "RN-02");

    let unidades_activas = contar_unidades(&dir, 1) - 1;
    assert_eq!(unidades_activas, contadores(&dir, 1).0, "RN-61: total = unidades no dadas de baja");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn listar_unidades_refleja_los_cambios() {
    let dir = dir_con_categoria("listar_unidades");

    invoke(
        "crear_articulo",
        Some(json!({ "datos": {
            "nombre": "Taladros",
            "categoria_id": 1,
            "cantidad_inicial": 2,
            "control_individual": true,
            "unidades": [ { "codigo": "T-1" }, { "codigo": "T-2" } ]
        } })),
        &dir,
    )
    .unwrap();

    let unidades = invoke("listar_unidades", None, &dir).expect("listar");
    let arr = unidades.as_array().unwrap();
    assert_eq!(arr.len(), 2, "json={unidades}");
    assert_eq!(arr[0]["articulo"], "Taladros");
    assert_eq!(arr[0]["estado"], "disponible");

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Base ausente / esquema incompleto
// ---------------------------------------------------------------------------

#[test]
fn las_escrituras_de_unidades_fallan_si_no_hay_base() {
    let dir = std::env::temp_dir().join("stocklend_f4_sin_base");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();

    let err = invoke(
        "agregar_unidad",
        Some(json!({ "datos": { "articulo_id": 1, "codigo": "X-1" } })),
        &dir,
    )
    .expect_err("no hay base");
    assert!(mensaje_de_error(err).contains("No se encontró"));
    assert!(!ruta_db(&dir).exists(), "no debe crear el archivo");

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Base real
// ---------------------------------------------------------------------------

#[test]
fn las_escrituras_de_unidades_no_alteran_la_base_real() {
    let dir = dir_con_categoria("base_real");
    let base_real = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("data")
        .join(paths::DB_FILENAME);
    let antes = std::fs::read(&base_real).expect("base real legible");

    invoke(
        "crear_articulo",
        Some(json!({ "datos": {
            "nombre": "Taladros",
            "categoria_id": 1,
            "cantidad_inicial": 1,
            "control_individual": true,
            "unidades": [ { "codigo": "T-1" } ]
        } })),
        &dir,
    )
    .unwrap();

    let despues = std::fs::read(&base_real).expect("base real legible");
    assert_eq!(antes, despues, "la base real no debe cambiar");

    let _ = std::fs::remove_dir_all(&dir);
}
