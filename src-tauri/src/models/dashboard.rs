//! Modelos de datos del Panel (Etapa B).
//!
//! Representan exactamente la información que el Dashboard necesita y se
//! serializan a JSON para el frontend. Son de solo lectura: no describen
//! escrituras ni el esquema de la base.

use serde::Serialize;

/// Datos completos del Panel, entregados en una sola llamada.
#[derive(Debug, Serialize)]
pub struct Panel {
    pub estadisticas: EstadisticasPanel,
    pub actividad_semanal: Vec<DiaActividad>,
    pub distribucion_inventario: DistribucionInventario,
    pub prestamos_recientes: Vec<PrestamoReciente>,
}

/// Estadísticas generales del inventario (`articulo`).
#[derive(Debug, Serialize)]
pub struct EstadisticasPanel {
    pub articulos_activos: i64,
    pub unidades_totales: i64,
    pub unidades_disponibles: i64,
    pub unidades_prestadas: i64,
    pub unidades_daniadas: i64,
    pub unidades_faltantes: i64,
}

/// Un día natural dentro de la ventana de actividad reciente.
#[derive(Debug, Serialize)]
pub struct DiaActividad {
    /// Fecha local en formato ISO `YYYY-MM-DD`.
    pub fecha: String,
    /// Etiqueta corta del día de la semana (p. ej. `Lun`).
    pub etiqueta: String,
    /// Préstamos no anulados registrados ese día.
    pub prestamos: i64,
}

/// Distribución de unidades por estado. Coincide con `EstadisticasPanel`.
#[derive(Debug, Serialize)]
pub struct DistribucionInventario {
    pub disponible: i64,
    pub prestado: i64,
    pub danado: i64,
    pub faltante: i64,
}

/// Préstamo reciente para la lista del Panel.
#[derive(Debug, Serialize)]
pub struct PrestamoReciente {
    pub id: i64,
    pub folio: String,
    pub estudiante: String,
    /// Fecha local del préstamo en formato ISO `YYYY-MM-DD`.
    pub fecha: String,
    pub estado: String,
    /// Cantidad de renglones (artículos distintos) del préstamo.
    pub articulos: i64,
}
