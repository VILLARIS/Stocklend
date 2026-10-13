//! Modelos de datos del Inventario.
//!
//! Representan exactamente lo que las pestañas de Inventario (Artículos,
//! Unidades y Categorías) necesitan y se serializan a JSON para el frontend.
//! Son de solo lectura: no describen escrituras ni el esquema de la base.

use serde::{Deserialize, Serialize};

/// Artículo del inventario con su categoría y contadores.
///
/// Los contadores provienen de la columna real `articulo.cantidad_*`, no de
/// agregados sobre `articulo_unidad` (que puede estar vacía). Se expone
/// `activo` para que el frontend decida si filtrar; aquí se devuelven todos.
#[derive(Debug, Serialize)]
pub struct ArticuloInventario {
    pub id: i64,
    /// Código propio del artículo (puede no existir).
    pub codigo: Option<String>,
    pub nombre: String,
    pub categoria: String,
    /// Identificador real de la categoría (para precargar la edición).
    pub categoria_id: i64,
    /// Nota opcional del artículo (para precargar la edición).
    pub notas: Option<String>,
    pub cantidad_total: i64,
    pub cantidad_disponible: i64,
    pub cantidad_prestada: i64,
    pub cantidad_daniada: i64,
    pub cantidad_faltante: i64,
    /// Indicador de préstamo: el artículo se presta.
    pub prestable: bool,
    /// Indicador de control individual: se gestiona unidad por unidad.
    pub control_individual: bool,
    pub activo: bool,
}

/// Unidad física individual del inventario.
///
/// El estado es el valor real de `articulo_unidad.estado`
/// (`disponible`, `prestada`, `danada`, `faltante`, `baja`). Las relaciones de
/// préstamo e incidente son opcionales y solo se rellenan cuando existen.
#[derive(Debug, Serialize)]
pub struct UnidadInventario {
    pub id: i64,
    pub codigo: String,
    pub articulo_id: i64,
    pub articulo: String,
    pub categoria: String,
    pub estado: String,
    pub prestamo_detalle_id: Option<i64>,
    pub prestamo_id: Option<i64>,
    pub prestamo_folio: Option<String>,
    pub prestamo_estado: Option<String>,
    /// Fecha local del préstamo en formato ISO `YYYY-MM-DD`.
    pub prestamo_fecha: Option<String>,
    pub estudiante_id: Option<i64>,
    pub estudiante: Option<String>,
    /// Incidente asociado (el más reciente; se prioriza uno abierto).
    pub incidente_id: Option<i64>,
    pub incidente_tipo: Option<String>,
    pub incidente_estado: Option<String>,
}

/// Categoría con la cantidad de artículos asociados.
#[derive(Debug, Serialize)]
pub struct CategoriaInventario {
    pub id: i64,
    pub nombre: String,
    pub descripcion: Option<String>,
    pub activo: bool,
    /// Cantidad de artículos cuyo `categoria_id` es esta categoría.
    pub articulos: i64,
}

/// Estadísticas de las tarjetas del Inventario.
///
/// Los acumuladores de unidades se calculan igual que en el Dashboard
/// (`SUM` sobre `articulo.cantidad_*`) para no contradecir sus contadores.
#[derive(Debug, Serialize)]
pub struct EstadisticasInventario {
    /// Cantidad de filas en `articulo` (activas e inactivas).
    pub articulos_registrados: i64,
    /// Cantidad de artículos con `activo = 1` (coincide con el Dashboard).
    pub articulos_activos: i64,
    pub unidades_totales: i64,
    pub unidades_disponibles: i64,
    pub unidades_prestadas: i64,
    pub unidades_daniadas: i64,
    pub unidades_faltantes: i64,
}

/// Datos para crear una categoría (`crear_categoria`).
#[derive(Debug, Deserialize)]
pub struct CrearCategoriaInput {
    pub nombre: String,
    /// Nota opcional. Se ignora si viene vacía.
    pub descripcion: Option<String>,
}

/// Datos para editar una categoría existente.
#[derive(Debug, Deserialize)]
pub struct ActualizarCategoriaInput {
    pub id: i64,
    pub nombre: String,
    pub descripcion: Option<String>,
}

/// Datos para activar o desactivar una categoría (nunca se borra).
#[derive(Debug, Deserialize)]
pub struct CambiarEstadoCategoriaInput {
    pub id: i64,
    pub activo: bool,
}

/// Valor por defecto de `prestable` cuando el cliente no lo envía: un artículo
/// se presta salvo que se indique lo contrario (RF-INV-09).
fn prestable_por_defecto() -> bool {
    true
}

/// Unidad individual suministrada al crear un artículo con control individual.
#[derive(Debug, Deserialize)]
pub struct UnidadNuevaInput {
    pub codigo: String,
    #[serde(default)]
    pub descripcion: Option<String>,
}

/// Datos para crear un artículo.
///
/// Si `control_individual` es `true`, `unidades` trae una entrada por unidad y
/// `cantidad_inicial` debe coincidir con su número. `cantidad_inicial` por
/// defecto es 0.
#[derive(Debug, Deserialize)]
pub struct CrearArticuloInput {
    pub nombre: String,
    pub categoria_id: i64,
    #[serde(default)]
    pub cantidad_inicial: i64,
    #[serde(default)]
    pub control_individual: bool,
    #[serde(default = "prestable_por_defecto")]
    pub prestable: bool,
    /// Nota opcional; se ignora si viene vacía.
    #[serde(default)]
    pub notas: Option<String>,
    /// Unidades individuales (solo con `control_individual = true`).
    #[serde(default)]
    pub unidades: Vec<UnidadNuevaInput>,
}

/// Datos para editar un artículo existente.
///
/// No incluye cantidad ni `control_individual`: la cantidad se cambia por el
/// flujo de ajuste (con movimiento) y el control individual es inmutable en F3.
#[derive(Debug, Deserialize)]
pub struct ActualizarArticuloInput {
    pub id: i64,
    pub nombre: String,
    pub categoria_id: i64,
    pub prestable: bool,
    #[serde(default)]
    pub notas: Option<String>,
}

/// Datos para ajustar las existencias totales de un artículo (RF-INV-03/06).
#[derive(Debug, Deserialize)]
pub struct AjustarExistenciasInput {
    pub id: i64,
    pub nueva_cantidad: i64,
    pub motivo: String,
}

/// Datos para agregar una unidad individual a un artículo existente.
#[derive(Debug, Deserialize)]
pub struct AgregarUnidadInput {
    pub articulo_id: i64,
    pub codigo: String,
    #[serde(default)]
    pub descripcion: Option<String>,
}

/// Datos para editar una unidad individual (código, descripción y notas).
#[derive(Debug, Deserialize)]
pub struct ActualizarUnidadInput {
    pub id: i64,
    pub codigo: String,
    #[serde(default)]
    pub descripcion: Option<String>,
    #[serde(default)]
    pub notas: Option<String>,
}

/// Datos para cambiar el estado de una unidad individual (transiciones
/// limitadas; ver `services::units`).
#[derive(Debug, Deserialize)]
pub struct CambiarEstadoUnidadInput {
    pub id: i64,
    pub estado: String,
    pub motivo: String,
}
