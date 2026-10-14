// Contrato de tipos de la capa de lectura de Estudiantes (Etapa C).
//
// Estos nombres coinciden EXACTAMENTE con lo que serializa Serde en
// `src-tauri/src/models/students.rs`. Serde no convierte a camelCase: los
// campos viajan en snake_case tal como están declarados en Rust. No renombrar
// sin cambiar también el modelo de Rust.
//
// Son los datos crudos que devuelven los comandos de solo lectura
// `listar_estudiantes`, `obtener_estadisticas_estudiantes`,
// `obtener_historial_estudiante` y `obtener_incidencias_estudiante`.

/** Fila del directorio de estudiantes (`EstudianteDirectorio`). */
export interface EstudianteDirectorio {
  id: number;
  codigo_universitario: string;
  nombres: string;
  apellidos: string;
  /** `nombres` y `apellidos` unidos, tal como los muestra la tabla. */
  nombre_completo: string;
  activo: boolean;
  /** Fecha local de alta en formato ISO `YYYY-MM-DD`. */
  creado_en: string;
  /** Préstamos en estado `activo`. */
  prestamos_activos: number;
  /** Préstamos en estado `cerrado` (los `anulado` no cuentan). */
  prestamos_finalizados: number;
  /** Unidades pendientes de devolución de los préstamos activos. */
  unidades_activas: number;
  /** Incidencias cuyo `estudiante_id` es este estudiante. */
  incidencias: number;
}

/** Tarjetas del directorio (`EstadisticasEstudiantes`). */
export interface EstadisticasEstudiantes {
  registrados: number;
  con_prestamos_activos: number;
  con_incidencias: number;
}

/** Préstamo del historial de un estudiante (`PrestamoEstudiante`). */
export interface PrestamoHistorialEstudiante {
  id: number;
  folio: string;
  /** Fecha local del préstamo en formato ISO `YYYY-MM-DD`. */
  fecha: string;
  /** `null` cuando el préstamo no tiene vencimiento (RN-25). */
  fecha_limite: string | null;
  /** Estado real de SQLite: `activo`, `cerrado` o `anulado`. */
  estado: string;
  /** Total de unidades prestadas (suma de `cantidad_prestada`). */
  unidades: number;
  /** Cantidad de renglones (artículos distintos) del préstamo. */
  renglones: number;
}

/** Incidencia con responsabilidad atribuida a un estudiante (`IncidenciaEstudiante`). */
export interface IncidenciaEstudiante {
  id: number;
  /** Tipo real de SQLite: `perdida`, `danio` u `otro`. */
  tipo: string;
  /** Estado real de SQLite: `abierto` o `resuelto`. */
  estado: string;
  /** Fecha local de registro en formato ISO `YYYY-MM-DD`. */
  fecha: string;
  /** Nombre del artículo afectado. */
  articulo: string;
  cantidad: number;
  descripcion: string;
  /** Responsabilidad real: `estudiante`, `facultad` o `sin_determinar`. */
  responsabilidad: string;
  /** Folio del préstamo de origen, si la incidencia proviene de uno. */
  folio: string | null;
}
