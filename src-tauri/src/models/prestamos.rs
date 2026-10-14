//! Modelos de datos de Préstamos. Lectura (Etapa B) y entrada de escritura (E1).
//!
/// Representan exactamente lo que la lista, el detalle y las tarjetas resumen de
/// Préstamos necesitan, y se serializan a JSON para el frontend. Describen el
/// `prestamo` real (`DATABASE_DESIGN.md` §4.5) y sus renglones en
/// `prestamo_detalle` (§4.6), tomados de las vistas `v_prestamo_resumen` y
/// `v_prestamo_detalle`. Desde la Etapa E1 también declaran la entrada del
/// comando `registrar_prestamo`; el backend calcula la fecha, el folio y los
/// totales, así que la entrada solo aporta la intención (estudiante, artículos,
/// cantidades o unidades, fecha límite y comentario).
///
/// Regla de vencimiento (RN-25): `prestamo.estado` solo puede ser `activo`,
/// `cerrado` o `anulado`. "Vencido" **no** es un estado almacenado: se deriva de
/// un préstamo `activo` cuya `fecha_limite` existe y es anterior a la fecha de
/// referencia. Un préstamo `cerrado` o `anulado` nunca se marca vencido, y
/// `fecha_limite = NULL` significa que no tiene vencimiento.

use serde::{Deserialize, Serialize};

/// Préstamo de la lista, con sus totales derivados.
///
/// Los totales se calculan sobre los registros reales (`prestamo_detalle` a
/// través de las vistas), nunca se escriben a mano.
#[derive(Debug, Serialize)]
pub struct PrestamoResumen {
    pub id: i64,
    pub folio: String,
    pub estudiante_id: i64,
    /// `nombres` y `apellidos` unidos, tal como los muestra la tabla.
    pub nombre_completo: String,
    pub codigo_universitario: String,
    /// Fecha local del préstamo en formato ISO `YYYY-MM-DD`.
    pub fecha_prestamo: String,
    /// Fecha límite opcional (RN-25); `None` significa que no hay vencimiento.
    pub fecha_limite: Option<String>,
    /// Estado real de `prestamo.estado` (`activo`, `cerrado`, `anulado`).
    pub estado: String,
    /// Derivado: `activo` con `fecha_limite` anterior a la fecha de referencia.
    pub vencido: bool,
    pub comentario: Option<String>,
    /// Fecha local de cierre cuando el préstamo ya se cerró (`YYYY-MM-DD`).
    pub cerrado_en: Option<String>,
    /// Renglones del préstamo (artículos distintos). Debido a la restricción
    /// `UNIQUE(prestamo_id, articulo_id)`, coincide con la cantidad de artículos
    /// diferentes; no se mezcla con las unidades.
    pub renglones: i64,
    /// Suma de `cantidad_prestada` (unidades totales entregadas).
    pub unidades_prestadas: i64,
    /// Suma de `cantidad_pendiente` (unidades aún por devolver).
    pub unidades_pendientes: i64,
}

/// Detalle de un préstamo: su cabecera más sus renglones.
#[derive(Debug, Serialize)]
pub struct PrestamoDetalle {
    pub id: i64,
    pub folio: String,
    pub estudiante_id: i64,
    pub nombre_completo: String,
    pub codigo_universitario: String,
    pub fecha_prestamo: String,
    pub fecha_limite: Option<String>,
    pub estado: String,
    pub vencido: bool,
    pub comentario: Option<String>,
    pub cerrado_en: Option<String>,
    /// Fecha local de alta del préstamo (`YYYY-MM-DD`).
    pub creado_en: String,
    pub renglones: i64,
    pub unidades_prestadas: i64,
    pub unidades_pendientes: i64,
    /// Renglones del préstamo, ordenados por `prestamo_detalle.id`.
    pub lineas: Vec<PrestamoLinea>,
}

/// Renglón del préstamo: un artículo y sus cantidades reales.
#[derive(Debug, Serialize)]
pub struct PrestamoLinea {
    /// Identificador de `prestamo_detalle.id`.
    pub id: i64,
    pub articulo_id: i64,
    pub articulo: String,
    pub cantidad_prestada: i64,
    pub cantidad_devuelta: i64,
    pub cantidad_daniada: i64,
    pub cantidad_perdida: i64,
    /// Derivada en la vista: `prestada - devuelta - dañada - perdida`.
    pub cantidad_pendiente: i64,
    /// Estado real de `prestamo_detalle.estado`
    /// (`pendiente`, `parcial`, `devuelto`, `con_incidente`).
    pub estado: String,
    /// Códigos de las unidades individuales (`articulo_unidad.codigo`) ligadas a
    /// este renglón. Vacío para artículos sin control individual.
    pub unidades: Vec<String>,
}

/// Una línea de la solicitud de préstamo.
///
/// Para artículos sin control individual se envía `cantidad` (mayor que cero).
/// Para artículos con control individual se envían los `unidad_ids` concretos.
/// Si el mismo artículo se repite en la solicitud, el servicio agrupa las líneas
/// (RN-18): suma las cantidades o concatena las unidades. Mezclar `cantidad` con
/// `unidad_ids` para un mismo artículo se rechaza.
#[derive(Debug, Deserialize)]
pub struct LineaPrestamoInput {
    pub articulo_id: i64,
    /// Cantidad solicitada (solo artículos sin control individual).
    #[serde(default)]
    pub cantidad: Option<i64>,
    /// Unidades individuales solicitadas (solo control individual).
    #[serde(default)]
    pub unidad_ids: Vec<i64>,
}

/// Datos para registrar un préstamo (`registrar_prestamo`).
///
/// La fecha del préstamo, el folio y los totales los fija el backend; la entrada
/// nunca los aporta. `fecha_limite` vacía o ausente significa "sin vencimiento"
/// (RN-25); `comentario` vacío se guarda como `NULL`.
#[derive(Debug, Deserialize)]
pub struct RegistrarPrestamoInput {
    pub estudiante_id: i64,
    pub lineas: Vec<LineaPrestamoInput>,
    #[serde(default)]
    pub fecha_limite: Option<String>,
    #[serde(default)]
    pub comentario: Option<String>,
}

/// Estadísticas de las tarjetas resumen de Préstamos.
#[derive(Debug, Serialize)]
pub struct EstadisticasPrestamos {
    /// Total de préstamos registrados (incluye todos los estados).
    pub total: i64,
    /// Préstamos en estado `activo`.
    pub activos: i64,
    /// Préstamos en estado `cerrado` (etiquetados "Finalizados").
    pub finalizados: i64,
    /// Préstamos `activo` con `fecha_limite` anterior a la fecha de referencia.
    pub vencidos: i64,
    /// Préstamos en estado `anulado`.
    pub anulados: i64,
    /// Unidades pendientes de devolución de los préstamos activos.
    pub unidades_pendientes: i64,
}
