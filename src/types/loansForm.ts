// Fuentes de datos del formulario de préstamo.
//
// El `LoansPage` obtiene estudiantes y artículos/unidades reales de SQLite y los
// pasa al diálogo a través de estas estructuras, junto con su estado de carga y
// error. Así el formulario nunca usa los datos de demostración y puede mostrar
// estados de carga, vacío y error.

import type { ArticuloInventario, UnidadInventario } from "./inventory";
import type { StudentSummary } from "./students";

export type LoanResourceStatus = "idle" | "loading" | "success" | "error";

/** Estudiantes disponibles como responsable del préstamo. */
export interface LoanStudentSource {
  students: StudentSummary[];
  status: LoanResourceStatus;
  error: string | null;
  onRetry: () => void;
}

/** Artículos prestables y sus unidades (para control individual). */
export interface LoanInventorySource {
  articles: ArticuloInventario[];
  units: UnidadInventario[];
  status: LoanResourceStatus;
  error: string | null;
  onRetry: () => void;
}
