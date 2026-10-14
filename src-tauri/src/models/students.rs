//! Modelos de datos de Estudiantes (Etapa B). Solo lectura.
//!
//! Representan exactamente lo que el directorio, las tarjetas, el historial de
//! préstamos y las incidencias de un estudiante necesitan, y se serializan a
//! JSON para el frontend. Describen el `estudiante` real (`DATABASE_DESIGN.md`
//! §4.4) y sus vínculos con `prestamo` (§4.5) e `incidente` (§4.8). No describen
//! escrituras ni el esquema de la base.

use serde::{Deserialize, Serialize};

/// Estudiante del directorio con sus recuentos derivados.
///
/// Los recuentos se calculan sobre los registros reales (`prestamo`,
/// `prestamo_detalle`, `incidente`), nunca se escriben a mano. Se exponen todos
/// los estudiantes (activos e inactivos); el frontend decide si filtra.
#[derive(Debug, Serialize)]
pub struct EstudianteDirectorio {
    pub id: i64,
    pub codigo_universitario: String,
    pub nombres: String,
    pub apellidos: String,
    /// `nombres` y `apellidos` unidos, tal como los muestra la tabla.
    pub nombre_completo: String,
    /// Estado del registro: activo o inactivo (nunca se elimina, RN-14).
    pub activo: bool,
    /// Fecha local de alta en formato ISO `YYYY-MM-DD`.
    pub creado_en: String,
    /// Préstamos en estado `activo`.
    pub prestamos_activos: i64,
    /// Préstamos en estado `cerrado` (los `anulado` no cuentan).
    pub prestamos_finalizados: i64,
    /// Unidades pendientes de devolución de los préstamos activos.
    pub unidades_activas: i64,
    /// Incidencias cuyo `estudiante_id` es este estudiante.
    pub incidencias: i64,
}

/// Estadísticas de las tarjetas del directorio de Estudiantes.
#[derive(Debug, Serialize)]
pub struct EstadisticasEstudiantes {
    /// Cantidad de filas en `estudiante` (activos e inactivos).
    pub registrados: i64,
    /// Estudiantes con al menos un préstamo en estado `activo`.
    pub con_prestamos_activos: i64,
    /// Estudiantes con al menos una incidencia asociada (`estudiante_id`).
    pub con_incidencias: i64,
}

/// Préstamo del historial de un estudiante.
#[derive(Debug, Serialize)]
pub struct PrestamoEstudiante {
    pub id: i64,
    pub folio: String,
    /// Fecha local del préstamo en formato ISO `YYYY-MM-DD`.
    pub fecha: String,
    /// Fecha límite opcional (RN-25); `None` significa que no hay vencimiento.
    pub fecha_limite: Option<String>,
    /// Estado real de `prestamo.estado` (`activo`, `cerrado`, `anulado`).
    pub estado: String,
    /// Total de unidades prestadas (suma de `cantidad_prestada`).
    pub unidades: i64,
    /// Cantidad de renglones (artículos distintos) del préstamo.
    pub renglones: i64,
}

/// Incidencia con responsabilidad atribuida a un estudiante (`incidente`).
///
/// Solo se incluyen las que referencian al estudiante por `estudiante_id`; no se
/// infiere responsabilidad por coincidencias de nombre (RN-55, RN-56).
#[derive(Debug, Serialize)]
pub struct IncidenciaEstudiante {
    pub id: i64,
    /// Tipo real de `incidente.tipo` (`perdida`, `danio`, `otro`).
    pub tipo: String,
    /// Estado real de `incidente.estado` (`abierto`, `resuelto`).
    pub estado: String,
    /// Fecha local de registro en formato ISO `YYYY-MM-DD`.
    pub fecha: String,
    /// Nombre del artículo afectado (`articulo.nombre`).
    pub articulo: String,
    pub cantidad: i64,
    pub descripcion: String,
    /// Responsabilidad real (`estudiante`, `facultad`, `sin_determinar`).
    pub responsabilidad: String,
    /// Folio del préstamo de origen, si la incidencia proviene de uno.
    pub folio: Option<String>,
}

/// Datos para registrar un estudiante (RF-EST-01, RN-11, RN-12).
///
/// `codigo_universitario` es obligatorio y único en toda la aplicación; los
/// nombres y apellidos también son obligatorios. No se aceptan otros campos: el
/// modelo real no los tiene (no hay correo, teléfono ni nota).
#[derive(Debug, Deserialize)]
pub struct CrearEstudianteInput {
    pub codigo_universitario: String,
    pub nombres: String,
    pub apellidos: String,
}

/// Datos para corregir un estudiante existente (RF-EST-05, RN-15).
///
/// El código puede corregirse (sigue siendo único, RN-11); editar los datos no
/// altera el historial de préstamos porque estos conservan el identificador.
#[derive(Debug, Deserialize)]
pub struct ActualizarEstudianteInput {
    pub id: i64,
    pub codigo_universitario: String,
    pub nombres: String,
    pub apellidos: String,
}

/// Datos para activar o desactivar un estudiante sin borrarlo (RF-EST-06, RN-14).
#[derive(Debug, Deserialize)]
pub struct CambiarEstadoEstudianteInput {
    pub id: i64,
    pub activo: bool,
}
