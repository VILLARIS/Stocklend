//! Tests del CRUD de artículos sin control individual (Fase F3), a través del
//! despachador IPC real de Tauri, sobre bases SQLite temporales con el
//! **esquema real** (`stocklend/data/migrations/0001_inicial.sql`). Nunca tocan
//! la base real.
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

/// Marca temporal UTC usada en los `INSERT` de apoyo.
const AHORA: &str = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

fn fresh_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("stocklend_f3_{tag}"));
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

/// Inserta una categoría directamente (evita depender del comando de F2).
fn sembrar_categoria(dir: &Path, id: i64, nombre: &str, activo: bool) {
    let conn = conectar(dir);
    conn.execute(
        &format!(
            "INSERT INTO categoria (id, nombre, activo, creado_en) \
             VALUES (?1, ?2, ?3, {AHORA})"
        ),
        params![id, nombre, activo as i64],
    )
    .unwrap();
}

/// Inserta un artículo con contadores y banderas dadas.
fn sembrar_articulo(
    dir: &Path,
    id: i64,
    categoria_id: i64,
    c: (i64, i64, i64, i64, i64),
    control_individual: bool,
    prestable: bool,
) {
    let conn = conectar(dir);
    conn.execute(
        &format!(
            "INSERT INTO articulo \
             (id, nombre, categoria_id, control_individual, prestable, activo, \
              cantidad_total, cantidad_disponible, cantidad_prestada, \
              cantidad_daniada, cantidad_faltante, creado_en, actualizado_en) \
             VALUES (?1, 'Sembrado', ?2, ?3, ?4, 1, ?5, ?6, ?7, ?8, ?9, {AHORA}, {AHORA})"
        ),
        params![
            id,
            categoria_id,
            control_individual as i64,
            prestable as i64,
            c.0,
            c.1,
            c.2,
            c.3,
            c.4
        ],
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

fn contar_movimientos(dir: &Path) -> i64 {
    let conn = conectar(dir);
    conn.query_row("SELECT COUNT(*) FROM movimiento_inventario", [], |r| r.get(0))
        .unwrap()
}

/// `(tipo, cantidad, referencia_tipo, referencia_id)` del último movimiento.
fn ultimo_movimiento(dir: &Path) -> (String, i64, Option<String>, Option<i64>) {
    let conn = conectar(dir);
    conn.query_row(
        "SELECT tipo, cantidad, referencia_tipo, referencia_id \
         FROM movimiento_inventario ORDER BY id DESC LIMIT 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    )
    .unwrap()
}

fn contar_articulos(dir: &Path) -> i64 {
    let conn = conectar(dir);
    conn.query_row("SELECT COUNT(*) FROM articulo", [], |r| r.get(0))
        .unwrap()
}

/// Invoca un comando por el despachador IPC real, fijando `STOCKLEND_DATA_DIR`.
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
            stocklend_lib::commands::inventory::listar_categorias,
            stocklend_lib::commands::inventory::obtener_estadisticas_inventario,
            stocklend_lib::commands::inventory::crear_articulo,
            stocklend_lib::commands::inventory::actualizar_articulo,
            stocklend_lib::commands::inventory::ajustar_existencias,
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

fn dir_con_categoria(tag: &str) -> PathBuf {
    let dir = dir_con_esquema_real(tag);
    sembrar_categoria(&dir, 1, "General", true);
    dir
}

fn contar_movimientos_tipo(dir: &Path, tipo: &str) -> i64 {
    let conn = conectar(dir);
    conn.query_row(
        "SELECT COUNT(*) FROM movimiento_inventario WHERE tipo = ?1",
        [tipo],
        |r| r.get(0),
    )
    .unwrap()
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

#[test]
fn crear_articulo_con_cantidad_cero_no_registra_movimiento() {
    let dir = dir_con_categoria("alta_cero");

    let creado = invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "Olla grande", "categoria_id": 1, "cantidad_inicial": 0, "notas": null } })),
        &dir,
    )
    .expect("debe crear");

    assert_eq!(creado["nombre"], "Olla grande");
    assert_eq!(creado["categoria"], "General");
    assert_eq!(creado["cantidad_total"], 0);
    assert_eq!(creado["cantidad_disponible"], 0);
    assert_eq!(creado["control_individual"], false);
    assert_eq!(creado["prestable"], true, "prestable por defecto");
    assert_eq!(creado["activo"], true);
    assert!(contar_movimientos(&dir) == 0, "sin cantidad no hay alta");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_con_cantidad_inicial_registra_alta() {
    let dir = dir_con_categoria("alta_positiva");

    let creado = invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "Tenedores", "categoria_id": 1, "cantidad_inicial": 12, "notas": null } })),
        &dir,
    )
    .expect("debe crear");

    assert_eq!(contadores(&dir, 1), (12, 12, 0, 0, 0));
    assert_eq!(contar_movimientos(&dir), 1);
    let (tipo, cantidad, referencia_tipo, referencia_id) = ultimo_movimiento(&dir);
    assert_eq!(tipo, "alta");
    assert_eq!(cantidad, 12);
    assert_eq!(referencia_tipo, None);
    assert_eq!(referencia_id, None);
    assert_eq!(creado["cantidad_total"], 12);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_respeta_prestable_y_notas() {
    let dir = dir_con_categoria("alta_flags");

    let creado = invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "En reparación", "categoria_id": 1, "cantidad_inicial": 3, "prestable": false, "notas": "  Pendiente de ajuste  " } })),
        &dir,
    )
    .expect("debe crear");

    assert_eq!(creado["prestable"], false);
    assert_eq!(creado["categoria_id"], 1, "se expone la categoría real");
    assert_eq!(creado["notas"], "Pendiente de ajuste", "la nota se recorta y se expone");
    let guardada: Option<String> = conectar(&dir)
        .query_row("SELECT notas FROM articulo WHERE id = 1", [], |r| r.get(0))
        .unwrap();
    assert_eq!(guardada.as_deref(), Some("Pendiente de ajuste"), "nota recortada");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_rechaza_nombre_vacio() {
    let dir = dir_con_categoria("alta_vacio");

    for nombre in ["", "   ", "\t"] {
        let err = invoke(
            "crear_articulo",
            Some(json!({ "datos": { "nombre": nombre, "categoria_id": 1, "cantidad_inicial": 1 } })),
            &dir,
        )
        .expect_err("nombre obligatorio");
        assert!(mensaje_de_error(err).contains("obligatorio"), "nombre={nombre:?}");
    }
    assert_eq!(contar_movimientos(&dir), 0, "ningún alta a medias");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_rechaza_categoria_inexistente_o_inactiva() {
    let dir = dir_con_esquema_real("alta_categoria");
    sembrar_categoria(&dir, 1, "Activa", true);
    sembrar_categoria(&dir, 2, "Inactiva", false);

    let no_existe = invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "X", "categoria_id": 99, "cantidad_inicial": 1 } })),
        &dir,
    )
    .expect_err("categoría inexistente");
    assert!(mensaje_de_error(no_existe).contains("No se encontró la categoría"));

    let inactiva = invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "X", "categoria_id": 2, "cantidad_inicial": 1 } })),
        &dir,
    )
    .expect_err("categoría inactiva");
    assert!(mensaje_de_error(inactiva).contains("desactivada"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_rechaza_duplicado_en_la_misma_categoria() {
    let dir = dir_con_categoria("alta_dup");
    invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "Olla grande", "categoria_id": 1 } })),
        &dir,
    )
    .expect("primera creación");

    for nombre in ["olla grande", "  OLLA   GRANDE ", "Olla  grande"] {
        let err = invoke(
            "crear_articulo",
            Some(json!({ "datos": { "nombre": nombre, "categoria_id": 1, "cantidad_inicial": 5 } })),
            &dir,
        )
        .expect_err("duplicado en la categoría");
        assert!(mensaje_de_error(err).contains("Ya existe un artículo"), "nombre={nombre:?}");
    }
    assert_eq!(contar_movimientos_tipo(&dir, "alta"), 0, "ninguna alta asociada al rechazo");
    assert_eq!(contar_articulos(&dir), 1, "no se creó ninguno de más");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_permite_el_mismo_nombre_en_otra_categoria() {
    let dir = dir_con_esquema_real("alta_otra_cat");
    sembrar_categoria(&dir, 1, "A", true);
    sembrar_categoria(&dir, 2, "B", true);

    invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "Guantes", "categoria_id": 1 } })),
        &dir,
    )
    .expect("en A");
    let en_b = invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "guantes", "categoria_id": 2 } })),
        &dir,
    )
    .expect("mismo nombre, otra categoría");
    assert_eq!(en_b["categoria"], "B");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_rechaza_cantidad_negativa() {
    let dir = dir_con_categoria("alta_negativa");

    let err = invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "X", "categoria_id": 1, "cantidad_inicial": -3 } })),
        &dir,
    )
    .expect_err("cantidad negativa");
    assert!(mensaje_de_error(err).contains("menor que cero"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_con_control_individual_sin_unidades() {
    let dir = dir_con_categoria("alta_control_cero");

    let creado = invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "Taladro", "categoria_id": 1, "cantidad_inicial": 0, "control_individual": true } })),
        &dir,
    )
    .expect("control individual con 0 unidades es válido");

    assert_eq!(creado["control_individual"], true);
    assert_eq!(contadores(&dir, 1), (0, 0, 0, 0, 0));
    assert_eq!(contar_movimientos(&dir), 0, "sin unidades no hay alta");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_rechaza_cantidad_distinta_al_numero_de_unidades() {
    let dir = dir_con_categoria("alta_control_desajuste");

    let err = invoke(
        "crear_articulo",
        Some(json!({ "datos": {
            "nombre": "Taladro",
            "categoria_id": 1,
            "cantidad_inicial": 2,
            "control_individual": true,
            "unidades": [ { "codigo": "T-1" } ]
        } })),
        &dir,
    )
    .expect_err("cantidad y unidades no coinciden");
    assert!(mensaje_de_error(err).contains("coincidir"));
    assert_eq!(contar_articulos(&dir), 0, "rollback del artículo");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_rechaza_unidades_sin_control_individual() {
    let dir = dir_con_categoria("alta_sin_control_unidades");

    let err = invoke(
        "crear_articulo",
        Some(json!({ "datos": {
            "nombre": "Martillo",
            "categoria_id": 1,
            "cantidad_inicial": 1,
            "control_individual": false,
            "unidades": [ { "codigo": "M-1" } ]
        } })),
        &dir,
    )
    .expect_err("unidades exigen control individual");
    assert!(mensaje_de_error(err).contains("control individual"));
    assert_eq!(contar_articulos(&dir), 0);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_limita_la_nota_a_200_caracteres() {
    let dir = dir_con_categoria("alta_nota");
    let larga = "á".repeat(201);

    let err = invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "X", "categoria_id": 1, "notas": larga } })),
        &dir,
    )
    .expect_err("nota demasiado larga");
    assert!(mensaje_de_error(err).contains("200 caracteres"));

    let justa = "á".repeat(200);
    let ok = invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "Y", "categoria_id": 1, "notas": justa } })),
        &dir,
    )
    .expect("200 caracteres es válido");
    assert_eq!(ok["nombre"], "Y");

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Edición
// ---------------------------------------------------------------------------

#[test]
fn actualizar_articulo_cambia_nombre_categoria_prestable_y_notas() {
    let dir = dir_con_esquema_real("editar");
    sembrar_categoria(&dir, 1, "A", true);
    sembrar_categoria(&dir, 2, "B", true);
    invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "Viejo", "categoria_id": 1, "cantidad_inicial": 4 } })),
        &dir,
    )
    .unwrap();

    let actualizado = invoke(
        "actualizar_articulo",
        Some(json!({ "datos": { "id": 1, "nombre": "Nuevo", "categoria_id": 2, "prestable": false, "notas": "  revisado  " } })),
        &dir,
    )
    .expect("debe actualizar");

    assert_eq!(actualizado["nombre"], "Nuevo");
    assert_eq!(actualizado["categoria"], "B");
    assert_eq!(actualizado["prestable"], false);
    let nota: Option<String> = conectar(&dir)
        .query_row("SELECT notas FROM articulo WHERE id = 1", [], |r| r.get(0))
        .unwrap();
    assert_eq!(nota.as_deref(), Some("revisado"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn actualizar_articulo_permite_conservar_su_propio_nombre() {
    let dir = dir_con_categoria("editar_mismo");
    invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "Propio", "categoria_id": 1 } })),
        &dir,
    )
    .unwrap();

    let actualizado = invoke(
        "actualizar_articulo",
        Some(json!({ "datos": { "id": 1, "nombre": "  PROPIO ", "categoria_id": 1, "prestable": false } })),
        &dir,
    )
    .expect("no es duplicado de sí mismo");
    assert_eq!(actualizado["nombre"], "PROPIO");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn actualizar_articulo_rechaza_duplicado_con_otro_articulo() {
    let dir = dir_con_categoria("editar_dup");
    invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "Alfa", "categoria_id": 1 } })),
        &dir,
    )
    .unwrap();
    invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "Beta", "categoria_id": 1 } })),
        &dir,
    )
    .unwrap();

    let err = invoke(
        "actualizar_articulo",
        Some(json!({ "datos": { "id": 2, "nombre": "  alfa ", "categoria_id": 1, "prestable": true } })),
        &dir,
    )
    .expect_err("duplicado");
    assert!(mensaje_de_error(err).contains("Ya existe un artículo"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn actualizar_articulo_no_toca_contadores_ni_movimientos() {
    let dir = dir_con_categoria("editar_intacto");
    sembrar_articulo(&dir, 1, 1, (10, 7, 3, 0, 0), false, true);

    let antes = contadores(&dir, 1);
    invoke(
        "actualizar_articulo",
        Some(json!({ "datos": { "id": 1, "nombre": "Renombrado", "categoria_id": 1, "prestable": false, "notas": "x" } })),
        &dir,
    )
    .expect("debe actualizar");

    assert_eq!(contadores(&dir, 1), antes, "contadores intactos");
    assert_eq!(contar_movimientos(&dir), 0, "editar no genera movimientos");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn actualizar_articulo_inexistente_falla() {
    let dir = dir_con_categoria("editar_inexistente");

    let err = invoke(
        "actualizar_articulo",
        Some(json!({ "datos": { "id": 99, "nombre": "X", "categoria_id": 1, "prestable": true } })),
        &dir,
    )
    .expect_err("no existe");
    assert!(mensaje_de_error(err).contains("No se encontró el artículo"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn actualizar_articulo_rechaza_categoria_inactiva() {
    let dir = dir_con_esquema_real("editar_cat_inactiva");
    sembrar_categoria(&dir, 1, "Activa", true);
    sembrar_categoria(&dir, 2, "Inactiva", false);
    invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "X", "categoria_id": 1 } })),
        &dir,
    )
    .unwrap();

    let err = invoke(
        "actualizar_articulo",
        Some(json!({ "datos": { "id": 1, "nombre": "X", "categoria_id": 2, "prestable": true } })),
        &dir,
    )
    .expect_err("categoría inactiva");
    assert!(mensaje_de_error(err).contains("desactivada"));

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Ajuste de existencias
// ---------------------------------------------------------------------------

#[test]
fn ajustar_existencias_avisa_sin_movimiento_si_no_cambia() {
    let dir = dir_con_categoria("ajuste_noop");
    sembrar_articulo(&dir, 1, 1, (5, 5, 0, 0, 0), false, true);

    let resultado = invoke(
        "ajustar_existencias",
        Some(json!({ "datos": { "id": 1, "nueva_cantidad": 5, "motivo": "Sin cambio" } })),
        &dir,
    )
    .expect("mismo valor es válido");
    assert_eq!(resultado["cantidad_total"], 5);
    assert_eq!(contar_movimientos(&dir), 0, "no genera movimiento");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn ajustar_existencias_al_alza_registra_ajuste_positivo() {
    let dir = dir_con_categoria("ajuste_mas");
    sembrar_articulo(&dir, 1, 1, (10, 8, 2, 0, 0), false, true);

    let resultado = invoke(
        "ajustar_existencias",
        Some(json!({ "datos": { "id": 1, "nueva_cantidad": 15, "motivo": "Sobrante de conteo" } })),
        &dir,
    )
    .expect("debe ajustar");

    assert_eq!(resultado["cantidad_total"], 15);
    assert_eq!(resultado["cantidad_disponible"], 13, "suma a lo disponible");
    assert_eq!(resultado["cantidad_prestada"], 2, "lo prestado no se toca");
    let (tipo, cantidad, referencia_tipo, _) = ultimo_movimiento(&dir);
    assert_eq!(tipo, "ajuste_positivo");
    assert_eq!(cantidad, 5);
    assert_eq!(referencia_tipo.as_deref(), Some("ajuste"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn ajustar_existencias_a_la_baja_registra_ajuste_negativo() {
    let dir = dir_con_categoria("ajuste_menos");
    sembrar_articulo(&dir, 1, 1, (10, 8, 2, 0, 0), false, true);

    let resultado = invoke(
        "ajustar_existencias",
        Some(json!({ "datos": { "id": 1, "nueva_cantidad": 4, "motivo": "Recuento" } })),
        &dir,
    )
    .expect("debe ajustar");

    assert_eq!(resultado["cantidad_total"], 4);
    assert_eq!(resultado["cantidad_disponible"], 2);
    assert_eq!(resultado["cantidad_prestada"], 2);
    let (tipo, cantidad, _, _) = ultimo_movimiento(&dir);
    assert_eq!(tipo, "ajuste_negativo");
    assert_eq!(cantidad, 6);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn ajustar_existencias_rechaza_bajar_mas_de_lo_disponible() {
    let dir = dir_con_categoria("ajuste_insuficiente");
    sembrar_articulo(&dir, 1, 1, (10, 7, 3, 0, 0), false, true);

    let err = invoke(
        "ajustar_existencias",
        Some(json!({ "datos": { "id": 1, "nueva_cantidad": 2, "motivo": "Recorte" } })),
        &dir,
    )
    .expect_err("no hay disponible suficiente");

    assert!(mensaje_de_error(err).contains("disponible"));
    assert_eq!(contadores(&dir, 1), (10, 7, 3, 0, 0), "rollback de contadores");
    assert_eq!(contar_movimientos(&dir), 0, "rollback de movimientos");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn ajustar_existencias_rechaza_cantidad_negativa() {
    let dir = dir_con_categoria("ajuste_negativo");
    sembrar_articulo(&dir, 1, 1, (5, 5, 0, 0, 0), false, true);

    let err = invoke(
        "ajustar_existencias",
        Some(json!({ "datos": { "id": 1, "nueva_cantidad": -1, "motivo": "x" } })),
        &dir,
    )
    .expect_err("negativa");
    assert!(mensaje_de_error(err).contains("menor que cero"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn ajustar_existencias_rechaza_motivo_vacio_o_muy_largo() {
    let dir = dir_con_categoria("ajuste_motivo");
    sembrar_articulo(&dir, 1, 1, (5, 5, 0, 0, 0), false, true);

    let vacio = invoke(
        "ajustar_existencias",
        Some(json!({ "datos": { "id": 1, "nueva_cantidad": 6, "motivo": "   " } })),
        &dir,
    )
    .expect_err("motivo vacío");
    assert!(mensaje_de_error(vacio).contains("motivo"));

    let largo = invoke(
        "ajustar_existencias",
        Some(json!({ "datos": { "id": 1, "nueva_cantidad": 6, "motivo": "x".repeat(201) } })),
        &dir,
    )
    .expect_err("motivo largo");
    assert!(mensaje_de_error(largo).contains("200 caracteres"));

    assert_eq!(contar_movimientos(&dir), 0);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn ajustar_existencias_rechaza_articulos_con_control_individual() {
    let dir = dir_con_categoria("ajuste_control");
    sembrar_articulo(&dir, 1, 1, (3, 3, 0, 0, 0), true, true);

    let err = invoke(
        "ajustar_existencias",
        Some(json!({ "datos": { "id": 1, "nueva_cantidad": 4, "motivo": "x" } })),
        &dir,
    )
    .expect_err("control individual");
    assert!(mensaje_de_error(err).contains("control individual"));
    assert_eq!(contar_movimientos(&dir), 0);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn ajustar_existencias_inexistente_falla() {
    let dir = dir_con_categoria("ajuste_inexistente");

    let err = invoke(
        "ajustar_existencias",
        Some(json!({ "datos": { "id": 42, "nueva_cantidad": 1, "motivo": "x" } })),
        &dir,
    )
    .expect_err("no existe");
    assert!(mensaje_de_error(err).contains("No se encontró el artículo"));

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Invariantes y compatibilidad
// ---------------------------------------------------------------------------

#[test]
fn la_invariante_rn02_se_conserva_tras_una_secuencia() {
    let dir = dir_con_categoria("secuencia");
    sembrar_articulo(&dir, 1, 1, (10, 7, 3, 0, 0), false, true);

    invoke("ajustar_existencias", Some(json!({ "datos": { "id": 1, "nueva_cantidad": 18, "motivo": "Sube" } })), &dir).unwrap();
    invoke("ajustar_existencias", Some(json!({ "datos": { "id": 1, "nueva_cantidad": 12, "motivo": "Baja" } })), &dir).unwrap();
    invoke(
        "actualizar_articulo",
        Some(json!({ "datos": { "id": 1, "nombre": "Otro", "categoria_id": 1, "prestable": false } })),
        &dir,
    )
    .unwrap();

    let incoherencias: i64 = conectar(&dir)
        .query_row(
            "SELECT COUNT(*) FROM articulo \
             WHERE cantidad_total <> cantidad_disponible + cantidad_prestada \
                                    + cantidad_daniada + cantidad_faltante",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(incoherencias, 0, "RN-02 debe cumplirse");
    assert_eq!(contadores(&dir, 1), (12, 9, 3, 0, 0));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn los_comandos_de_lectura_reflejan_las_escrituras() {
    let dir = dir_con_categoria("compat");

    invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "Cucharas", "categoria_id": 1, "cantidad_inicial": 4 } })),
        &dir,
    )
    .unwrap();
    invoke(
        "ajustar_existencias",
        Some(json!({ "datos": { "id": 1, "nueva_cantidad": 9, "motivo": "Reposición" } })),
        &dir,
    )
    .unwrap();

    let articulos = invoke("listar_articulos", None, &dir).expect("listar");
    let arr = articulos.as_array().unwrap();
    assert_eq!(arr.len(), 1, "json={articulos}");
    assert_eq!(arr[0]["cantidad_total"], 9);
    assert_eq!(arr[0]["cantidad_disponible"], 9);

    let stats = invoke("obtener_estadisticas_inventario", None, &dir).expect("estadísticas");
    assert_eq!(stats["unidades_totales"], 9);
    assert_eq!(stats["articulos_registrados"], 1);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn listar_articulos_expone_categoria_id_y_notas() {
    let dir = dir_con_categoria("lectura_precarga");

    invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "Con nota", "categoria_id": 1, "notas": "  guardar esto  " } })),
        &dir,
    )
    .unwrap();
    invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "Sin nota", "categoria_id": 1 } })),
        &dir,
    )
    .unwrap();

    let articulos = invoke("listar_articulos", None, &dir).expect("listar");
    let arr = articulos.as_array().unwrap();
    assert_eq!(arr.len(), 2, "json={articulos}");

    let con_nota = arr.iter().find(|a| a["nombre"] == "Con nota").unwrap();
    assert_eq!(con_nota["categoria_id"], 1, "se expone el id de la categoría");
    assert_eq!(con_nota["notas"], "guardar esto", "se expone la nota recortada");

    let sin_nota = arr.iter().find(|a| a["nombre"] == "Sin nota").unwrap();
    assert_eq!(sin_nota["notas"], serde_json::Value::Null);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Base ausente / esquema incompleto
// ---------------------------------------------------------------------------

#[test]
fn las_escrituras_fallan_si_no_hay_base() {
    let dir = std::env::temp_dir().join("stocklend_f3_sin_base");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();

    let err = invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "X", "categoria_id": 1 } })),
        &dir,
    )
    .expect_err("no hay base");
    assert!(mensaje_de_error(err).contains("No se encontró"));
    assert!(!ruta_db(&dir).exists(), "no debe crear el archivo");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_articulo_falla_si_el_esquema_no_esta_inicializado() {
    let dir = fresh_dir("esquema_incompleto");
    {
        let conn = conectar(&dir);
        conn.execute_batch("CREATE TABLE categoria (id INTEGER PRIMARY KEY);").unwrap();
    }

    let err = invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "X", "categoria_id": 1 } })),
        &dir,
    )
    .expect_err("esquema incompleto");
    assert!(mensaje_de_error(err).contains("no está inicializado"));

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Base real intacta
// ---------------------------------------------------------------------------

#[test]
fn las_escrituras_no_alteran_la_base_real() {
    let ruta_real = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("data")
        .join(paths::DB_FILENAME);
    let antes = std::fs::read(&ruta_real).expect("base real legible");

    let dir = dir_con_categoria("base_real_intacta");
    invoke(
        "crear_articulo",
        Some(json!({ "datos": { "nombre": "Temporal", "categoria_id": 1, "cantidad_inicial": 3 } })),
        &dir,
    )
    .unwrap();
    invoke(
        "ajustar_existencias",
        Some(json!({ "datos": { "id": 1, "nueva_cantidad": 1, "motivo": "Prueba" } })),
        &dir,
    )
    .unwrap();
    let _ = std::fs::remove_dir_all(&dir);

    let despues = std::fs::read(&ruta_real).expect("base real legible");
    assert_eq!(antes, despues, "la base real no debe cambiar");
}
