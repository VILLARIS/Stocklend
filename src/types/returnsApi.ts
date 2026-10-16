// Contrato de tipos de la capa de lectura de Devoluciones (Etapa C).
//
// Estos nombres coinciden EXACTAMENTE con lo que serializa Serde en
// `src-tauri/src/models/devoluciones.rs`. Serde no convierte a camelCase: los
// campos viajan en snake_case tal como están declarados en Rust. No renombrar
// sin cambiar también el modelo de Rust.
//
// Son los datos crudos que devuelven los comandos de solo lectura
// `listar_devoluciones_pendientes`, `obtener_detalle_devolucion`,
// `listar_historial_devoluciones` y `obtener_estadisticas_devoluciones`.
// La traducción a los modelos de presentación (camelCase, etiquetas de estado)
// vive en `src/services/returnsAdapters.ts`.
//
// Identificadores (no confundir): `LineaDevolucion.id` es
// `prestamo_detalle.id`; `articulo_id` es `articulo.id`; `DevolucionHistorial.id`
// es `devolucion.id`; `UnidadDevolucion.id` es `articulo_unidad.id`.

/** Unidad física aún prestada de un renglón (`UnidadDevolucion`). */
export interface UnidadDevolucion {
  /** `articulo_unidad.id` real. */
  id: number;
  /** `articulo_unidad.codigo` real. */
  codigo: string;
}

/** Renglón del préstamo con sus cantidades reales (`LineaDevolucion`). */
export interface LineaDevolucion {
  /** `prestamo_detalle.id` (el renglón), distinto de `articulo_id`. */
  id: number;
  /** `prestamo_detalle.articulo_id`. */
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
  /** Unidades aún prestadas de este renglón (vacío sin control individual). */
  unidades: UnidadDevolucion[];
}

/** Préstamo con devoluciones pendientes (`PrestamoDevolucionResumen`). */
export interface PrestamoDevolucionResumen {
  id: number;
  folio: string;
  estudiante_id: number;
  /** `nombres` y `apellidos` unidos. */
  nombre_completo: string;
  codigo_universitario: string;
  /** Fecha local del préstamo (`YYYY-MM-DD`). */
  fecha_prestamo: string;
  /** `null` cuando el préstamo no tiene vencimiento (RN-25). */
  fecha_limite: string | null;
  /** Estado real de SQLite: siempre `activo` en este listado. */
  estado: string;
  /** Derivado por Rust: `activo` con `fecha_limite` anterior a la referencia. */
  vencido: boolean;
  comentario: string | null;
  /** Cantidad de renglones (artículos distintos). */
  renglones: number;
  /** Suma de `cantidad_prestada`. */
  unidades_prestadas: number;
  /** Suma de `cantidad_devuelta`. */
  unidades_devueltas: number;
  /** Suma de `cantidad_daniada`. */
  unidades_daniadas: number;
  /** Suma de `cantidad_perdida`. */
  unidades_perdidas: number;
  /** Suma de `cantidad_pendiente`. */
  unidades_pendientes: number;
  lineas: LineaDevolucion[];
}

/** Detalle de un préstamo para preparar una devolución (`DetalleDevolucion`). */
export interface DetalleDevolucion {
  id: number;
  folio: string;
  estudiante_id: number;
  nombre_completo: string;
  codigo_universitario: string;
  fecha_prestamo: string;
  fecha_limite: string | null;
  /** Estado real: `activo`, `cerrado` o `anulado`. */
  estado: string;
  vencido: boolean;
  comentario: string | null;
  /** Fecha local de cierre (`YYYY-MM-DD`) o `null` si sigue abierto. */
  cerrado_en: string | null;
  /** Fecha local de alta (`YYYY-MM-DD`). */
  creado_en: string;
  renglones: number;
  unidades_prestadas: number;
  unidades_devueltas: number;
  unidades_daniadas: number;
  unidades_perdidas: number;
  unidades_pendientes: number;
  /** `true` solo si el préstamo está `activo` y aún tiene pendientes. */
  elegible: boolean;
  lineas: LineaDevolucion[];
}

/** Renglón de una devolución registrada (`LineaDevolucionHistorial`). */
export interface LineaDevolucionHistorial {
  /** `devolucion_detalle.prestamo_detalle_id`. */
  prestamo_detalle_id: number;
  articulo_id: number;
  articulo: string;
  cantidad_devuelta: number;
  cantidad_daniada: number;
  cantidad_perdida: number;
  notas: string | null;
}

/** Evento de devolución registrado (`DevolucionHistorial`). */
export interface DevolucionHistorial {
  /** `devolucion.id`. */
  id: number;
  prestamo_id: number;
  folio: string;
  nombre_completo: string;
  codigo_universitario: string;
  /** Fecha y hora del registro (RN-37). */
  fecha_devolucion: string;
  observaciones: string | null;
  cantidad_devuelta: number;
  cantidad_daniada: number;
  cantidad_perdida: number;
  lineas: LineaDevolucionHistorial[];
}

/** Tarjetas resumen de Devoluciones (`EstadisticasDevoluciones`). */
export interface EstadisticasDevoluciones {
  /** Préstamos `activo` con al menos un renglón pendiente. */
  pendientes: number;
  /** Préstamos `activo` con pendientes y alguna devolución registrada. */
  parciales: number;
  /** Préstamos en estado `cerrado`. */
  completadas: number;
  /** Préstamos `activo` vencidos con pendientes. */
  vencidas: number;
  /** Unidades pendientes de los préstamos activos (total, no préstamos). */
  unidades_pendientes: number;
}

// ---------------------------------------------------------------------------
// Escritura (Etapa E2). Entrada de `registrar_devolucion` y resultado.
//
// Deben coincidir EXACTAMENTE con `RegistrarDevolucionInput`,
// `LineaDevolucionInput`, `UnidadDevolucionInput` y `DevolucionRegistrada` de
// `src-tauri/src/models/devoluciones.rs`. Serde no convierte a camelCase, así
// que los campos viajan en snake_case. La fecha de devolución la fija el
// backend: nunca se envía desde la interfaz.
//
// Cada línea apunta a un `prestamo_detalle.id` real (el renglón), NUNCA a un
// `articulo_id`. Para artículos sin control individual se envían las tres
// cantidades; para los de control individual, las cantidades quedan en cero y
// se envían las unidades concretas (`articulo_unidad.id`) con su condición.
// ---------------------------------------------------------------------------

/** Condición final de una unidad individual (valores aceptados por Rust). */
export type CondicionUnidad = "bueno" | "danado" | "perdido";

/** Unidad física que vuelve, con la condición con la que se recibe. */
export interface UnidadDevolucionInput {
  /** `articulo_unidad.id` real. */
  unidad_id: number;
  /** `bueno`, `danado` o `perdido`. */
  condicion: CondicionUnidad;
}

/**
 * Renglón de la solicitud (`prestamo_detalle.id`).
 *
 * Con control individual se envían `unidades` y las tres cantidades quedan en
 * cero; sin control individual, se envían las tres cantidades y `unidades` va
 * vacío. `descripcion` es obligatoria si algo vuelve dañado o perdido (RN-33) y
 * `estudiante_id`, si se indica, debe ser el del préstamo (RN-56).
 */
export interface LineaDevolucionInput {
  /** `prestamo_detalle.id` (el renglón), no el `articulo_id`. */
  prestamo_detalle_id: number;
  /** Unidades que vuelven en buen estado (solo sin control individual). */
  cantidad_devuelta: number;
  /** Unidades que vuelven dañadas (solo sin control individual). */
  cantidad_daniada: number;
  /** Unidades que se pierden (solo sin control individual). */
  cantidad_perdida: number;
  /** Unidades concretas con su condición (solo con control individual). */
  unidades?: UnidadDevolucionInput[];
  /** Descripción del daño o la pérdida (obligatoria en esos casos, RN-33). */
  descripcion?: string | null;
  /** Nota opcional del renglón. */
  notas?: string | null;
  /** Responsable a registrar en los incidentes; debe ser el del préstamo. */
  estudiante_id?: number | null;
}

/** Datos de entrada de `registrar_devolucion` (DTO snake_case de Rust). */
export interface RegistrarDevolucionInput {
  /** `prestamo.id` al que pertenecen los renglones. */
  prestamo_id: number;
  /** Renglones que vuelven; al menos uno con algo mayor que cero. */
  lineas: LineaDevolucionInput[];
  /** Observación opcional del evento completo; se guarda vacía como `NULL`. */
  observaciones?: string | null;
}

/**
 * Devolución registrada (`DevolucionRegistrada`), tal como la devuelve el
 * backend tras confirmar la transacción: incluye el estado real del préstamo
 * (`prestamo_estado`) y las unidades que siguen pendientes.
 */
export interface DevolucionRegistrada {
  /** `devolucion.id` real. */
  id: number;
  prestamo_id: number;
  folio: string;
  /** Fecha y hora del registro (RN-37). */
  fecha_devolucion: string;
  observaciones: string | null;
  cantidad_devuelta: number;
  cantidad_daniada: number;
  cantidad_perdida: number;
  lineas: LineaDevolucionHistorial[];
  /** Estado del préstamo tras la devolución: `activo` o `cerrado`. */
  prestamo_estado: string;
  /** Unidades que siguen pendientes en todo el préstamo tras la operación. */
  prestamo_unidades_pendientes: number;
}
