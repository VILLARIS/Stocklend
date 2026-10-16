//! Modelos de datos de Devoluciones (Etapa B). Solo lectura.
//!
//! Describen lo que la pantalla de Devoluciones necesita leer: los préstamos con
//! cantidades pendientes, el detalle de un préstamo listo para registrar una
//! futura devolución y el historial de devoluciones ya registradas. Todo se
//! apoya en las tablas reales (`DATABASE_DESIGN.md` §4.5 a §4.7) y en las vistas
//! `v_prestamo_resumen` / `v_prestamo_detalle`.
//!
//! Regla de vencimiento (RN-25): `prestamo.estado` solo puede ser `activo`,
//! `cerrado` o `anulado`. "Vencido" **no** se almacena: se deriva de un préstamo
//! `activo` cuya `fecha_limite` existe y es anterior a la fecha de referencia.
//! "Pendiente", "Parcial", "Completada" y "Vencida" son, igualmente, etiquetas de
//! presentación derivadas de las cantidades y devoluciones reales; no son estados
//! persistidos.

use serde::{Deserialize, Serialize};

/// Unidad física concreta que sigue en préstamo y puede devolverse.
///
/// Solo se incluyen unidades con `articulo_unidad.estado = 'prestada'` ligadas al
/// renglón del préstamo consultado; nunca unidades disponibles, dadas de baja ni
/// de otros préstamos. Se expone el identificador real y su código.
#[derive(Debug, Serialize)]
pub struct UnidadDevolucion {
    /// `articulo_unidad.id` real.
    pub id: i64,
    /// `articulo_unidad.codigo` real (no se inventa).
    pub codigo: String,
}

/// Renglón del préstamo con sus cantidades reales.
///
/// `id` es `prestamo_detalle.id` (el renglón), distinto de `articulo_id` (el
/// artículo). Las cantidades se leen de la vista `v_prestamo_detalle`; la
/// pendiente ya viene calculada (`prestada - devuelta - dañada - perdida`).
#[derive(Debug, Serialize)]
pub struct LineaDevolucion {
    /// `prestamo_detalle.id`.
    pub id: i64,
    /// `prestamo_detalle.articulo_id`.
    pub articulo_id: i64,
    pub articulo: String,
    pub cantidad_prestada: i64,
    pub cantidad_devuelta: i64,
    pub cantidad_daniada: i64,
    pub cantidad_perdida: i64,
    /// Derivada en la vista: lo que aún debe volver.
    pub cantidad_pendiente: i64,
    /// Estado real de `prestamo_detalle.estado`
    /// (`pendiente`, `parcial`, `devuelto`, `con_incidente`).
    pub estado: String,
    /// Unidades individuales aún prestadas de este renglón. Vacío si el artículo
    /// no tiene control individual.
    pub unidades: Vec<UnidadDevolucion>,
}

/// Préstamo con devoluciones pendientes, con sus totales derivados.
///
/// Es lo que alimenta el listado de la pantalla. Solo se incluyen préstamos
/// `activo` con cantidades pendientes: nunca `cerrado` o `anulado`.
#[derive(Debug, Serialize)]
pub struct PrestamoDevolucionResumen {
    pub id: i64,
    pub folio: String,
    pub estudiante_id: i64,
    pub nombre_completo: String,
    pub codigo_universitario: String,
    /// Fecha local del préstamo (`YYYY-MM-DD`).
    pub fecha_prestamo: String,
    pub fecha_limite: Option<String>,
    /// Estado real (`activo`, `cerrado`, `anulado`).
    pub estado: String,
    /// Derivado: `activo` con `fecha_limite` anterior a la fecha de referencia.
    pub vencido: bool,
    pub comentario: Option<String>,
    /// Cantidad de renglones (artículos distintos).
    pub renglones: i64,
    /// Suma de `cantidad_prestada`.
    pub unidades_prestadas: i64,
    /// Suma de `cantidad_devuelta` (en buen estado).
    pub unidades_devueltas: i64,
    /// Suma de `cantidad_daniada`.
    pub unidades_daniadas: i64,
    /// Suma de `cantidad_perdida`.
    pub unidades_perdidas: i64,
    /// Suma de `cantidad_pendiente`.
    pub unidades_pendientes: i64,
    pub lineas: Vec<LineaDevolucion>,
}

/// Detalle de un préstamo para preparar una devolución.
///
/// Se devuelve aunque el préstamo no sea elegible (por ejemplo, ya `cerrado` o
/// `anulado`), para poder consultar su historial; en ese caso `elegible` es
/// `false`.
#[derive(Debug, Serialize)]
pub struct DetalleDevolucion {
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
    /// Fecha local de cierre (`YYYY-MM-DD`) cuando ya se cerró.
    pub cerrado_en: Option<String>,
    /// Fecha local de alta (`YYYY-MM-DD`).
    pub creado_en: String,
    pub renglones: i64,
    pub unidades_prestadas: i64,
    pub unidades_devueltas: i64,
    pub unidades_daniadas: i64,
    pub unidades_perdidas: i64,
    pub unidades_pendientes: i64,
    /// `true` solo si el préstamo está `activo` y todavía tiene pendientes: la
    /// única situación en la que se puede registrar una devolución nueva.
    pub elegible: bool,
    pub lineas: Vec<LineaDevolucion>,
}

/// Renglón de una devolución registrada.
#[derive(Debug, Serialize)]
pub struct LineaDevolucionHistorial {
    /// `devolucion_detalle.prestamo_detalle_id`.
    pub prestamo_detalle_id: i64,
    pub articulo_id: i64,
    pub articulo: String,
    pub cantidad_devuelta: i64,
    pub cantidad_daniada: i64,
    pub cantidad_perdida: i64,
    pub notas: Option<String>,
}

/// Un evento de devolución ya registrado (cabecera del historial).
///
/// Un préstamo puede tener varios; cada uno es un registro fechado e inmutable
/// (RN-38). No se mezcla con el cierre del préstamo: el estado de la devolución
/// no es el estado del préstamo.
#[derive(Debug, Serialize)]
pub struct DevolucionHistorial {
    pub id: i64,
    pub prestamo_id: i64,
    pub folio: String,
    pub nombre_completo: String,
    pub codigo_universitario: String,
    /// Fecha y hora del registro (RN-37).
    pub fecha_devolucion: String,
    pub observaciones: Option<String>,
    pub cantidad_devuelta: i64,
    pub cantidad_daniada: i64,
    pub cantidad_perdida: i64,
    pub lineas: Vec<LineaDevolucionHistorial>,
}

/// Tarjetas resumen de Devoluciones, expresadas en **número de préstamos**
/// (salvo `unidades_pendientes`, que es un total de unidades, con nombre
/// explícito para no confundirse con los conteos).
#[derive(Debug, Serialize)]
pub struct EstadisticasDevoluciones {
    /// Préstamos `activo` con al menos un renglón pendiente.
    pub pendientes: i64,
    /// Préstamos `activo` con pendientes **y** alguna devolución ya registrada.
    pub parciales: i64,
    /// Préstamos en estado `cerrado` (ya sin pendientes).
    pub completadas: i64,
    /// Préstamos `activo` con `fecha_limite` anterior a hoy y pendientes.
    pub vencidas: i64,
    /// Unidades pendientes de los préstamos activos (total, no préstamos).
    pub unidades_pendientes: i64,
}

// ---------------------------------------------------------------------------
// Escritura (Etapa E1). Entrada de `registrar_devolucion` y resultado.
//
// La fecha la fija el backend; la entrada nunca la aporta. Cada línea apunta a un
// `prestamo_detalle.id` real (no a un artículo). Para artículos sin control
// individual se envían las tres cantidades; para los de control individual, la
// lista de unidades concretas con su condición final.
// ---------------------------------------------------------------------------

/// Datos para registrar una devolución (`registrar_devolucion`).
#[derive(Debug, Deserialize)]
pub struct RegistrarDevolucionInput {
    /// `prestamo.id` al que pertenecen los renglones.
    pub prestamo_id: i64,
    /// Renglones que vuelven en este evento; al menos uno con algo mayor que cero.
    pub lineas: Vec<LineaDevolucionInput>,
    /// Observación opcional del evento completo; se guarda vacía como `NULL`.
    #[serde(default)]
    pub observaciones: Option<String>,
}

/// Un renglón de la solicitud, identificado por `prestamo_detalle.id`.
///
/// Sin control individual se usan `cantidad_devuelta`, `cantidad_daniada` y
/// `cantidad_perdida`. Con control individual se usa `unidades` y las cantidades
/// deben quedar en cero. `descripcion` es obligatoria si algo vuelve dañado o
/// perdido (RN-33); `estudiante_id`, si se indica, debe ser el del préstamo.
#[derive(Debug, Deserialize)]
pub struct LineaDevolucionInput {
    /// `prestamo_detalle.id` (el renglón), no el `articulo_id`.
    pub prestamo_detalle_id: i64,
    /// Unidades que vuelven en buen estado (solo sin control individual).
    #[serde(default)]
    pub cantidad_devuelta: i64,
    /// Unidades que vuelven dañadas (solo sin control individual).
    #[serde(default)]
    pub cantidad_daniada: i64,
    /// Unidades que se pierden (solo sin control individual).
    #[serde(default)]
    pub cantidad_perdida: i64,
    /// Unidades concretas con su condición (solo con control individual).
    #[serde(default)]
    pub unidades: Vec<UnidadDevolucionInput>,
    /// Descripción del daño o la pérdida (obligatoria en esos casos, RN-33).
    #[serde(default)]
    pub descripcion: Option<String>,
    /// Nota opcional del renglón.
    #[serde(default)]
    pub notas: Option<String>,
    /// Responsable a registrar en los incidentes; debe ser el del préstamo.
    #[serde(default)]
    pub estudiante_id: Option<i64>,
}

/// Una unidad individual que vuelve, con la condición con la que se recibe.
#[derive(Debug, Deserialize)]
pub struct UnidadDevolucionInput {
    /// `articulo_unidad.id` real.
    pub unidad_id: i64,
    /// `bueno`, `danado` o `perdido`.
    pub condicion: String,
}

/// Devolución registrada, con sus renglones y el estado resultante del préstamo.
///
/// Lo devuelve `registrar_devolucion` tras confirmar la transacción, para que el
/// frontend muestre el resultado sin releer.
#[derive(Debug, Serialize)]
pub struct DevolucionRegistrada {
    pub id: i64,
    pub prestamo_id: i64,
    pub folio: String,
    /// Fecha y hora del registro (RN-37).
    pub fecha_devolucion: String,
    pub observaciones: Option<String>,
    pub cantidad_devuelta: i64,
    pub cantidad_daniada: i64,
    pub cantidad_perdida: i64,
    pub lineas: Vec<LineaDevolucionHistorial>,
    /// Estado del préstamo tras la devolución (`activo` o `cerrado`).
    pub prestamo_estado: String,
    /// Unidades que siguen pendientes en todo el préstamo tras la operación.
    pub prestamo_unidades_pendientes: i64,
}
