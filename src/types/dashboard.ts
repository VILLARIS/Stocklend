// Contrato de tipos del Panel de control.
//
// Estos nombres coinciden EXACTAMENTE con lo que serializa Serde en
// `src-tauri/src/models/dashboard.rs`. Serde no convierte a camelCase: los
// campos viajan en snake_case tal como están declarados en Rust. No renombrar
// sin cambiar también el modelo de Rust.

/** Estadísticas generales del inventario (`EstadisticasPanel`). */
export interface DashboardStats {
  articulos_activos: number;
  unidades_totales: number;
  unidades_disponibles: number;
  unidades_prestadas: number;
  unidades_daniadas: number;
  unidades_faltantes: number;
}

/** Un día natural de la ventana de actividad reciente (`DiaActividad`). */
export interface WeeklyActivityDay {
  /** Fecha local en formato ISO `YYYY-MM-DD`. */
  fecha: string;
  /** Etiqueta corta del día de la semana (p. ej. `Lun`). */
  etiqueta: string;
  /** Préstamos no anulados registrados ese día. */
  prestamos: number;
}

/** Distribución de unidades por estado (`DistribucionInventario`). */
export interface InventoryDistribution {
  disponible: number;
  prestado: number;
  danado: number;
  faltante: number;
}

/** Préstamo reciente para la lista del Panel (`PrestamoReciente`). */
export interface RecentLoan {
  id: number;
  folio: string;
  /** Nombre completo del estudiante. */
  estudiante: string;
  /** Fecha local del préstamo en formato ISO `YYYY-MM-DD`. */
  fecha: string;
  /** Estado tal como se almacena en SQLite: `activo`, `cerrado` o `anulado`. */
  estado: string;
  /** Cantidad de renglones (artículos distintos) del préstamo. */
  articulos: number;
}

/** Respuesta completa del comando Tauri `obtener_panel` (`Panel`). */
export interface DashboardPanel {
  estadisticas: DashboardStats;
  actividad_semanal: WeeklyActivityDay[];
  distribucion_inventario: InventoryDistribution;
  prestamos_recientes: RecentLoan[];
}
