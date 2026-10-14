//! Tests de Estudiantes (Etapa B): comandos `listar_estudiantes`,
//! `obtener_estadisticas_estudiantes`, `obtener_historial_estudiante` y
//! `obtener_incidencias_estudiante` mediante el despachador IPC real de Tauri
//! (runtime simulado), sobre bases temporales con el **esquema real**
//! (`stocklend/data/migrations/0001_inicial.sql`). Nunca tocan la base real.
//!
//! Cubren los estados de la Etapa B §6: base válida con y sin estudiantes,
//! estudiante inexistente, estudiante sin préstamos, estudiante sin incidencias,
//! base ausente, esquema sin inicializar y errores de lectura.
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

/// Los cuatro comandos de Estudiantes, para iterar los casos de error.
const COMANDOS: [&str; 4] = [
    "listar_estudiantes",
    "obtener_estadisticas_estudiantes",
    "obtener_historial_estudiante",
    "obtener_incidencias_estudiante",
];

/// Marca temporal usada en los `INSERT` de apoyo.
const AHORA: &str = "2026-01-01T10:00:00Z";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

fn fresh_temp_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("stocklend_estudiantes_{tag}"));
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

/// Crea un directorio temporal con la base y el esquema real (sin registros).
/// Construye la app simulada y despacha un comando por el IPC real.
///
/// No toca `STOCKLEND_DATA_DIR`: eso lo hacen [`invoke`] e [`invoke_real`].
fn despachar(cmd: &str, args: Option<serde_json::Value>) -> Result<serde_json::Value, serde_json::Value> {
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![
            stocklend_lib::commands::students::listar_estudiantes,
            stocklend_lib::commands::students::obtener_estadisticas_estudiantes,
            stocklend_lib::commands::students::obtener_historial_estudiante,
            stocklend_lib::commands::students::obtener_incidencias_estudiante,
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
fn invoke_real(cmd: &str, args: Option<serde_json::Value>) -> Result<serde_json::Value, serde_json::Value> {
    let _guard = ENV_LOCK.lock().unwrap();
    unsafe { std::env::remove_var(paths::ENV_DATA_DIR) };
    despachar(cmd, args)
}

fn conectar(dir: &Path) -> Connection {
    Connection::open(dir.join(paths::DB_FILENAME)).unwrap()
}

fn sembrar_categoria(dir: &Path, id: i64, nombre: &str) {
    conectar(dir)
        .execute(
            "INSERT INTO categoria (id, nombre, activo, creado_en) VALUES (?1, ?2, 1, ?3)",
            params![id, nombre, AHORA],
        )
        .unwrap();
}

fn sembrar_articulo(dir: &Path, id: i64, nombre: &str) {
    conectar(dir)
        .execute(
            "INSERT INTO articulo \
             (id, nombre, categoria_id, cantidad_total, cantidad_disponible, \
              cantidad_prestada, cantidad_daniada, cantidad_faltante, creado_en, actualizado_en) \
             VALUES (?1, ?2, 1, 0, 0, 0, 0, 0, ?3, ?3)",
            params![id, nombre, AHORA],
        )
        .unwrap();
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

fn sembrar_prestamo(
    dir: &Path,
    id: i64,
    folio: &str,
    estudiante_id: i64,
    fecha: &str,
    fecha_limite: Option<&str>,
    estado: &str,
) {
    conectar(dir)
        .execute(
            "INSERT INTO prestamo \
             (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, folio, estudiante_id, fecha, fecha_limite, estado, AHORA],
        )
        .unwrap();
}

/// Incidencia de depósito (`origen = 'stock'`) con responsabilidad del estudiante.
fn sembrar_incidencia(dir: &Path, id: i64, tipo: &str, estado: &str, articulo_id: i64, estudiante_id: i64) {
    conectar(dir)
        .execute(
            "INSERT INTO incidente \
             (id, tipo, estado, origen, prestamo_id, articulo_id, estudiante_id, \
              responsabilidad, cantidad, descripcion, creado_en) \
             VALUES (?1, ?2, ?3, 'stock', NULL, ?4, ?5, 'estudiante', 1, 'Incidencia de prueba', ?6)",
            params![id, tipo, estado, articulo_id, estudiante_id, AHORA],
        )
        .unwrap();
}

fn sembrar_incidencia_de_prestamo(
    dir: &Path,
    id: i64,
    tipo: &str,
    estado: &str,
    articulo_id: i64,
    estudiante_id: i64,
    prestamo_id: i64,
) {
    conectar(dir)
        .execute(
            "INSERT INTO incidente \
             (id, tipo, estado, origen, prestamo_id, articulo_id, estudiante_id, \
              responsabilidad, cantidad, descripcion, creado_en) \
             VALUES (?1, ?2, ?3, 'prestamo', ?4, ?5, ?6, 'estudiante', 1, 'Incidencia de préstamo', ?7)",
            params![id, tipo, estado, prestamo_id, articulo_id, estudiante_id, AHORA],
        )
        .unwrap();
}

/// Incidente sin estudiante asociado (responsabilidad sin determinar).
fn sembrar_incidencia_sin_estudiante(dir: &Path, id: i64, articulo_id: i64) {
    conectar(dir)
        .execute(
            "INSERT INTO incidente \
             (id, tipo, estado, origen, prestamo_id, articulo_id, estudiante_id, \
              responsabilidad, cantidad, descripcion, creado_en) \
             VALUES (?1, 'otro', 'abierto', 'stock', NULL, ?2, NULL, 'sin_determinar', 1, 'Sin responsable', ?3)",
            params![id, articulo_id, AHORA],
        )
        .unwrap();
}

// ---------------------------------------------------------------------------
// Base válida pero vacía
// ---------------------------------------------------------------------------

#[test]
fn estudiantes_base_vacia_devuelve_lista_vacia_y_cero() {
    let dir = fresh_temp_dir("vacia");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(&esquema_real()).unwrap();
    }

    let lista = invoke("listar_estudiantes", None, &dir).expect("debe ser Ok");
    assert_eq!(lista.as_array().unwrap().len(), 0, "json={lista}");

    let stats =
        invoke("obtener_estadisticas_estudiantes", None, &dir).expect("debe ser Ok");
    assert_eq!(stats["registrados"], 0);
    assert_eq!(stats["con_prestamos_activos"], 0);
    assert_eq!(stats["con_incidencias"], 0);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Directorio y estadísticas
// ---------------------------------------------------------------------------

#[test]
fn estudiantes_directorio_calcula_recuentos_y_ordena_por_apellidos() {
    let dir = fresh_temp_dir("directorio");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(&esquema_real()).unwrap();
        conn.execute_batch(
            "INSERT INTO categoria (id, nombre, activo, creado_en) VALUES (1, 'General', 1, '2026-01-01T10:00:00Z');
             INSERT INTO articulo (id, nombre, categoria_id, cantidad_total, cantidad_disponible,
                                   cantidad_prestada, cantidad_daniada, cantidad_faltante,
                                   creado_en, actualizado_en)
                VALUES (1, 'Cuchillo', 1, 0, 0, 0, 0, 0, '2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z');
             INSERT INTO estudiante (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en)
                VALUES (1, '2023-0001', 'Ana', 'Zapata', 1, '2026-01-02T10:00:00Z', '2026-01-02T10:00:00Z');
             INSERT INTO estudiante (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en)
                VALUES (2, '2023-0002', 'Luis', 'Alvarez', 0, '2026-01-03T10:00:00Z', '2026-01-03T10:00:00Z');
             INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
                VALUES (1, 'PRE-2026-000001', 1, '2026-10-10T09:00:00Z', '2026-10-17', 'activo', '2026-10-10T09:00:00Z');
             INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
                VALUES (2, 'PRE-2026-000002', 1, '2026-10-05T09:00:00Z', NULL, 'cerrado', '2026-10-05T09:00:00Z');
             INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
                VALUES (3, 'PRE-2026-000003', 1, '2026-10-01T09:00:00Z', NULL, 'anulado', '2026-10-01T09:00:00Z');
             INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, estado)
                VALUES (1, 1, 1, 2, 'pendiente');
             INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, estado)
                VALUES (2, 2, 1, 1, 'pendiente');
             INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, estado)
                VALUES (3, 3, 1, 5, 'pendiente');
             INSERT INTO incidente (id, tipo, estado, origen, prestamo_id, articulo_id, estudiante_id,
                                    responsabilidad, cantidad, descripcion, creado_en)
                VALUES (1, 'perdida', 'abierto', 'stock', NULL, 1, 1, 'estudiante', 1, 'Perdido', '2026-10-08T10:00:00Z');",
        )
        .unwrap();
    }

    let lista = invoke("listar_estudiantes", None, &dir).expect("debe ser Ok");
    let arr = lista.as_array().unwrap();
    assert_eq!(arr.len(), 2, "json={lista}");

    // Orden por apellidos: Alvarez antes que Zapata.
    let luis = &arr[0];
    assert_eq!(luis["id"], 2);
    assert_eq!(luis["codigo_universitario"], "2023-0002");
    assert_eq!(luis["nombres"], "Luis");
    assert_eq!(luis["apellidos"], "Alvarez");
    assert_eq!(luis["nombre_completo"], "Luis Alvarez");
    assert_eq!(luis["activo"], false);
    assert_eq!(luis["creado_en"], "2026-01-03");
    assert_eq!(luis["prestamos_activos"], 0);
    assert_eq!(luis["prestamos_finalizados"], 0);
    assert_eq!(luis["unidades_activas"], 0);
    assert_eq!(luis["incidencias"], 0);

    let ana = &arr[1];
    assert_eq!(ana["id"], 1);
    assert_eq!(ana["nombre_completo"], "Ana Zapata");
    assert_eq!(ana["activo"], true);
    assert_eq!(ana["prestamos_activos"], 1);
    assert_eq!(luis["prestamos_finalizados"], 0);
    assert_eq!(ana["prestamos_finalizados"], 1, "solo cuenta 'cerrado', no 'anulado'");
    assert_eq!(ana["unidades_activas"], 2, "pendiente del préstamo activo");
    assert_eq!(arr[0]["prestamos_finalizados"], 0);
    assert_eq!(arr[1]["prestamos_activos"], 1);
    assert_eq!(arr[1]["incidencias"], 1);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn estudiantes_estadisticas_no_duplican_y_coinciden_con_el_listado() {
    let dir = fresh_temp_dir("estadisticas");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(&esquema_real()).unwrap();
        conn.execute_batch(
            "INSERT INTO categoria (id, nombre, activo, creado_en) VALUES (1, 'General', 1, '2026-01-01T10:00:00Z');
             INSERT INTO articulo (id, nombre, categoria_id, cantidad_total, cantidad_disponible,
                                   cantidad_prestada, cantidad_daniada, cantidad_faltante, creado_en, actualizado_en)
                VALUES (1, 'Equipo', 1, 0, 0, 0, 0, 0, '2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z');
             INSERT INTO estudiante (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en)
                VALUES (1, 'A-1', 'Ana', 'Uno', 1, '2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z');
             INSERT INTO estudiante (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en)
                VALUES (2, 'B-2', 'Beto', 'Dos', 1, '2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z');
             INSERT INTO estudiante (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en)
                VALUES (3, 'C-3', 'Carla', 'Tres', 1, '2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z');
             INSERT INTO estudiante (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en)
                VALUES (4, 'D-4', 'Diego', 'Cuatro', 0, '2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z');
             -- Ana: dos préstamos activos (no deben duplicar).
             INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, estado, creado_en)
                VALUES (1, 'PRE-2026-000001', 1, '2026-10-10T09:00:00Z', 'activo', '2026-10-10T09:00:00Z');
             INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, estado, creado_en)
                VALUES (2, 'PRE-2026-000002', 1, '2026-10-09T09:00:00Z', 'activo', '2026-10-09T09:00:00Z');
             -- Beto: un préstamo activo y dos incidencias.
             INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, estado, creado_en)
                VALUES (3, 'PRE-2026-000003', 2, '2026-10-08T09:00:00Z', 'activo', '2026-10-08T09:00:00Z');
             -- Diego (inactivo): un préstamo activo.
             INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, estado, creado_en)
                VALUES (4, 'PRE-2026-000004', 4, '2026-10-07T09:00:00Z', 'activo', '2026-10-07T09:00:00Z');
             INSERT INTO incidente (id, tipo, estado, origen, articulo_id, estudiante_id, responsabilidad,
                                    cantidad, descripcion, creado_en)
                VALUES (1, 'perdida', 'abierto', 'stock', 1, 2, 'estudiante', 1, 'X', '2026-10-01T10:00:00Z');
             INSERT INTO incidente (id, tipo, estado, origen, articulo_id, estudiante_id, responsabilidad,
                                    cantidad, descripcion, creado_en)
                VALUES (2, 'danio', 'resuelto', 'stock', 1, 2, 'estudiante', 1, 'Y', '2026-10-02T10:00:00Z');
             INSERT INTO incidente (id, tipo, estado, origen, articulo_id, estudiante_id, responsabilidad,
                                    cantidad, descripcion, creado_en)
                VALUES (3, 'otro', 'abierto', 'stock', 1, 3, 'estudiante', 1, 'Z', '2026-10-03T10:00:00Z');
             INSERT INTO incidente (id, tipo, estado, origen, articulo_id, estudiante_id, responsabilidad,
                                    cantidad, descripcion, creado_en)
                VALUES (4, 'otro', 'abierto', 'stock', 1, NULL, 'sin_determinar', 1, 'W', '2026-10-04T10:00:00Z');",
        )
        .unwrap();
    }

    let stats = invoke("obtener_estadisticas_estudiantes", None, &dir).expect("debe ser Ok");
    assert_eq!(stats["registrados"], 4, "json={stats}");
    assert_eq!(stats["con_prestamos_activos"], 3, "Ana, Beto y Diego (uno cada uno)");
    assert_eq!(stats["con_incidencias"], 2, "Beto y Carla");

    // Coherencia con el listado: los recuentos no se contradicen.
    let lista = invoke("listar_estudiantes", None, &dir).expect("debe ser Ok");
    let arr = lista.as_array().unwrap();
    let con_activos = arr.iter().filter(|e| e["prestamos_activos"].as_i64().unwrap() > 0).count();
    let con_incidencias = arr.iter().filter(|e| e["incidencias"].as_i64().unwrap() > 0).count();
    assert_eq!(con_activos as i64, stats["con_prestamos_activos"].as_i64().unwrap());
    assert_eq!(con_incidencias as i64, stats["con_incidencias"].as_i64().unwrap());

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Historial de préstamos
// ---------------------------------------------------------------------------

#[test]
fn estudiante_sin_prestamos_devuelve_historial_vacio() {
    let dir = fresh_temp_dir("sin_prestamos");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(&esquema_real()).unwrap();
    }
    sembrar_estudiante(&dir, 1, "A-1", "Ana", "Uno", true);

    let json = invoke("obtener_historial_estudiante", Some(json!({ "id": 1 })), &dir)
        .expect("debe ser Ok");
    assert_eq!(json.as_array().unwrap().len(), 0, "json={json}");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn historial_devuelve_prestamos_con_totales_y_orden_descendente() {
    let dir = fresh_temp_dir("historial");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(&esquema_real()).unwrap();
    }
    sembrar_estudiante(&dir, 1, "A-1", "Ana", "Uno", true);
    sembrar_categoria(&dir, 1, "General");
    sembrar_articulo(&dir, 1, "Cuchillo");
    sembrar_articulo(&dir, 2, "Colador");
    // Préstamo reciente con dos artículos y fecha límite.
    sembrar_prestamo(&dir, 1, "PRE-2026-000002", 1, "2026-10-10T09:00:00Z", Some("2026-10-17"), "activo");
    // Préstamo antiguo sin fecha límite.
    sembrar_prestamo(&dir, 2, "PRE-2026-000001", 1, "2026-10-01T09:00:00Z", None, "cerrado");
    conectar(&dir)
        .execute_batch(
            "INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, estado)
             VALUES (1, 1, 1, 2, 'pendiente');
             INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, estado)
             VALUES (2, 1, 2, 3, 'pendiente');
             INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, estado)
             VALUES (3, 2, 1, 1, 'pendiente');",
        )
        .unwrap();

    let json = invoke("obtener_historial_estudiante", Some(json!({ "id": 1 })), &dir)
        .expect("debe ser Ok");
    let arr = json.as_array().unwrap();
    assert_eq!(arr.len(), 2, "json={json}");

    assert_eq!(arr[0]["folio"], "PRE-2026-000002");
    assert_eq!(arr[0]["fecha"], "2026-10-10");
    assert_eq!(arr[0]["fecha_limite"], "2026-10-17");
    assert_eq!(arr[0]["estado"], "activo");
    assert_eq!(arr[0]["unidades"], 5, "2 + 3");
    assert_eq!(arr[0]["renglones"], 2);

    assert_eq!(arr[1]["folio"], "PRE-2026-000001");
    assert_eq!(arr[1]["fecha"], "2026-10-01");
    assert_eq!(arr[1]["fecha_limite"], serde_json::Value::Null);
    assert_eq!(arr[1]["estado"], "cerrado");
    assert_eq!(arr[1]["unidades"], 1);
    assert_eq!(arr[1]["renglones"], 1);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn estudiante_inexistente_es_error_en_historial() {
    let dir = fresh_temp_dir("historial_inexistente");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(&esquema_real()).unwrap();
    }

    let err = invoke("obtener_historial_estudiante", Some(json!({ "id": 999 })), &dir)
        .expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("No se encontró el estudiante"),
        "mensaje inesperado: {err}"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Incidencias
// ---------------------------------------------------------------------------

#[test]
fn estudiante_sin_incidencias_devuelve_lista_vacia() {
    let dir = fresh_temp_dir("sin_incidencias");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(&esquema_real()).unwrap();
    }
    sembrar_estudiante(&dir, 1, "A-1", "Ana", "Uno", true);

    let json = invoke("obtener_incidencias_estudiante", Some(json!({ "id": 1 })), &dir)
        .expect("debe ser Ok");
    assert_eq!(json.as_array().unwrap().len(), 0, "json={json}");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn incidencias_devuelve_solo_las_del_estudiante_con_datos_reales() {
    let dir = fresh_temp_dir("incidencias");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(&esquema_real()).unwrap();
    }
    sembrar_estudiante(&dir, 1, "A-1", "Ana", "Uno", true);
    sembrar_estudiante(&dir, 2, "B-2", "Beto", "Dos", true);
    sembrar_categoria(&dir, 1, "General");
    sembrar_articulo(&dir, 1, "Cuchillo");
    sembrar_articulo(&dir, 2, "Colador");
    sembrar_prestamo(&dir, 1, "PRE-2026-000001", 1, "2026-10-01T09:00:00Z", None, "activo");
    // De Ana: una de origen stock y una ligada a préstamo.
    sembrar_incidencia(&dir, 1, "perdida", "abierto", 1, 1);
    sembrar_incidencia_de_prestamo(&dir, 2, "danio", "resuelto", 2, 1, 1);
    // De Beto: no debe aparecer.
    sembrar_incidencia(&dir, 3, "otro", "abierto", 1, 2);
    // Sin estudiante: no debe aparecer.
    sembrar_incidencia_sin_estudiante(&dir, 4, 1);

    let json = invoke("obtener_incidencias_estudiante", Some(json!({ "id": 1 })), &dir)
        .expect("debe ser Ok");
    let arr = json.as_array().unwrap();
    assert_eq!(arr.len(), 2, "json={json}");

    let por_id = |id: i64| {
        arr.iter()
            .find(|i| i["id"].as_i64() == Some(id))
            .unwrap_or_else(|| panic!("falta la incidencia {id}: {json}"))
    };

    let stock = por_id(1);
    assert_eq!(stock["tipo"], "perdida");
    assert_eq!(stock["estado"], "abierto");
    assert_eq!(stock["fecha"], "2026-01-01");
    assert_eq!(stock["articulo"], "Cuchillo");
    assert_eq!(stock["cantidad"], 1);
    assert_eq!(stock["responsabilidad"], "estudiante");
    assert_eq!(stock["folio"], serde_json::Value::Null);

    let de_prestamo = por_id(2);
    assert_eq!(de_prestamo["tipo"], "danio");
    assert_eq!(de_prestamo["estado"], "resuelto");
    assert_eq!(de_prestamo["articulo"], "Colador");
    assert_eq!(de_prestamo["folio"], "PRE-2026-000001");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn estudiante_inexistente_es_error_en_incidencias() {
    let dir = fresh_temp_dir("incidencias_inexistente");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(&esquema_real()).unwrap();
    }

    let err = invoke("obtener_incidencias_estudiante", Some(json!({ "id": 999 })), &dir)
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
fn estudiantes_base_ausente_es_error_y_no_crea_archivo() {
    let dir = fresh_temp_dir("ausente");
    for cmd in COMANDOS {
        let args = match cmd {
            "obtener_historial_estudiante" | "obtener_incidencias_estudiante" => Some(json!({ "id": 1 })),
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
fn estudiantes_esquema_no_inicializado_es_error() {
    // Base vacía (sin tablas).
    let dir = fresh_temp_dir("sin_esquema");
    {
        let _ = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
    }
    for cmd in COMANDOS {
        let args = match cmd {
            "obtener_historial_estudiante" | "obtener_incidencias_estudiante" => Some(json!({ "id": 1 })),
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
        conn.execute_batch("CREATE TABLE estudiante (id INTEGER PRIMARY KEY);")
            .unwrap();
    }
    for cmd in COMANDOS {
        let args = match cmd {
            "obtener_historial_estudiante" | "obtener_incidencias_estudiante" => Some(json!({ "id": 1 })),
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
fn estudiantes_no_modifica_el_archivo_sqlite() {
    let dir = fresh_temp_dir("sin_cambios");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(&esquema_real()).unwrap();
    }
    sembrar_estudiante(&dir, 1, "A-1", "Ana", "Uno", true);
    sembrar_categoria(&dir, 1, "General");
    sembrar_articulo(&dir, 1, "Cuchillo");
    sembrar_prestamo(&dir, 1, "PRE-2026-000001", 1, "2026-10-01T09:00:00Z", None, "activo");
    sembrar_incidencia(&dir, 1, "perdida", "abierto", 1, 1);

    let ruta = dir.join(paths::DB_FILENAME);
    let antes = std::fs::read(&ruta).unwrap();

    let _ = invoke("listar_estudiantes", None, &dir).expect("listar");
    let _ = invoke("obtener_estadisticas_estudiantes", None, &dir).expect("estadísticas");
    let _ = invoke("obtener_historial_estudiante", Some(json!({ "id": 1 })), &dir).expect("historial");
    let _ = invoke("obtener_incidencias_estudiante", Some(json!({ "id": 1 })), &dir).expect("incidencias");

    let despues = std::fs::read(&ruta).unwrap();
    assert_eq!(antes, despues, "la base no debe modificarse");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn estudiantes_base_real_es_ok_con_forma_valida() {
    let lista = invoke_real("listar_estudiantes", None).expect("estudiantes reales");
    let stats = invoke_real("obtener_estadisticas_estudiantes", None).expect("estadísticas reales");

    let arr = lista.as_array().unwrap();
    let registrados = stats["registrados"].as_i64().unwrap();
    assert_eq!(registrados, arr.len() as i64, "stats={stats} json={lista}");

    // Los recuentos del directorio no contradicen las estadísticas.
    let con_activos = arr.iter().filter(|e| e["prestamos_activos"].as_i64().unwrap() > 0).count();
    let con_incidencias = arr.iter().filter(|e| e["incidencias"].as_i64().unwrap() > 0).count();
    assert_eq!(con_activos as i64, stats["con_prestamos_activos"].as_i64().unwrap());
    assert_eq!(con_incidencias as i64, stats["con_incidencias"].as_i64().unwrap());

    // Cada estudiante tiene forma válida y un identificador único.
    let mut ids: Vec<i64> = Vec::new();
    for e in arr {
        assert!(e["codigo_universitario"].is_string());
        assert!(e["nombres"].is_string());
        assert!(e["apellidos"].is_string());
        assert!(e["activo"].is_boolean());
        ids.push(e["id"].as_i64().unwrap());
    }
    let mut ordenados = ids.clone();
    ordenados.sort_unstable();
    ordenados.dedup();
    assert_eq!(ordenados.len(), ids.len(), "identificadores duplicados");

    // Historial e incidencias del primer estudiante (si existe) deben responder.
    if let Some(primero) = arr.first() {
        let id = primero["id"].as_i64().unwrap();
        let _ = invoke_real("obtener_historial_estudiante", Some(json!({ "id": id })))
            .expect("historial real");
        let _ = invoke_real("obtener_incidencias_estudiante", Some(json!({ "id": id })))
            .expect("incidencias reales");
    }

    // Un identificador inexistente es un error explícito.
    let inexistente = ids.iter().copied().max().unwrap_or(0) + 1;
    let err = invoke_real(
        "obtener_historial_estudiante",
        Some(json!({ "id": inexistente })),
    )
    .expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("No se encontró el estudiante"),
        "mensaje inesperado: {err}"
    );
}
