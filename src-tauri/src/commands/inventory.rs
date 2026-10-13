//! Comandos del Inventario (solo lectura) e infraestructura de apertura de
//! escritura (Fase F1).
//!
//! Los comandos reutilizan la resolución de ruta, la apertura en solo lectura y
//! la validación de esquema ya existentes. Nunca crean la base: si el archivo
//! falta, el esquema no está inicializado o una consulta falla, devuelven un
//! error explícito (mismo criterio que `obtener_panel`).
//!
//! [`abrir_inventario_escritura`] es un ayudante interno (no un comando) que
//! valida lo mismo antes de permitir escrituras.

use tauri::AppHandle;

use crate::commands::diagnostics;
use crate::core::paths;
use crate::db::connection;
use crate::models::inventory::{
    ActualizarArticuloInput, ActualizarCategoriaInput, ActualizarUnidadInput,
    AgregarUnidadInput, AjustarExistenciasInput, ArticuloInventario, CambiarEstadoCategoriaInput,
    CambiarEstadoUnidadInput, CategoriaInventario, CrearArticuloInput, CrearCategoriaInput,
    EstadisticasInventario, UnidadInventario,
};
use crate::repositories::{dashboard, inventory};
use crate::services::articles;
use crate::services::categories;
use crate::services::units::{self, NuevaUnidad};

/// Abre la base real en solo lectura, validando existencia y esquema.
///
/// Compartido por los cuatro comandos para no repetir la apertura ni la noción
/// de "esquema inicializado".
fn abrir_inventario<R: tauri::Runtime>(
    app: &AppHandle<R>,
) -> Result<rusqlite::Connection, String> {
    let location = paths::resolve_db_location(app)?;

    if !location.path.is_file() {
        return Err(
            "No se encontró el archivo de base de datos. No se generaron datos de ejemplo."
                .to_string(),
        );
    }

    let conn = connection::open_read_only(&location.path)
        .map_err(|e| format!("No se pudo abrir la base en solo lectura: {e}"))?;

    let inicializado = diagnostics::esquema_inicializado(&conn)
        .map_err(|e| format!("No se pudo inspeccionar el esquema: {e}"))?;
    if !inicializado {
        return Err(
            "El esquema de la base de datos no está inicializado. No se generaron datos de ejemplo."
                .to_string(),
        );
    }

    Ok(conn)
}

/// Abre la base real en modo escritura, validando existencia y esquema.
///
/// Comparte la resolución de ruta y la noción de "esquema inicializado" con las
/// lecturas. A diferencia de [`abrir_inventario`], activa `PRAGMA foreign_keys`
/// y permite escrituras; en ningún caso crea el archivo. No está registrado como
/// comando: es la base para las operaciones de escritura de fases posteriores.
pub fn abrir_inventario_escritura<R: tauri::Runtime>(
    app: &AppHandle<R>,
) -> Result<rusqlite::Connection, String> {
    let location = paths::resolve_db_location(app)?;

    if !location.path.is_file() {
        return Err(
            "No se encontró el archivo de base de datos. No se puede escribir.".to_string(),
        );
    }

    let conn = connection::open_read_write(&location.path)
        .map_err(|e| format!("No se pudo abrir la base en modo escritura: {e}"))?;

    let inicializado = diagnostics::esquema_inicializado(&conn)
        .map_err(|e| format!("No se pudo inspeccionar el esquema: {e}"))?;
    if !inicializado {
        return Err(
            "El esquema de la base de datos no está inicializado. No se puede escribir."
                .to_string(),
        );
    }

    Ok(conn)
}

/// Lista los artículos del inventario.
#[tauri::command]
pub fn listar_articulos<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<ArticuloInventario>, String> {
    let conn = abrir_inventario(&app)?;
    inventory::listar_articulos(&conn)
        .map_err(|e| format!("No se pudieron leer los artículos: {e}"))
}

/// Lista las unidades físicas del inventario.
#[tauri::command]
pub fn listar_unidades<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<UnidadInventario>, String> {
    let conn = abrir_inventario(&app)?;
    inventory::listar_unidades(&conn)
        .map_err(|e| format!("No se pudieron leer las unidades: {e}"))
}

/// Lista las categorías con su cantidad de artículos.
#[tauri::command]
pub fn listar_categorias<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<CategoriaInventario>, String> {
    let conn = abrir_inventario(&app)?;
    inventory::listar_categorias(&conn)
        .map_err(|e| format!("No se pudieron leer las categorías: {e}"))
}

/// Estadísticas de las tarjetas de Inventario.
#[tauri::command]
pub fn obtener_estadisticas_inventario<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<EstadisticasInventario, String> {
    let conn = abrir_inventario(&app)?;

    let conteos = dashboard::conteos_inventario(&conn)
        .map_err(|e| format!("No se pudieron calcular los conteos de inventario: {e}"))?;
    let articulos_registrados = inventory::contar_articulos(&conn)
        .map_err(|e| format!("No se pudo contar los artículos: {e}"))?;

    Ok(EstadisticasInventario {
        articulos_registrados,
        articulos_activos: conteos.articulos_activos,
        unidades_totales: conteos.unidades_totales,
        unidades_disponibles: conteos.unidades_disponibles,
        unidades_prestadas: conteos.unidades_prestadas,
        unidades_daniadas: conteos.unidades_daniadas,
        unidades_faltantes: conteos.unidades_faltantes,
    })
}

// ---------------------------------------------------------------------------
// Categorías (Fase F2). Escrituras dentro de una transacción `IMMEDIATE`.
// ---------------------------------------------------------------------------

/// Crea una categoría y devuelve la fila resultante.
#[tauri::command]
pub fn crear_categoria<R: tauri::Runtime>(
    app: AppHandle<R>,
    datos: CrearCategoriaInput,
) -> Result<CategoriaInventario, String> {
    let mut conn = abrir_inventario_escritura(&app)?;
    let tx = connection::transaccion_immediate(&mut conn)
        .map_err(|e| format!("No se pudo iniciar la transacción: {e}"))?;

    let id = categories::crear(&tx, &datos.nombre, datos.descripcion.as_deref())
        .map_err(|e| e.to_string())?;
    let categoria = leer_categoria_obligatoria(&tx, id)?;

    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la operación: {e}"))?;
    Ok(categoria)
}

/// Edita nombre y descripción de una categoría existente.
#[tauri::command]
pub fn actualizar_categoria<R: tauri::Runtime>(
    app: AppHandle<R>,
    datos: ActualizarCategoriaInput,
) -> Result<CategoriaInventario, String> {
    let mut conn = abrir_inventario_escritura(&app)?;
    let tx = connection::transaccion_immediate(&mut conn)
        .map_err(|e| format!("No se pudo iniciar la transacción: {e}"))?;

    categories::actualizar(&tx, datos.id, &datos.nombre, datos.descripcion.as_deref())
        .map_err(|e| e.to_string())?;
    let categoria = leer_categoria_obligatoria(&tx, datos.id)?;

    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la operación: {e}"))?;
    Ok(categoria)
}

/// Activa o desactiva una categoría (nunca la borra).
#[tauri::command]
pub fn cambiar_estado_categoria<R: tauri::Runtime>(
    app: AppHandle<R>,
    datos: CambiarEstadoCategoriaInput,
) -> Result<CategoriaInventario, String> {
    let mut conn = abrir_inventario_escritura(&app)?;
    let tx = connection::transaccion_immediate(&mut conn)
        .map_err(|e| format!("No se pudo iniciar la transacción: {e}"))?;

    categories::cambiar_estado(&tx, datos.id, datos.activo).map_err(|e| e.to_string())?;
    let categoria = leer_categoria_obligatoria(&tx, datos.id)?;

    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la operación: {e}"))?;
    Ok(categoria)
}

/// Lee la categoría recién operada, tratando su ausencia como error interno.
fn leer_categoria_obligatoria(
    conn: &rusqlite::Connection,
    id: i64,
) -> Result<CategoriaInventario, String> {
    inventory::leer_categoria(conn, id)
        .map_err(|e| format!("No se pudo leer la categoría: {e}"))?
        .ok_or_else(|| "No se encontró la categoría indicada.".to_string())
}

// ---------------------------------------------------------------------------
// Artículos (Fase F3). Escrituras dentro de una transacción `IMMEDIATE`.
// ---------------------------------------------------------------------------

/// Crea un artículo y, si trae cantidad inicial, registra su alta.
#[tauri::command]
pub fn crear_articulo<R: tauri::Runtime>(
    app: AppHandle<R>,
    datos: CrearArticuloInput,
) -> Result<ArticuloInventario, String> {
    let mut conn = abrir_inventario_escritura(&app)?;
    let tx = connection::transaccion_immediate(&mut conn)
        .map_err(|e| format!("No se pudo iniciar la transacción: {e}"))?;

    let id = articles::crear(
        &tx,
        articles::NuevoArticulo {
            nombre: &datos.nombre,
            categoria_id: datos.categoria_id,
            cantidad_inicial: datos.cantidad_inicial,
            control_individual: datos.control_individual,
            prestable: datos.prestable,
            notas: datos.notas.as_deref(),
        },
        &datos
            .unidades
            .iter()
            .map(|unidad| NuevaUnidad {
                codigo: &unidad.codigo,
                descripcion: unidad.descripcion.as_deref(),
            })
            .collect::<Vec<_>>(),
    )
    .map_err(|e| e.to_string())?;
    let articulo = leer_articulo_obligatorio(&tx, id)?;

    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la operación: {e}"))?;
    Ok(articulo)
}

/// Edita nombre, categoría, `prestable` y notas de un artículo existente.
#[tauri::command]
pub fn actualizar_articulo<R: tauri::Runtime>(
    app: AppHandle<R>,
    datos: ActualizarArticuloInput,
) -> Result<ArticuloInventario, String> {
    let mut conn = abrir_inventario_escritura(&app)?;
    let tx = connection::transaccion_immediate(&mut conn)
        .map_err(|e| format!("No se pudo iniciar la transacción: {e}"))?;

    articles::actualizar(
        &tx,
        datos.id,
        &datos.nombre,
        datos.categoria_id,
        datos.prestable,
        datos.notas.as_deref(),
    )
    .map_err(|e| e.to_string())?;
    let articulo = leer_articulo_obligatorio(&tx, datos.id)?;

    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la operación: {e}"))?;
    Ok(articulo)
}

/// Ajusta la cantidad total de un artículo y devuelve su fila actualizada.
#[tauri::command]
pub fn ajustar_existencias<R: tauri::Runtime>(
    app: AppHandle<R>,
    datos: AjustarExistenciasInput,
) -> Result<ArticuloInventario, String> {
    let mut conn = abrir_inventario_escritura(&app)?;
    let tx = connection::transaccion_immediate(&mut conn)
        .map_err(|e| format!("No se pudo iniciar la transacción: {e}"))?;

    articles::ajustar(&tx, datos.id, datos.nueva_cantidad, &datos.motivo)
        .map_err(|e| e.to_string())?;
    let articulo = leer_articulo_obligatorio(&tx, datos.id)?;

    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la operación: {e}"))?;
    Ok(articulo)
}

/// Lee el artículo recién operado, tratando su ausencia como error interno.
fn leer_articulo_obligatorio(
    conn: &rusqlite::Connection,
    id: i64,
) -> Result<ArticuloInventario, String> {
    inventory::leer_articulo(conn, id)
        .map_err(|e| format!("No se pudo leer el artículo: {e}"))?
        .ok_or_else(|| "No se encontró el artículo indicado.".to_string())
}

// ---------------------------------------------------------------------------
// Unidades individuales (Fase F4). Escrituras dentro de una transacción
// `IMMEDIATE`.
// ---------------------------------------------------------------------------

/// Agrega una unidad individual a un artículo con control individual.
#[tauri::command]
pub fn agregar_unidad<R: tauri::Runtime>(
    app: AppHandle<R>,
    datos: AgregarUnidadInput,
) -> Result<UnidadInventario, String> {
    let mut conn = abrir_inventario_escritura(&app)?;
    let tx = connection::transaccion_immediate(&mut conn)
        .map_err(|e| format!("No se pudo iniciar la transacción: {e}"))?;

    let id = units::agregar(
        &tx,
        datos.articulo_id,
        &datos.codigo,
        datos.descripcion.as_deref(),
    )
    .map_err(|e| e.to_string())?;
    let unidad = leer_unidad_obligatoria(&tx, id)?;

    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la operación: {e}"))?;
    Ok(unidad)
}

/// Edita código, descripción y notas de una unidad individual.
#[tauri::command]
pub fn actualizar_unidad<R: tauri::Runtime>(
    app: AppHandle<R>,
    datos: ActualizarUnidadInput,
) -> Result<UnidadInventario, String> {
    let mut conn = abrir_inventario_escritura(&app)?;
    let tx = connection::transaccion_immediate(&mut conn)
        .map_err(|e| format!("No se pudo iniciar la transacción: {e}"))?;

    units::actualizar(
        &tx,
        datos.id,
        &datos.codigo,
        datos.descripcion.as_deref(),
        datos.notas.as_deref(),
    )
    .map_err(|e| e.to_string())?;
    let unidad = leer_unidad_obligatoria(&tx, datos.id)?;

    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la operación: {e}"))?;
    Ok(unidad)
}

/// Cambia el estado de una unidad individual dentro de las transiciones
/// permitidas.
#[tauri::command]
pub fn cambiar_estado_unidad<R: tauri::Runtime>(
    app: AppHandle<R>,
    datos: CambiarEstadoUnidadInput,
) -> Result<UnidadInventario, String> {
    let mut conn = abrir_inventario_escritura(&app)?;
    let tx = connection::transaccion_immediate(&mut conn)
        .map_err(|e| format!("No se pudo iniciar la transacción: {e}"))?;

    units::cambiar_estado(&tx, datos.id, &datos.estado, &datos.motivo)
        .map_err(|e| e.to_string())?;
    let unidad = leer_unidad_obligatoria(&tx, datos.id)?;

    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la operación: {e}"))?;
    Ok(unidad)
}

/// Lee la unidad recién operada, tratando su ausencia como error interno.
fn leer_unidad_obligatoria(
    conn: &rusqlite::Connection,
    id: i64,
) -> Result<UnidadInventario, String> {
    inventory::leer_unidad(conn, id)
        .map_err(|e| format!("No se pudo leer la unidad: {e}"))?
        .ok_or_else(|| "No se encontró la unidad indicada.".to_string())
}
