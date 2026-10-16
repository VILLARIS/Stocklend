//! Tests de Devoluciones (Etapa B): comandos `listar_devoluciones_pendientes`,
//! `obtener_detalle_devolucion`, `listar_historial_devoluciones` y
//! `obtener_estadisticas_devoluciones` mediante el despachador IPC real de Tauri
//! (runtime simulado), sobre bases temporales con el **esquema real**
//! (`stocklend/data/migrations/0001_inicial.sql`). Nunca tocan la base real.
//!
//! Cubren: base sin préstamos, préstamo activo con pendientes, préstamo sin fecha
//! límite, préstamo vencido, parcialmente devuelto, totalmente devuelto, cerrado,
//! anulado, varios artículos, múltiples devoluciones del mismo préstamo,
//! cantidades dañadas y perdidas, control individual, préstamo inexistente,
//! estadísticas sin doble conteo, esquema ausente o incompleto y confirmación de
//! que las consultas no modifican SQLite.
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

/// `STOCKLEND_DATA_DIR` es global en el proceso: serializa los tests que lo usan.
static ENV_LOCK: Mutex<()> = Mutex::new(());

/// Marca temporal usada en los `INSERT` de apoyo.
const AHORA: &str = "2026-01-01T10:00:00";

/// Fecha límite muy anterior a cualquier "hoy": el préstamo vence si sigue activo.
const LIMITE_PASADO: &str = "2000-01-01";

/// Fecha límite muy posterior a cualquier "hoy": nunca vence.
const LIMITE_FUTURO: &str = "2999-12-31";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

fn fresh_temp_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("stocklend_devoluciones_{tag}"));
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

/// Despacha un comando de Devoluciones por el IPC real con la app simulada.
fn despachar(cmd: &str, args: Option<Value>) -> Result<Value, Value> {
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![
            stocklend_lib::commands::devoluciones::listar_devoluciones_pendientes,
            stocklend_lib::commands::devoluciones::obtener_detalle_devolucion,
            stocklend_lib::commands::devoluciones::listar_historial_devoluciones,
            stocklend_lib::commands::devoluciones::obtener_estadisticas_devoluciones,
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
        Ok(cuerpo) => Ok(cuerpo.deserialize::<Value>().unwrap()),
        Err(err) => Err(err),
    }
}

/// Directorio temporal con el esquema real y un escenario de devoluciones.
///
/// - Préstamo 1: `activo`, límite futuro, dos renglones (uno con control
///   individual y unidades concretas) → pendiente, no vencido.
/// - Préstamo 2: `activo`, límite pasado, parcialmente devuelto → vencido.
/// - Préstamo 3: `cerrado`, totalmente devuelto.
/// - Préstamo 4: `anulado`.
/// - Préstamo 5: `activo` sin fecha límite.
/// - Préstamo 6: `activo` con cantidades dañadas y perdidas (`con_incidente`).
/// - Préstamo 7: `activo` con dos devoluciones sobre el mismo renglón.
fn sembrar_escenario(dir: &Path) {
    let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
    conn.execute_batch(&esquema_real()).unwrap();
    conn.execute_batch(&format!(
        "INSERT INTO categoria (id, nombre, activo, creado_en)
             VALUES (1, 'General', 1, '{AHORA}');
         INSERT INTO articulo (id, codigo, nombre, categoria_id, control_individual,
                               cantidad_total, cantidad_disponible, cantidad_prestada,
                               cantidad_daniada, cantidad_faltante, creado_en, actualizado_en)
             VALUES (1, 'ART-1', 'Olla', 1, 0, 20, 5, 12, 2, 1, '{AHORA}', '{AHORA}');
         INSERT INTO articulo (id, codigo, nombre, categoria_id, control_individual,
                               cantidad_total, cantidad_disponible, cantidad_prestada,
                               cantidad_daniada, cantidad_faltante, creado_en, actualizado_en)
             VALUES (2, 'ART-2', 'Cuchillo', 1, 1, 5, 2, 3, 0, 0, '{AHORA}', '{AHORA}');

         INSERT INTO estudiante (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en)
             VALUES (1, '2023-0001', 'Ana', 'Ramirez', 1, '{AHORA}', '{AHORA}');
         INSERT INTO estudiante (id, codigo_universitario, nombres, apellidos, activo, creado_en, actualizado_en)
             VALUES (2, '2023-0002', 'Luis', 'Alvarez', 1, '{AHORA}', '{AHORA}');

         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, comentario, creado_en)
             VALUES (1, 'PRE-2026-000001', 1, '2026-10-10T09:00:00', '{LIMITE_FUTURO}', 'activo', 'Entrega de laboratorio', '{AHORA}');
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
             VALUES (2, 'PRE-2026-000002', 1, '2026-10-09T09:00:00', '{LIMITE_PASADO}', 'activo', '{AHORA}');
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en, cerrado_en)
             VALUES (3, 'PRE-2026-000003', 2, '2026-10-05T09:00:00', '{LIMITE_PASADO}', 'cerrado', '{AHORA}', '2026-10-06T09:00:00');
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
             VALUES (4, 'PRE-2026-000004', 1, '2026-10-01T09:00:00', '{LIMITE_PASADO}', 'anulado', '{AHORA}');
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
             VALUES (5, 'PRE-2026-000005', 1, '2026-10-08T09:00:00', NULL, 'activo', '{AHORA}');
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
             VALUES (6, 'PRE-2026-000006', 1, '2026-10-07T08:00:00', '{LIMITE_FUTURO}', 'activo', '{AHORA}');
         INSERT INTO prestamo (id, folio, estudiante_id, fecha_prestamo, fecha_limite, estado, creado_en)
             VALUES (7, 'PRE-2026-000007', 1, '2026-10-07T09:00:00', '{LIMITE_FUTURO}', 'activo', '{AHORA}');

         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (1, 1, 1, 2, 0, 0, 0, 'pendiente');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (2, 1, 2, 3, 0, 0, 0, 'pendiente');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (3, 2, 1, 4, 1, 0, 0, 'parcial');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (4, 3, 1, 1, 1, 0, 0, 'devuelto');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (5, 4, 1, 5, 0, 0, 0, 'pendiente');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (6, 5, 1, 2, 0, 0, 0, 'pendiente');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (7, 6, 1, 3, 0, 1, 1, 'con_incidente');
         INSERT INTO prestamo_detalle (id, prestamo_id, articulo_id, cantidad_prestada, cantidad_devuelta, cantidad_daniada, cantidad_perdida, estado)
             VALUES (8, 7, 1, 4, 2, 0, 0, 'parcial');

         -- Unidades del renglón 2 (artículo 2, control individual).
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en)
             VALUES (1, 2, 'U-001', 'prestada', 2, '{AHORA}', '{AHORA}');
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en)
             VALUES (2, 2, 'U-002', 'prestada', 2, '{AHORA}', '{AHORA}');
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en)
             VALUES (3, 2, 'U-003', 'prestada', 2, '{AHORA}', '{AHORA}');
         -- No debe incluirse: dada de baja aunque esté ligada al renglón.
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en)
             VALUES (4, 2, 'U-004', 'baja', 2, '{AHORA}', '{AHORA}');
         -- No debe incluirse: disponible, sin préstamo.
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en)
             VALUES (5, 2, 'U-005', 'disponible', NULL, '{AHORA}', '{AHORA}');
         -- No debe incluirse: prestada, pero de otro préstamo (renglón 5).
         INSERT INTO articulo_unidad (id, articulo_id, codigo, estado, prestamo_detalle_id, creado_en, actualizado_en)
             VALUES (6, 2, 'U-006', 'prestada', 5, '{AHORA}', '{AHORA}');

         -- Devoluciones (una por evento; el préstamo 7 tiene dos).
         INSERT INTO devolucion (id, prestamo_id, fecha_devolucion, observaciones, creado_en)
             VALUES (1, 7, '2026-10-08T10:00:00', 'Primera entrega', '{AHORA}');
         INSERT INTO devolucion (id, prestamo_id, fecha_devolucion, observaciones, creado_en)
             VALUES (2, 7, '2026-10-09T10:00:00', 'Segunda entrega', '{AHORA}');
         INSERT INTO devolucion (id, prestamo_id, fecha_devolucion, observaciones, creado_en)
             VALUES (3, 6, '2026-10-08T11:00:00', 'Vino roto', '{AHORA}');
         INSERT INTO devolucion (id, prestamo_id, fecha_devolucion, observaciones, creado_en)
             VALUES (4, 3, '2026-10-06T09:00:00', NULL, '{AHORA}');
         INSERT INTO devolucion (id, prestamo_id, fecha_devolucion, observaciones, creado_en)
             VALUES (5, 2, '2026-10-10T09:00:00', 'Parcial', '{AHORA}');

         INSERT INTO devolucion_detalle (id, devolucion_id, prestamo_detalle_id, cantidad_devuelta, cantidad_daniada, cantidad_perdida, notas)
             VALUES (1, 1, 8, 1, 0, 0, NULL);
         INSERT INTO devolucion_detalle (id, devolucion_id, prestamo_detalle_id, cantidad_devuelta, cantidad_daniada, cantidad_perdida, notas)
             VALUES (2, 2, 8, 1, 0, 0, NULL);
         INSERT INTO devolucion_detalle (id, devolucion_id, prestamo_detalle_id, cantidad_devuelta, cantidad_daniada, cantidad_perdida, notas)
             VALUES (3, 3, 7, 0, 1, 1, 'Dos tocados');
         INSERT INTO devolucion_detalle (id, devolucion_id, prestamo_detalle_id, cantidad_devuelta, cantidad_daniada, cantidad_perdida, notas)
             VALUES (4, 4, 4, 1, 0, 0, NULL);
         INSERT INTO devolucion_detalle (id, devolucion_id, prestamo_detalle_id, cantidad_devuelta, cantidad_daniada, cantidad_perdida, notas)
             VALUES (5, 5, 3, 1, 0, 0, NULL);",
    ))
    .unwrap();
}

fn buscar<'a>(arr: &'a Value, id: i64) -> &'a Value {
    arr.as_array()
        .unwrap()
        .iter()
        .find(|p| p["id"].as_i64() == Some(id))
        .unwrap_or_else(|| panic!("falta el préstamo {id}"))
}

fn codigos(linea: &Value) -> Vec<String> {
    linea["unidades"]
        .as_array()
        .unwrap()
        .iter()
        .map(|u| u["codigo"].as_str().unwrap().to_string())
        .collect()
}

// ---------------------------------------------------------------------------
// Base válida sin préstamos
// ---------------------------------------------------------------------------

#[test]
fn base_vacia_devuelve_lista_vacia_y_cero() {
    let dir = fresh_temp_dir("vacia");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(&esquema_real()).unwrap();
    }

    let pendientes = lista_dir(&dir, "listar_devoluciones_pendientes", None).expect("debe ser Ok");
    assert_eq!(pendientes.as_array().unwrap().len(), 0, "json={pendientes}");

    let stats =
        lista_dir(&dir, "obtener_estadisticas_devoluciones", None).expect("debe ser Ok");
    assert_eq!(stats["pendientes"], 0, "json={stats}");
    assert_eq!(stats["parciales"], 0);
    assert_eq!(stats["completadas"], 0);
    assert_eq!(stats["vencidas"], 0);
    assert_eq!(stats["unidades_pendientes"], 0);

    let historial =
        lista_dir(&dir, "listar_historial_devoluciones", None).expect("debe ser Ok");
    assert_eq!(historial.as_array().unwrap().len(), 0);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Lista de pendientes
// ---------------------------------------------------------------------------

#[test]
fn lista_pendientes_excluye_cerrado_anulado_y_ordena() {
    let dir = fresh_temp_dir("lista");
    sembrar_escenario(&dir);

    let lista = lista_dir(&dir, "listar_devoluciones_pendientes", None).expect("debe ser Ok");
    let ids: Vec<i64> = lista
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["id"].as_i64().unwrap())
        .collect();
    // Orden por fecha descendente: 1 (10/10), 2 (10/09), 5 (10/08), 7 y 6 (10/07).
    assert_eq!(ids, vec![1, 2, 5, 7, 6], "json={lista}");
    assert!(!ids.contains(&3), "un préstamo cerrado no debe listarse");
    assert!(!ids.contains(&4), "un préstamo anulado no debe listarse");

    let uno = buscar(&lista, 1);
    assert_eq!(uno["folio"], "PRE-2026-000001");
    assert_eq!(uno["estudiante_id"], 1);
    assert_eq!(uno["nombre_completo"], "Ana Ramirez");
    assert_eq!(uno["codigo_universitario"], "2023-0001");
    assert_eq!(uno["fecha_prestamo"], "2026-10-10");
    assert_eq!(uno["fecha_limite"], LIMITE_FUTURO);
    assert_eq!(uno["estado"], "activo");
    assert_eq!(uno["vencido"], false);
    assert_eq!(uno["comentario"], "Entrega de laboratorio");
    assert_eq!(uno["renglones"], 2);
    assert_eq!(uno["unidades_prestadas"], 5);
    assert_eq!(uno["unidades_devueltas"], 0);
    assert_eq!(uno["unidades_daniadas"], 0);
    assert_eq!(uno["unidades_perdidas"], 0);
    assert_eq!(uno["unidades_pendientes"], 5);

    // Vencido: activo con fecha límite pasada y pendiente.
    let dos = buscar(&lista, 2);
    assert_eq!(dos["vencido"], true);
    assert_eq!(dos["unidades_pendientes"], 3);

    // Sin fecha límite → nunca vencido.
    let cinco = buscar(&lista, 5);
    assert_eq!(cinco["fecha_limite"], Value::Null);
    assert_eq!(cinco["vencido"], false);

    // Dañadas y perdidas ya registradas se reflejan; pendiente = 3 - 1 - 1.
    let seis = buscar(&lista, 6);
    assert_eq!(seis["unidades_prestadas"], 3);
    assert_eq!(seis["unidades_daniadas"], 1);
    assert_eq!(seis["unidades_perdidas"], 1);
    assert_eq!(seis["unidades_pendientes"], 1);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------------

#[test]
fn detalle_incluye_renglones_unidades_y_elegibilidad() {
    let dir = fresh_temp_dir("detalle");
    sembrar_escenario(&dir);

    let detalle = lista_dir(&dir, "obtener_detalle_devolucion", Some(json!({ "prestamo_id": 1 })))
        .expect("debe ser Ok");
    assert_eq!(detalle["folio"], "PRE-2026-000001");
    assert_eq!(detalle["nombre_completo"], "Ana Ramirez");
    assert_eq!(detalle["codigo_universitario"], "2023-0001");
    assert_eq!(detalle["estado"], "activo");
    assert_eq!(detalle["vencido"], false);
    assert_eq!(detalle["elegible"], true);
    assert_eq!(detalle["comentario"], "Entrega de laboratorio");
    assert_eq!(detalle["creado_en"], "2026-01-01");
    assert_eq!(detalle["renglones"], 2);
    assert_eq!(detalle["unidades_prestadas"], 5);
    assert_eq!(detalle["unidades_pendientes"], 5);

    let lineas = detalle["lineas"].as_array().unwrap();
    assert_eq!(lineas.len(), 2);

    let olla = lineas.iter().find(|l| l["articulo"] == "Olla").unwrap();
    // El id del renglón y el id del artículo son distintos y no se confunden.
    assert_eq!(olla["id"], 1);
    assert_eq!(olla["articulo_id"], 1);
    assert_eq!(olla["cantidad_prestada"], 2);
    assert_eq!(olla["cantidad_pendiente"], 2);
    assert_eq!(olla["estado"], "pendiente");
    assert_eq!(olla["unidades"].as_array().unwrap().len(), 0);

    let cuchillo = lineas.iter().find(|l| l["articulo"] == "Cuchillo").unwrap();
    assert_eq!(cuchillo["id"], 2);
    assert_eq!(cuchillo["articulo_id"], 2);
    assert_eq!(cuchillo["cantidad_prestada"], 3);
    assert_eq!(cuchillo["cantidad_pendiente"], 3);
    assert_eq!(
        cuchillo["unidades"]
            .as_array()
            .unwrap()
            .iter()
            .map(|u| u["id"].as_i64().unwrap())
            .collect::<Vec<_>>(),
        vec![1, 2, 3],
        "solo unidades prestadas del renglón"
    );
    assert_eq!(codigos(cuchillo), vec!["U-001", "U-002", "U-003"]);

    // Detalle de un préstamo parcialmente devuelto.
    let parcial = lista_dir(&dir, "obtener_detalle_devolucion", Some(json!({ "prestamo_id": 2 })))
        .expect("debe ser Ok");
    assert_eq!(parcial["vencido"], true);
    assert_eq!(parcial["elegible"], true);
    let linea = &parcial["lineas"].as_array().unwrap()[0];
    assert_eq!(linea["cantidad_prestada"], 4);
    assert_eq!(linea["cantidad_devuelta"], 1);
    assert_eq!(linea["cantidad_pendiente"], 3);
    assert_eq!(linea["estado"], "parcial");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn detalle_no_elegible_para_cerrado_y_anulado() {
    let dir = fresh_temp_dir("detalle_no_elegible");
    sembrar_escenario(&dir);

    let cerrado = lista_dir(&dir, "obtener_detalle_devolucion", Some(json!({ "prestamo_id": 3 })))
        .expect("debe ser Ok");
    assert_eq!(cerrado["estado"], "cerrado");
    assert_eq!(cerrado["elegible"], false, "un préstamo cerrado no es elegible");
    assert_eq!(cerrado["unidades_pendientes"], 0);
    assert_eq!(cerrado["lineas"].as_array().unwrap().len(), 1);

    let anulado = lista_dir(&dir, "obtener_detalle_devolucion", Some(json!({ "prestamo_id": 4 })))
        .expect("debe ser Ok");
    assert_eq!(anulado["estado"], "anulado");
    assert_eq!(anulado["elegible"], false, "un préstamo anulado no es elegible");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn detalle_inexistente_es_error() {
    let dir = fresh_temp_dir("detalle_inexistente");
    sembrar_escenario(&dir);

    let err = lista_dir(&dir, "obtener_detalle_devolucion", Some(json!({ "prestamo_id": 999 })))
        .expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("No se encontró el préstamo"),
        "mensaje inesperado: {err}"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Historial
// ---------------------------------------------------------------------------

#[test]
fn historial_lista_eventos_con_renglones_y_cantidades() {
    let dir = fresh_temp_dir("historial");
    sembrar_escenario(&dir);

    let historial =
        lista_dir(&dir, "listar_historial_devoluciones", None).expect("debe ser Ok");
    let arr = historial.as_array().unwrap();
    assert_eq!(arr.len(), 5, "json={historial}");

    // Orden por fecha descendente: dv5 (10/10), dv2 (10/09), dv3 (10/08 11:00),
    // dv1 (10/08 10:00), dv4 (10/06).
    let ids: Vec<i64> = arr.iter().map(|d| d["id"].as_i64().unwrap()).collect();
    assert_eq!(ids, vec![5, 2, 3, 1, 4]);

    let con_danio = arr.iter().find(|d| d["id"] == 3).unwrap();
    assert_eq!(con_danio["prestamo_id"], 6);
    assert_eq!(con_danio["folio"], "PRE-2026-000006");
    assert_eq!(con_danio["nombre_completo"], "Ana Ramirez");
    assert_eq!(con_danio["observaciones"], "Vino roto");
    assert_eq!(con_danio["cantidad_devuelta"], 0);
    assert_eq!(con_danio["cantidad_daniada"], 1);
    assert_eq!(con_danio["cantidad_perdida"], 1);
    let linea = &con_danio["lineas"].as_array().unwrap()[0];
    assert_eq!(linea["prestamo_detalle_id"], 7);
    assert_eq!(linea["articulo_id"], 1);
    assert_eq!(linea["articulo"], "Olla");
    assert_eq!(linea["cantidad_daniada"], 1);
    assert_eq!(linea["cantidad_perdida"], 1);

    let completa = arr.iter().find(|d| d["id"] == 4).unwrap();
    assert_eq!(completa["observaciones"], Value::Null);
    assert_eq!(completa["cantidad_devuelta"], 1);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn historial_filtra_por_prestamo_con_multiples_devoluciones() {
    let dir = fresh_temp_dir("historial_filtro");
    sembrar_escenario(&dir);

    let historial =
        lista_dir(&dir, "listar_historial_devoluciones", Some(json!({ "prestamo_id": 7 })))
            .expect("debe ser Ok");
    let arr = historial.as_array().unwrap();
    assert_eq!(arr.len(), 2, "un préstamo puede tener varias devoluciones");
    let ids: Vec<i64> = arr.iter().map(|d| d["id"].as_i64().unwrap()).collect();
    assert_eq!(ids, vec![2, 1]);
    for evento in arr {
        assert_eq!(evento["prestamo_id"], 7);
        assert_eq!(evento["lineas"].as_array().unwrap().len(), 1);
        assert_eq!(evento["lineas"][0]["prestamo_detalle_id"], 8);
        assert_eq!(evento["cantidad_devuelta"], 1);
    }

    // Un préstamo sin devoluciones devuelve una lista vacía.
    let vacio =
        lista_dir(&dir, "listar_historial_devoluciones", Some(json!({ "prestamo_id": 1 })))
            .expect("debe ser Ok");
    assert_eq!(vacio.as_array().unwrap().len(), 0);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Estadísticas
// ---------------------------------------------------------------------------

#[test]
fn estadisticas_no_duplican_y_coinciden_con_la_lista() {
    let dir = fresh_temp_dir("estadisticas");
    sembrar_escenario(&dir);

    let stats =
        lista_dir(&dir, "obtener_estadisticas_devoluciones", None).expect("debe ser Ok");
    assert_eq!(stats["pendientes"], 5, "préstamos 1, 2, 5, 6 y 7; json={stats}");
    assert_eq!(stats["parciales"], 3, "préstamos 2, 6 y 7 con devolución registrada");
    assert_eq!(stats["completadas"], 1, "préstamo cerrado 3");
    assert_eq!(stats["vencidas"], 1, "solo el préstamo activo 2");
    assert_eq!(stats["unidades_pendientes"], 13, "5 + 3 + 2 + 1 + 2");

    // Coherencia con el listado: no hay doble conteo por múltiples renglones o
    // devoluciones.
    let lista = lista_dir(&dir, "listar_devoluciones_pendientes", None).expect("debe ser Ok");
    assert_eq!(
        lista.as_array().unwrap().len() as i64,
        stats["pendientes"].as_i64().unwrap()
    );
    let historial =
        lista_dir(&dir, "listar_historial_devoluciones", Some(json!({ "prestamo_id": 7 })))
            .expect("debe ser Ok");
    assert_eq!(historial.as_array().unwrap().len(), 2);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Apertura
// ---------------------------------------------------------------------------

#[test]
fn base_ausente_es_error_y_no_crea_archivo() {
    let dir = fresh_temp_dir("ausente");
    let err = lista_dir(&dir, "listar_devoluciones_pendientes", None).expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("No se encontró"),
        "mensaje inesperado: {err}"
    );
    assert!(!dir.join(paths::DB_FILENAME).exists(), "no debe crearse la base");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn esquema_no_inicializado_es_error() {
    let dir = fresh_temp_dir("sin_esquema");
    {
        let _ = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
    }
    let err = lista_dir(&dir, "listar_devoluciones_pendientes", None).expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("no está inicializado"),
        "mensaje inesperado: {err}"
    );
    let _ = std::fs::remove_dir_all(&dir);

    let dir = fresh_temp_dir("parcial");
    {
        let conn = Connection::open(dir.join(paths::DB_FILENAME)).unwrap();
        conn.execute_batch(
            "CREATE TABLE prestamo (id INTEGER PRIMARY KEY); \
             CREATE TABLE prestamo_detalle (id INTEGER PRIMARY KEY); \
             CREATE TABLE devolucion (id INTEGER PRIMARY KEY);",
        )
        .unwrap();
    }
    let err = lista_dir(&dir, "listar_devoluciones_pendientes", None).expect_err("debe ser Err");
    assert!(
        err.as_str().unwrap_or_default().contains("no está inicializado"),
        "mensaje inesperado: {err}"
    );
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn no_modifica_el_archivo_sqlite() {
    let dir = fresh_temp_dir("sin_cambios");
    sembrar_escenario(&dir);

    let ruta = dir.join(paths::DB_FILENAME);
    let antes = std::fs::read(&ruta).unwrap();

    let _ = lista_dir(&dir, "listar_devoluciones_pendientes", None).expect("lista");
    let _ = lista_dir(&dir, "obtener_detalle_devolucion", Some(json!({ "prestamo_id": 1 })))
        .expect("detalle");
    let _ = lista_dir(&dir, "listar_historial_devoluciones", None).expect("historial");
    let _ = lista_dir(&dir, "obtener_estadisticas_devoluciones", None).expect("estadísticas");

    let despues = std::fs::read(&ruta).unwrap();
    assert_eq!(antes, despues, "la base no debe modificarse");
    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Invocación con directorio fijado
// ---------------------------------------------------------------------------

/// Invoca un comando fijando `STOCKLEND_DATA_DIR` al directorio dado.
///
/// Envuelve [`despachar`] con el bloqueo global de entorno, igual que las
/// pruebas de Préstamos.
fn lista_dir(
    dir: &Path,
    cmd: &str,
    args: Option<Value>,
) -> Result<Value, Value> {
    let _guard = ENV_LOCK.lock().unwrap();
    unsafe { std::env::set_var(paths::ENV_DATA_DIR, dir) };
    let out = despachar(cmd, args);
    unsafe { std::env::remove_var(paths::ENV_DATA_DIR) };
    out
}
