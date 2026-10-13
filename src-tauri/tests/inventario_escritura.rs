//! Tests de la infraestructura de escritura (Fase F1).
//!
//! Usan exclusivamente bases SQLite temporales creadas con el **esquema real**
//! (`stocklend/data/migrations/0001_inicial.sql`). Nunca tocan la base real.
//! Cubren: apertura de escritura, base ausente, esquema inválido, foreign keys,
//! transacciones y rollback, reglas de movimientos, historial append-only y
//! compatibilidad con los comandos de solo lectura.
//!
//! Se ejecutan con: `cargo test` (desde `src-tauri`).

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;
use stocklend_lib::core::paths;
use stocklend_lib::db::connection;
use stocklend_lib::services::inventory::{self, Contadores, ErrorInventario, TipoMovimiento};
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
    let dir = std::env::temp_dir().join(format!("stocklend_f1_{tag}"));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// DDL real de la migración inicial.
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

/// Crea la categoría por defecto y un artículo con contadores coherentes.
fn sembrar_articulo(conn: &Connection, id: i64, c: Contadores) {
    conn.execute_batch(&format!(
        "INSERT OR IGNORE INTO categoria (id, nombre, creado_en) VALUES (1, 'General', {AHORA});"
    ))
    .unwrap();
    conn.execute(
        &format!(
            "INSERT INTO articulo \
             (id, nombre, categoria_id, cantidad_total, cantidad_disponible, \
              cantidad_prestada, cantidad_daniada, cantidad_faltante, creado_en, actualizado_en) \
             VALUES (?1, 'Artículo', 1, ?2, ?3, ?4, ?5, ?6, {AHORA}, {AHORA})"
        ),
        rusqlite::params![id, c.total, c.disponible, c.prestada, c.danada, c.faltante],
    )
    .unwrap();
}

/// Aplica un movimiento dentro de una transacción `IMMEDIATE` y hace `commit`
/// si tiene éxito; si falla, la transacción se descarta (rollback).
fn aplicar_commit(
    conn: &mut Connection,
    articulo_id: i64,
    tipo: TipoMovimiento,
    cantidad: i64,
    motivo: &str,
) -> Result<inventory::MovimientoAplicado, ErrorInventario> {
    let tx = connection::transaccion_immediate(conn).unwrap();
    let resultado = inventory::aplicar_movimiento(
        &tx, articulo_id, None, tipo, cantidad, motivo, None, None,
    );
    if resultado.is_ok() {
        tx.commit().unwrap();
    }
    resultado
}

/// Invoca un comando de lectura por el despachador IPC real.
fn invoke(cmd: &str, dir: &Path) -> Result<serde_json::Value, serde_json::Value> {
    let _guard = ENV_LOCK.lock().unwrap();
    unsafe { std::env::set_var(paths::ENV_DATA_DIR, dir) };
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![
            stocklend_lib::commands::inventory::listar_articulos,
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
    unsafe { std::env::remove_var(paths::ENV_DATA_DIR) };
    match res {
        Ok(body) => Ok(body.deserialize::<serde_json::Value>().unwrap()),
        Err(err) => Err(err),
    }
}

fn contar_movimientos(conn: &Connection) -> i64 {
    conn.query_row("SELECT COUNT(*) FROM movimiento_inventario", [], |r| r.get(0))
        .unwrap()
}

// ---------------------------------------------------------------------------
// Apertura de escritura
// ---------------------------------------------------------------------------

#[test]
fn open_read_write_abre_base_existente_con_foreign_keys_activas() {
    let dir = dir_con_esquema_real("abrir");

    let conn = connection::open_read_write(&ruta_db(&dir)).unwrap();
    let fk: i64 = conn
        .pragma_query_value(None, "foreign_keys", |r| r.get(0))
        .unwrap();
    assert_eq!(fk, 1, "foreign_keys debe quedar activo");
    let query_only: i64 = conn
        .pragma_query_value(None, "query_only", |r| r.get(0))
        .unwrap();
    assert_eq!(query_only, 0, "la conexión de escritura no es de solo lectura");
    drop(conn);

    // Las conexiones de lectura no cambian su configuración.
    let ro = connection::open_read_only(&ruta_db(&dir)).unwrap();
    let ro_query_only: i64 = ro
        .pragma_query_value(None, "query_only", |r| r.get(0))
        .unwrap();
    assert_eq!(ro_query_only, 1, "la conexión de lectura sigue en solo lectura");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn open_read_write_no_crea_una_base_ausente() {
    let dir = fresh_dir("ausente");
    let ruta = ruta_db(&dir);

    assert!(connection::open_read_write(&ruta).is_err());
    assert!(!ruta.exists(), "no debe crearse el archivo SQLite");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn foreign_keys_activas_impide_referencias_invalidas() {
    let dir = dir_con_esquema_real("fk");
    let conn = connection::open_read_write(&ruta_db(&dir)).unwrap();

    let resultado = conn.execute(
        &format!(
            "INSERT INTO articulo (nombre, categoria_id, creado_en, actualizado_en) \
             VALUES ('X', 999, {AHORA}, {AHORA})"
        ),
        [],
    );
    assert!(resultado.is_err(), "una FK inexistente debe hacer fallar el INSERT");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn abrir_escritura_rechaza_base_ausente() {
    let _guard = ENV_LOCK.lock().unwrap();
    let dir = fresh_dir("helper_ausente");

    unsafe { std::env::set_var(paths::ENV_DATA_DIR, &dir) };
    let app = mock_builder()
        .build(mock_context(noop_assets()))
        .expect("mock app");
    let resultado = stocklend_lib::commands::inventory::abrir_inventario_escritura(app.handle());
    unsafe { std::env::remove_var(paths::ENV_DATA_DIR) };

    let err = resultado.expect_err("debe fallar si la base no existe");
    assert!(err.contains("No se encontró"), "mensaje inesperado: {err}");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn abrir_escritura_rechaza_esquema_no_inicializado() {
    let _guard = ENV_LOCK.lock().unwrap();
    let dir = fresh_dir("helper_esquema");
    {
        let conn = Connection::open(ruta_db(&dir)).unwrap();
        conn.execute_batch("CREATE TABLE articulo (id INTEGER PRIMARY KEY);")
            .unwrap();
    }

    unsafe { std::env::set_var(paths::ENV_DATA_DIR, &dir) };
    let app = mock_builder()
        .build(mock_context(noop_assets()))
        .expect("mock app");
    let resultado = stocklend_lib::commands::inventory::abrir_inventario_escritura(app.handle());
    unsafe { std::env::remove_var(paths::ENV_DATA_DIR) };

    let err = resultado.expect_err("debe fallar con esquema incompleto");
    assert!(err.contains("no está inicializado"), "mensaje inesperado: {err}");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn abrir_escritura_admite_esquema_real_completo() {
    let _guard = ENV_LOCK.lock().unwrap();
    let dir = dir_con_esquema_real("helper_ok");

    unsafe { std::env::set_var(paths::ENV_DATA_DIR, &dir) };
    let app = mock_builder()
        .build(mock_context(noop_assets()))
        .expect("mock app");
    let resultado = stocklend_lib::commands::inventory::abrir_inventario_escritura(app.handle());
    unsafe { std::env::remove_var(paths::ENV_DATA_DIR) };

    let conn = resultado.expect("el esquema real debe abrirse en escritura");
    let fk: i64 = conn
        .pragma_query_value(None, "foreign_keys", |r| r.get(0))
        .unwrap();
    assert_eq!(fk, 1);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Transacciones
// ---------------------------------------------------------------------------

#[test]
fn commit_persiste_contadores_y_movimiento() {
    let dir = dir_con_esquema_real("commit");
    let mut conn = connection::open_read_write(&ruta_db(&dir)).unwrap();
    sembrar_articulo(
        &conn,
        1,
        Contadores { total: 0, disponible: 0, prestada: 0, danada: 0, faltante: 0 },
    );

    let resultado =
        aplicar_commit(&mut conn, 1, TipoMovimiento::Alta, 5, "Alta inicial").unwrap();
    assert_eq!(
        resultado.contadores,
        Contadores { total: 5, disponible: 5, prestada: 0, danada: 0, faltante: 0 }
    );
    assert!(!resultado.fecha.is_empty());

    assert_eq!(
        inventory::leer_contadores(&conn, 1).unwrap(),
        Contadores { total: 5, disponible: 5, prestada: 0, danada: 0, faltante: 0 }
    );
    assert_eq!(contar_movimientos(&conn), 1);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn transaccion_descart_cada_hace_rollback_completo() {
    let dir = dir_con_esquema_real("rollback");
    let mut conn = connection::open_read_write(&ruta_db(&dir)).unwrap();
    sembrar_articulo(
        &conn,
        1,
        Contadores { total: 4, disponible: 3, prestada: 1, danada: 0, faltante: 0 },
    );

    {
        let tx = connection::transaccion_immediate(&mut conn).unwrap();
        inventory::aplicar_movimiento(
            &tx, 1, None, TipoMovimiento::Alta, 6, "Alta que no debe persistir", None, None,
        )
        .unwrap();
        // Se descarta `tx` sin `commit`.
    }

    assert_eq!(
        inventory::leer_contadores(&conn, 1).unwrap(),
        Contadores { total: 4, disponible: 3, prestada: 1, danada: 0, faltante: 0 },
        "el rollback debe dejar los contadores intactos"
    );
    assert_eq!(contar_movimientos(&conn), 0, "no debe quedar movimiento");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn error_a_mitad_de_la_transaccion_no_deja_rastro() {
    let dir = dir_con_esquema_real("error_mitad");
    let mut conn = connection::open_read_write(&ruta_db(&dir)).unwrap();
    sembrar_articulo(
        &conn,
        1,
        Contadores { total: 5, disponible: 2, prestada: 3, danada: 0, faltante: 0 },
    );

    // Ajuste negativo mayor que lo disponible: debe fallar y revertir.
    let err = aplicar_commit(&mut conn, 1, TipoMovimiento::AjusteNegativo, 4, "Ajuste inválido")
        .expect_err("debe rechazar el ajuste");
    assert!(matches!(err, ErrorInventario::ResultadoNegativo(_)), "error: {err:?}");

    assert_eq!(
        inventory::leer_contadores(&conn, 1).unwrap(),
        Contadores { total: 5, disponible: 2, prestada: 3, danada: 0, faltante: 0 }
    );
    assert_eq!(contar_movimientos(&conn), 0);

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Reglas de movimientos
// ---------------------------------------------------------------------------

#[test]
fn alta_y_ajustes_actualizan_los_cinco_contadores() {
    let dir = dir_con_esquema_real("ajustes");
    let mut conn = connection::open_read_write(&ruta_db(&dir)).unwrap();
    sembrar_articulo(
        &conn,
        1,
        Contadores { total: 10, disponible: 4, prestada: 3, danada: 2, faltante: 1 },
    );

    aplicar_commit(&mut conn, 1, TipoMovimiento::AjustePositivo, 5, "Sobrante").unwrap();
    assert_eq!(
        inventory::leer_contadores(&conn, 1).unwrap(),
        Contadores { total: 15, disponible: 9, prestada: 3, danada: 2, faltante: 1 }
    );

    aplicar_commit(&mut conn, 1, TipoMovimiento::AjusteNegativo, 4, "Faltante").unwrap();
    assert_eq!(
        inventory::leer_contadores(&conn, 1).unwrap(),
        Contadores { total: 11, disponible: 5, prestada: 3, danada: 2, faltante: 1 }
    );

    assert_eq!(contar_movimientos(&conn), 2);
    assert!(inventory::leer_contadores(&conn, 1).unwrap().coherente());

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn reingreso_y_bajas_mueven_estados_sin_incoherencias() {
    let dir = dir_con_esquema_real("estados");
    let mut conn = connection::open_read_write(&ruta_db(&dir)).unwrap();
    sembrar_articulo(
        &conn,
        1,
        Contadores { total: 10, disponible: 4, prestada: 2, danada: 3, faltante: 1 },
    );

    aplicar_commit(&mut conn, 1, TipoMovimiento::ReingresoReparacion, 2, "Reparada").unwrap();
    assert_eq!(
        inventory::leer_contadores(&conn, 1).unwrap(),
        Contadores { total: 10, disponible: 6, prestada: 2, danada: 1, faltante: 1 }
    );

    aplicar_commit(&mut conn, 1, TipoMovimiento::BajaDaniada, 1, "Baja de dañada").unwrap();
    assert_eq!(
        inventory::leer_contadores(&conn, 1).unwrap(),
        Contadores { total: 9, disponible: 6, prestada: 2, danada: 0, faltante: 1 }
    );

    aplicar_commit(&mut conn, 1, TipoMovimiento::BajaFaltante, 1, "Baja de faltante").unwrap();
    assert_eq!(
        inventory::leer_contadores(&conn, 1).unwrap(),
        Contadores { total: 8, disponible: 6, prestada: 2, danada: 0, faltante: 0 }
    );
    assert_eq!(contar_movimientos(&conn), 3);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn cantidad_no_positiva_o_nula_se_rechaza() {
    let dir = dir_con_esquema_real("cantidad");
    let mut conn = connection::open_read_write(&ruta_db(&dir)).unwrap();
    sembrar_articulo(
        &conn,
        1,
        Contadores { total: 0, disponible: 0, prestada: 0, danada: 0, faltante: 0 },
    );

    for cantidad in [0, -1, -5] {
        let err = aplicar_commit(&mut conn, 1, TipoMovimiento::Alta, cantidad, "Inválida")
            .expect_err("la cantidad debe ser positiva");
        assert!(matches!(err, ErrorInventario::CantidadNoPositiva), "error: {err:?}");
    }
    assert_eq!(contar_movimientos(&conn), 0);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn motivo_obligatorio_y_tipo_de_referencia_valido() {
    let dir = dir_con_esquema_real("validaciones");
    let mut conn = connection::open_read_write(&ruta_db(&dir)).unwrap();
    sembrar_articulo(
        &conn,
        1,
        Contadores { total: 0, disponible: 0, prestada: 0, danada: 0, faltante: 0 },
    );

    let vacio = aplicar_commit(&mut conn, 1, TipoMovimiento::Alta, 1, "   ")
        .expect_err("el motivo no puede quedar vacío");
    assert!(matches!(vacio, ErrorInventario::MotivoVacio), "error: {vacio:?}");

    let tx = connection::transaccion_immediate(&mut conn).unwrap();
    let referencia = inventory::aplicar_movimiento(
        &tx, 1, None, TipoMovimiento::Alta, 1, "Alta", Some("desconocido"), None,
    )
    .expect_err("referencia_tipo inválido");
    assert!(
        matches!(referencia, ErrorInventario::ReferenciaTipoInvalida(_)),
        "error: {referencia:?}"
    );

    let inexistente = inventory::aplicar_movimiento(
        &tx, 99, None, TipoMovimiento::Alta, 1, "Alta", None, None,
    )
    .expect_err("artículo inexistente");
    assert!(
        matches!(inexistente, ErrorInventario::ArticuloNoEncontrado(99)),
        "error: {inexistente:?}"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn desde_str_solo_acepta_los_seis_tipos_previstos() {
    let aceptados = [
        TipoMovimiento::Alta,
        TipoMovimiento::AjustePositivo,
        TipoMovimiento::AjusteNegativo,
        TipoMovimiento::ReingresoReparacion,
        TipoMovimiento::BajaDaniada,
        TipoMovimiento::BajaFaltante,
    ];
    for tipo in aceptados {
        assert_eq!(TipoMovimiento::desde_str(tipo.as_str()), Some(tipo));
    }
    for rechazado in ["editar", "borrar", "prestamo", "", "ALTA"] {
        assert_eq!(TipoMovimiento::desde_str(rechazado), None, "{rechazado}");
    }
}

// ---------------------------------------------------------------------------
// Historial (append-only) e invariantes
// ---------------------------------------------------------------------------

#[test]
fn tipos_publicos_cubren_el_check_del_esquema() {
    assert_eq!(inventory::TIPOS_MOVIMIENTO.len(), 12);
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(&esquema_real()).unwrap();
    let sql: String = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'movimiento_inventario'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    for tipo in inventory::TIPOS_MOVIMIENTO {
        assert!(sql.contains(tipo), "el CHECK del esquema no contiene «{tipo}»");
    }
}

#[test]
fn el_historial_es_append_only() {
    let dir = dir_con_esquema_real("historial");
    let mut conn = connection::open_read_write(&ruta_db(&dir)).unwrap();
    sembrar_articulo(
        &conn,
        1,
        Contadores { total: 0, disponible: 0, prestada: 0, danada: 0, faltante: 0 },
    );

    aplicar_commit(&mut conn, 1, TipoMovimiento::Alta, 10, "Alta").unwrap();
    let (id1, cantidad1, resultante1): (i64, i64, i64) = conn
        .query_row(
            "SELECT id, cantidad, cantidad_resultante_total FROM movimiento_inventario",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap();

    aplicar_commit(&mut conn, 1, TipoMovimiento::AjusteNegativo, 3, "Ajuste").unwrap();

    let (cantidad1b, resultante1b): (i64, i64) = conn
        .query_row(
            "SELECT cantidad, cantidad_resultante_total FROM movimiento_inventario WHERE id = ?1",
            [id1],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!((cantidad1, resultante1), (cantidad1b, resultante1b));
    assert_eq!(contar_movimientos(&conn), 2);

    // El propio esquema impide movimientos degenerados.
    assert!(
        conn.execute(
            "INSERT INTO movimiento_inventario (articulo_id, tipo, cantidad, cantidad_resultante_total, cantidad_resultante_disponible, motivo, fecha) \
             VALUES (1, 'alta', 0, 0, 0, 'x', '2026-01-01T00:00:00Z')",
            [],
        )
        .is_err(),
        "cantidad = 0 debe violar el CHECK"
    );
    assert!(
        conn.execute(
            "INSERT INTO movimiento_inventario (articulo_id, tipo, cantidad, cantidad_resultante_total, cantidad_resultante_disponible, motivo, fecha) \
             VALUES (1, 'editar', 1, 1, 1, 'x', '2026-01-01T00:00:00Z')",
            [],
        )
        .is_err(),
        "un tipo arbitrario debe violar el CHECK"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn la_invariante_se_conserva_tras_una_secuencia() {
    let dir = dir_con_esquema_real("invariante");
    let mut conn = connection::open_read_write(&ruta_db(&dir)).unwrap();
    sembrar_articulo(
        &conn,
        1,
        Contadores { total: 0, disponible: 0, prestada: 0, danada: 0, faltante: 0 },
    );

    let pasos = [
        (TipoMovimiento::Alta, 10),
        (TipoMovimiento::AjustePositivo, 5),
        (TipoMovimiento::AjusteNegativo, 3),
        (TipoMovimiento::Alta, 2),
        (TipoMovimiento::AjusteNegativo, 1),
        (TipoMovimiento::AjustePositivo, 4),
    ];
    for (tipo, cantidad) in pasos {
        let aplicado = aplicar_commit(&mut conn, 1, tipo, cantidad, "Secuencia").unwrap();
        assert!(aplicado.contadores.coherente(), "tras {tipo:?}: {aplicado:?}");
    }

    // Reconciliación §8.6/§8.7: contadores = suma de cubos y = último movimiento.
    let incoherencias: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM articulo \
             WHERE cantidad_total <> cantidad_disponible + cantidad_prestada \
                                    + cantidad_daniada + cantidad_faltante",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(incoherencias, 0, "RN-02 debe cumplirse en todas las filas");

    let desajustes: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM articulo a \
             JOIN movimiento_inventario m ON m.id = ( \
                 SELECT id FROM movimiento_inventario \
                 WHERE articulo_id = a.id ORDER BY id DESC LIMIT 1) \
             WHERE a.cantidad_total <> m.cantidad_resultante_total \
                OR a.cantidad_disponible <> m.cantidad_resultante_disponible",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(desajustes, 0, "los contadores deben coincidir con el último movimiento");

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Compatibilidad con los comandos de solo lectura
// ---------------------------------------------------------------------------

#[test]
fn la_escritura_es_compatible_con_los_comandos_de_lectura() {
    let dir = dir_con_esquema_real("compat");
    {
        let mut conn = connection::open_read_write(&ruta_db(&dir)).unwrap();
        sembrar_articulo(
            &conn,
            1,
            Contadores { total: 0, disponible: 0, prestada: 0, danada: 0, faltante: 0 },
        );
        aplicar_commit(&mut conn, 1, TipoMovimiento::Alta, 7, "Alta").unwrap();
    }

    let articulos = invoke("listar_articulos", &dir).expect("listar_articulos");
    let arr = articulos.as_array().unwrap();
    assert_eq!(arr.len(), 1, "json={articulos}");
    assert_eq!(arr[0]["id"], 1);
    assert_eq!(arr[0]["cantidad_total"], 7);
    assert_eq!(arr[0]["cantidad_disponible"], 7);

    let stats = invoke("obtener_estadisticas_inventario", &dir).expect("estadísticas");
    assert_eq!(stats["unidades_totales"], 7);
    assert_eq!(stats["unidades_disponibles"], 7);
    assert_eq!(stats["articulos_registrados"], 1);

    let _ = std::fs::remove_dir_all(&dir);
}
