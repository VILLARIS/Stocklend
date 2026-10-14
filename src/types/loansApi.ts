// Contrato de tipos de la capa de lectura de Préstamos (Etapa C).
//
// Estos nombres coinciden EXACTAMENTE con lo que serializa Serde en
// `src-tauri/src/models/prestamos.rs`. Serde no convierte a camelCase: los
// campos viajan en snake_case tal como están declarados en Rust. No renombrar
// sin cambiar también el modelo de Rust.
//
// Son los datos crudos que devuelven los comandos de solo lectura
// `listar_prestamos`, `obtener_detalle_prestamo` y
// `obtener_estadisticas_prestamos`. La traducción a los modelos de presentación
// (camelCase, etiquetas de estado) vive en `src/services/loansAdapters.ts`.

/** Fila no anulada de la lista de préstamos (`PrestamoResumen`). */
export interface PrestamoResumen {
  id: number;
  folio: string;
  estudiante_id: number;
  /** `nombres` y `apellidos` unidos. */
  nombre_completo: string;
  codigo_universitario: string;
  /** Fecha local del préstamo en formato ISO `YYYY-MM-DD`. */
  fecha_prestamo: string;
  /** `null` cuando el préstamo no tiene vencimiento (RN-25). */
  fecha_limite: string | null;
  /** Estado real de SQLite: `activo`, `cerrado` o `anulado`. */
  estado: string;
  /** Derivado por Rust: `activo` con `fecha_limite` anterior a la referencia. */
  vencido: boolean;
  comentario: string | null;
  /** Fecha local de cierre (`YYYY-MM-DD`) o `null` si sigue abierto. */
  cerrado_en: string | null;
  /** Renglones del préstamo (artículos distintos). */
  renglones: number;
  /** Suma de `cantidad_prestada` (unidades totales entregadas). */
  unidades_prestadas: number;
  /** Suma de `cantidad_pendiente` (unidades aún por devolver). */
  unidades_pendientes: number;
}

/** Renglón del préstamo (`PrestamoLinea`). */
export interface PrestamoLinea {
  /** Identificador de `prestamo_detalle.id`. */
  id: number;
  articulo_id: number;
  articulo: string;
  cantidad_prestada: number;
  cantidad_devuelta: number;
  cantidad_daniada: number;
  cantidad_perdida: number;
  /** Derivada en la vista: `prestada - devuelta - dañada - perdida`. */
  cantidad_pendiente: number;
  /** Estado real: `pendiente`, `parcial`, `devuelto` o `con_incidente`. */
  estado: string;
  /** Códigos de unidades individuales ligadas al renglón (puede ir vacío). */
  unidades: string[];
}

/** Detalle de un préstamo (`PrestamoDetalle`). */
export interface PrestamoDetalle {
  id: number;
  folio: string;
  estudiante_id: number;
  nombre_completo: string;
  codigo_universitario: string;
  fecha_prestamo: string;
  fecha_limite: string | null;
  estado: string;
  vencido: boolean;
  comentario: string | null;
  cerrado_en: string | null;
  /** Fecha local de alta del préstamo (`YYYY-MM-DD`). */
  creado_en: string;
  renglones: number;
  unidades_prestadas: number;
  unidades_pendientes: number;
  /** Renglones del préstamo, ordenados por `prestamo_detalle.id`. */
  lineas: PrestamoLinea[];
}

/** Tarjetas resumen de Préstamos (`EstadisticasPrestamos`). */
export interface EstadisticasPrestamos {
  total: number;
  activos: number;
  /** Préstamos `cerrado` (etiquetados "Finalizados" en la interfaz). */
  finalizados: number;
  /** Préstamos `activo` con `fecha_limite` anterior a la referencia. */
  vencidos: number;
  anulados: number;
  /** Unidades pendientes de devolución de los préstamos activos. */
  unidades_pendientes: number;
}
