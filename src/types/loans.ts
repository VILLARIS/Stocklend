// Contrato de tipos del módulo de Préstamos.
//
// Se separan de los datos de demostración (`src/data/demoLoans.ts`) para que,
// cuando la información venga de SQLite, solo cambie la fuente de datos y no las
// formas que consume la UI. Describen `prestamo` y `prestamo_detalle`
// (DATABASE_DESIGN.md §4.5 y §4.6).
//
// Nota (Etapa B/C): `prestamo.estado` en la base es `activo | cerrado | anulado`.
// Las etiquetas "Finalizado" y "Vencido" de la vista son derivadas y no se
// almacenan así (ver `src/services/loansAdapters.ts`).
//
// Los campos opcionales amplían los modelos de demostración para transportar los
// datos reales de SQLite (identificadores, cantidades y fechas) sin romper los
// componentes de Devoluciones, que siguen usando los campos originales.

export type LoanStatus = "Activo" | "Finalizado" | "Vencido" | "Anulado";

/** Renglón del préstamo: un artículo y cuánto se entregó y se devolvió. */
export interface LoanItem {
  /** Identificador real de `prestamo_detalle.id` (o id de demostración). */
  id: string;
  nombre: string;
  /** Unidades prestadas del renglón (`cantidad_prestada`). */
  cantidad: number;
  /** Unidades devueltas (`cantidad_devuelta`). */
  devueltas: number;
  /** Identificador real del artículo (`articulo.id`), si viene de SQLite. */
  articuloId?: number;
  /** Unidades aún por devolver del renglón (`cantidad_pendiente`). */
  pendientes?: number;
  /** Unidades dañadas (`cantidad_daniada`). */
  danadas?: number;
  /** Unidades perdidas (`cantidad_perdida`). */
  perdidas?: number;
  /** Estado real del renglón: `pendiente`, `parcial`, `devuelto` o `con_incidente`. */
  estadoDetalle?: string;
  /** Códigos de unidades individuales ligadas al renglón (vacío si no aplica). */
  unidades?: string[];
}

/** Préstamo tal como lo muestran el listado y los diálogos. */
export interface DemoLoan {
  /** Identificador real de `prestamo.id` (o id de demostración). */
  id: string;
  folio: string;
  estudiante: string;
  codigoUniversitario: string;
  fechaEntrega: string;
  /** `null` cuando el préstamo no tiene vencimiento (RN-25). */
  fechaLimite: string | null;
  estado: LoanStatus;
  /** Renglones del préstamo. Vacío en las filas del listado (ver adaptadores). */
  items: LoanItem[];
  observacion?: string;
  /** Identificador real del estudiante (`prestamo.estudiante_id`). */
  estudianteId?: number;
  /** Fecha local de cierre (`prestamo.cerrado_en`) o `null` si sigue abierto. */
  cerradoEn?: string | null;
  /** Renglones del préstamo (artículos distintos). */
  renglones?: number;
  /** Unidades totales prestadas (`Σ cantidad_prestada`). */
  unidadesPrestadas?: number;
  /** Unidades pendientes de devolución (`Σ cantidad_pendiente`). */
  unidadesPendientes?: number;
}

/** Totales de las tarjetas resumen de Préstamos. */
export interface LoanSummary {
  total: number;
  activos: number;
  finalizados: number;
  vencidos: number;
  /** Préstamos anulados (no cuentan como finalizados). */
  anulados?: number;
  /** Unidades pendientes de devolución de los préstamos activos. */
  unidadesPendientes?: number;
}
