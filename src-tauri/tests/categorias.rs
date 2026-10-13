//! Tests del CRUD de categorías (Fase F2) a través del despachador IPC real
//! de Tauri, sobre bases SQLite temporales con el **esquema real**
//! (`stocklend/data/migrations/0001_inicial.sql`). Nunca tocan la base real.
//!
//! Se ejecutan con: `cargo test` (desde `src-tauri`).

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;
use serde_json::json;
use stocklend_lib::core::paths;
use stocklend_lib::services::categories;
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
    let dir = std::env::temp_dir().join(format!("stocklend_f2_{tag}"));
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
            stocklend_lib::commands::inventory::listar_categorias,
            stocklend_lib::commands::inventory::listar_articulos,
            stocklend_lib::commands::inventory::crear_categoria,
            stocklend_lib::commands::inventory::actualizar_categoria,
            stocklend_lib::commands::inventory::cambiar_estado_categoria,
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

/// Inserta un artículo activo asociado a una categoría (para probar que el
/// estado de la categoría no lo altera).
fn sembrar_articulo(conn: &Connection, articulo_id: i64, categoria_id: i64) {
    conn.execute(
        &format!(
            "INSERT INTO articulo \
             (id, nombre, categoria_id, cantidad_total, cantidad_disponible, \
              cantidad_prestada, cantidad_daniada, cantidad_faltante, creado_en, actualizado_en) \
             VALUES (?1, 'Artículo', ?2, 4, 3, 1, 0, 0, {AHORA}, {AHORA})"
        ),
        rusqlite::params![articulo_id, categoria_id],
    )
    .unwrap();
}

// ---------------------------------------------------------------------------
// Crear
// ---------------------------------------------------------------------------

#[test]
fn crear_categoria_devuelve_la_fila_y_persiste() {
    let dir = dir_con_esquema_real("crear");

    let creada = invoke(
        "crear_categoria",
        Some(json!({ "datos": { "nombre": "Limpieza", "descripcion": "Útiles de aseo" } })),
        &dir,
    )
    .expect("debe crear");

    assert_eq!(creada["nombre"], "Limpieza");
    assert_eq!(creada["descripcion"], "Útiles de aseo");
    assert_eq!(creada["activo"], true);
    assert_eq!(creada["articulos"], 0);
    assert!(creada["id"].as_i64().unwrap() > 0);

    let lista = invoke("listar_categorias", None, &dir).expect("listar");
    assert_eq!(lista.as_array().unwrap().len(), 1, "json={lista}");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn crear_categoria_admite_descripcion_opcional() {
    let dir = dir_con_esquema_real("descripcion");

    let sin = invoke(
        "crear_categoria",
        Some(json!({ "datos": { "nombre": "Sin nota", "descripcion": null } })),
        &dir,
    )
    .expect("debe crear");
    assert_eq!(sin["descripcion"], serde_json::Value::Null);

    let vacia = invoke(
        "crear_categoria",
        Some(json!({ "datos": { "nombre": "Nota vacía", "descripcion": "   " } })),
        &dir,
    )
    .expect("debe crear");
    assert_eq!(vacia["descripcion"], serde_json::Value::Null);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Editar
// ---------------------------------------------------------------------------

#[test]
fn actualizar_categoria_cambia_nombre_y_descripcion() {
    let dir = dir_con_esquema_real("editar");
    let creada = invoke(
        "crear_categoria",
        Some(json!({ "datos": { "nombre": "Reactivos", "descripcion": null } })),
        &dir,
    )
    .unwrap();
    let id = creada["id"].as_i64().unwrap();

    let actualizada = invoke(
        "actualizar_categoria",
        Some(json!({ "datos": { "id": id, "nombre": "Reactivos de laboratorio", "descripcion": "Químicos" } })),
        &dir,
    )
    .expect("debe actualizar");

    assert_eq!(actualizada["id"], id);
    assert_eq!(actualizada["nombre"], "Reactivos de laboratorio");
    assert_eq!(actualizada["descripcion"], "Químicos");
    assert_eq!(actualizada["activo"], true);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn actualizar_categoria_permite_conservar_su_propio_nombre() {
    let dir = dir_con_esquema_real("mismo_nombre");
    let creada = invoke(
        "crear_categoria",
        Some(json!({ "datos": { "nombre": "Herramientas", "descripcion": null } })),
        &dir,
    )
    .unwrap();
    let id = creada["id"].as_i64().unwrap();

    let actualizada = invoke(
        "actualizar_categoria",
        Some(json!({ "datos": { "id": id, "nombre": "Herramientas", "descripcion": "Nota nueva" } })),
        &dir,
    )
    .expect("no debe considerarse duplicado de sí misma");
    assert_eq!(actualizada["descripcion"], "Nota nueva");

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Validaciones
// ---------------------------------------------------------------------------

#[test]
fn rechaza_nombres_vacios_o_solo_espacios() {
    let dir = dir_con_esquema_real("vacio");

    for nombre in ["", "   ", "\t"] {
        let err = invoke(
            "crear_categoria",
            Some(json!({ "datos": { "nombre": nombre, "descripcion": null } })),
            &dir,
        )
        .expect_err("debe rechazar el nombre vacío");
        assert!(
            mensaje_de_error(err).contains("obligatorio"),
            "nombre={nombre:?}"
        );
    }

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn rechaza_duplicados_ignorando_mayusculas_y_espacios() {
    let dir = dir_con_esquema_real("duplicados");
    invoke(
        "crear_categoria",
        Some(json!({ "datos": { "nombre": "Utensilios · Ollas", "descripcion": null } })),
        &dir,
    )
    .expect("primera creación");

    for nombre in ["utensilios · ollas", "  UTENSILIOS   ·   OLLAS  ", "Utensilios  ·  Ollas"] {
        let err = invoke(
            "crear_categoria",
            Some(json!({ "datos": { "nombre": nombre, "descripcion": null } })),
            &dir,
        )
        .expect_err("debe rechazar el duplicado");
        assert!(
            mensaje_de_error(err).contains("Ya existe una categoría"),
            "nombre={nombre:?}"
        );
    }

    // No debe haberse creado ninguna de más.
    let lista = invoke("listar_categorias", None, &dir).unwrap();
    assert_eq!(lista.as_array().unwrap().len(), 1, "json={lista}");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn actualizar_rechaza_duplicado_con_otra_categoria() {
    let dir = dir_con_esquema_real("dup_editar");
    invoke(
        "crear_categoria",
        Some(json!({ "datos": { "nombre": "Alfa", "descripcion": null } })),
        &dir,
    )
    .unwrap();
    let beta = invoke(
        "crear_categoria",
        Some(json!({ "datos": { "nombre": "Beta", "descripcion": null } })),
        &dir,
    )
    .unwrap();
    let beta_id = beta["id"].as_i64().unwrap();

    let err = invoke(
        "actualizar_categoria",
        Some(json!({ "datos": { "id": beta_id, "nombre": "  ALFA ", "descripcion": null } })),
        &dir,
    )
    .expect_err("debe rechazar el duplicado");
    assert!(mensaje_de_error(err).contains("Ya existe una categoría"));

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Desactivar / reactivar
// ---------------------------------------------------------------------------

#[test]
fn desactivar_y_reactivar_categoria() {
    let dir = dir_con_esquema_real("estado");
    let creada = invoke(
        "crear_categoria",
        Some(json!({ "datos": { "nombre": "Vidrio", "descripcion": null } })),
        &dir,
    )
    .unwrap();
    let id = creada["id"].as_i64().unwrap();

    let desactivada = invoke(
        "cambiar_estado_categoria",
        Some(json!({ "datos": { "id": id, "activo": false } })),
        &dir,
    )
    .expect("debe desactivar");
    assert_eq!(desactivada["activo"], false);

    let reactivada = invoke(
        "cambiar_estado_categoria",
        Some(json!({ "datos": { "id": id, "activo": true } })),
        &dir,
    )
    .expect("debe reactivar");
    assert_eq!(reactivada["activo"], true);

    // La fila sigue existiendo (no se borra).
    let lista = invoke("listar_categorias", None, &dir).unwrap();
    assert_eq!(lista.as_array().unwrap().len(), 1);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn cambiar_estado_no_altera_los_articulos_existentes() {
    let dir = dir_con_esquema_real("articulos_intactos");
    let creada = invoke(
        "crear_categoria",
        Some(json!({ "datos": { "nombre": "Equipos", "descripcion": null } })),
        &dir,
    )
    .unwrap();
    let id = creada["id"].as_i64().unwrap();

    {
        let conn = Connection::open(ruta_db(&dir)).unwrap();
        sembrar_articulo(&conn, 1, id);
    }

    invoke(
        "cambiar_estado_categoria",
        Some(json!({ "datos": { "id": id, "activo": false } })),
        &dir,
    )
    .expect("debe desactivar");

    let lista = invoke("listar_categorias", None, &dir).unwrap();
    assert_eq!(lista[0]["activo"], false);
    assert_eq!(lista[0]["articulos"], 1, "el conteo se conserva");

    let articulos = invoke("listar_articulos", None, &dir).unwrap();
    assert_eq!(articulos.as_array().unwrap().len(), 1);
    assert_eq!(articulos[0]["activo"], true, "el artículo sigue activo");
    assert_eq!(articulos[0]["cantidad_total"], 4);
    assert_eq!(articulos[0]["cantidad_disponible"], 3);
    assert_eq!(articulos[0]["cantidad_prestada"], 1);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// IDs inexistentes
// ---------------------------------------------------------------------------

#[test]
fn rechaza_ids_inexistentes() {
    let dir = dir_con_esquema_real("inexistente");

    let err = invoke(
        "actualizar_categoria",
        Some(json!({ "datos": { "id": 999, "nombre": "Fantasma", "descripcion": null } })),
        &dir,
    )
    .expect_err("no existe");
    assert!(mensaje_de_error(err).contains("No se encontró la categoría"));

    let err = invoke(
        "cambiar_estado_categoria",
        Some(json!({ "datos": { "id": 999, "activo": false } })),
        &dir,
    )
    .expect_err("no existe");
    assert!(mensaje_de_error(err).contains("No se encontró la categoría"));

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Normalización (unidad)
// ---------------------------------------------------------------------------

#[test]
fn normalizacion_colapsa_espacios_y_minusculas() {
    assert_eq!(categories::normalizar_nombre("  Utensilios   ·   Ollas "), "utensilios · ollas");
    assert_eq!(categories::normalizar_nombre("A\tB\nC"), "a b c");
    assert_eq!(categories::normalizar_nombre("Ya·Normal"), "ya·normal");
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

    // Operaciones siempre sobre un directorio temporal.
    let dir = dir_con_esquema_real("base_real_intacta");
    invoke(
        "crear_categoria",
        Some(json!({ "datos": { "nombre": "Temporal", "descripcion": null } })),
        &dir,
    )
    .unwrap();
    let _ = std::fs::remove_dir_all(&dir);

    let despues = std::fs::read(&ruta_real).expect("base real legible");
    assert_eq!(antes, despues, "la base real no debe cambiar");
}
