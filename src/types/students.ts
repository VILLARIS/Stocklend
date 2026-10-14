// Contrato de tipos del directorio de Estudiantes.
//
// Describen la tabla `estudiante` (DATABASE_DESIGN.md §4.4) y sus vínculos con
// `prestamo` (§4.5) e `incidente` (§4.8). Se mantienen separados de los datos de
// demostración (`src/data/demoStudents.ts`) para que la futura conexión con
// SQLite solo tenga que sustituir la fuente de datos, no las formas.

/** Estudiante del directorio (`estudiante`). */
export interface Student {
  id: string;
  codigoUniversitario: string;
  nombres: string;
  apellidos: string;
  activo: boolean;
  creadoEn: string;
}

export type LoanEstado = "Activo" | "Cerrado" | "Anulado";

/** Préstamo asociado a un estudiante (`prestamo`). */
export interface StudentLoan {
  id: string;
  folio: string;
  studentId: string;
  fecha: string;
  fechaLimite: string | null;
  estado: LoanEstado;
  unidades: number;
}

// SQLite almacena `perdida`, `danio` u `otro`. "Faltante" se conserva porque
// los datos de demostración todavía lo usan; la base real nunca lo produce.
export type IncidentTipo = "Daño" | "Pérdida" | "Faltante" | "Otro";
export type IncidentEstado = "Abierto" | "Resuelto";

/** Incidencia con responsabilidad atribuida a un estudiante (`incidente`). */
export interface StudentIncident {
  id: string;
  codigo: string;
  studentId: string;
  tipo: IncidentTipo;
  estado: IncidentEstado;
  fecha: string;
  articulo: string;
}

/** Estudiante con sus recuentos derivados para el directorio y la ficha. */
export interface StudentSummary extends Student {
  nombreCompleto: string;
  prestamosActivos: number;
  prestamosFinalizados: number;
  unidadesActivas: number;
  incidencias: number;
}
