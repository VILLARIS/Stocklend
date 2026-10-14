// Datos de demostración — Estudiantes (Fases 2.7 y 2.9).
// Separados por completo de la presentación y de cualquier fuente real.
// NO provienen de SQLite ni representan información verdadera; se sustituirán
// cuando la pantalla se conecte a la base de datos.
//
// Modelo según DATABASE_DESIGN.md §4.4: id, codigo_universitario, nombres,
// apellidos, activo y creado_en. No se añaden correo, teléfono ni carrera (no
// son requisitos). Los recuentos de préstamos e incidencias se derivan de los
// registros, nunca se escriben a mano, para que no existan contadores falsos.
//
// Los préstamos (`prestamo`, §4.5) y las incidencias (`incidente`, §4.8) usan
// el identificador del estudiante como vínculo. La fecha límite de un préstamo
// es opcional (RN-25): `null` significa que no hay vencimiento.

import type {
  Student,
  StudentIncident,
  StudentLoan,
  StudentSummary,
} from "../types/students";

export const demoStudents: Student[] = [
  { id: "s01", codigoUniversitario: "20231234567", nombres: "Ana", apellidos: "Ramírez Solís", activo: true, creadoEn: "2026-02-11" },
  { id: "s02", codigoUniversitario: "20231234568", nombres: "Bruno", apellidos: "Díaz Navarro", activo: true, creadoEn: "2026-02-11" },
  { id: "s03", codigoUniversitario: "19876543210", nombres: "Carla", apellidos: "Mendoza Ríos", activo: false, creadoEn: "2024-08-19" },
  { id: "s04", codigoUniversitario: "20222456789", nombres: "Diego", apellidos: "Torres Lima", activo: true, creadoEn: "2025-03-04" },
  { id: "s05", codigoUniversitario: "20233891234", nombres: "Elena", apellidos: "Vargas Ponce", activo: true, creadoEn: "2026-01-22" },
  { id: "s06", codigoUniversitario: "20214567890", nombres: "Luis Fernando", apellidos: "Ortega", activo: true, creadoEn: "2024-09-30" },
  { id: "s07", codigoUniversitario: "20235678901", nombres: "Camila", apellidos: "Reyes", activo: true, creadoEn: "2026-04-07" },
  { id: "s08", codigoUniversitario: "20226789012", nombres: "Diego", apellidos: "Salinas", activo: true, creadoEn: "2025-05-16" },
  { id: "s09", codigoUniversitario: "20237890123", nombres: "Valeria", apellidos: "Ponce", activo: true, creadoEn: "2026-03-02" },
  { id: "s10", codigoUniversitario: "20218901234", nombres: "Sofía", apellidos: "Delgado Ramos", activo: true, creadoEn: "2024-10-21" },
  { id: "s11", codigoUniversitario: "20229012345", nombres: "Mateo", apellidos: "Herrera Lozano", activo: false, creadoEn: "2025-02-13" },
  { id: "s12", codigoUniversitario: "20230123456", nombres: "Renata", apellidos: "Cárdenas Peña", activo: true, creadoEn: "2025-08-28" },
];

// Folios coherentes con los préstamos recientes del panel: Ana, Bruno, Diego y
// Camila están activos; los de Carla, Elena, Luis Fernando, Valeria, Ana
// (histórico) y Camila figuran cerrados, y el de Elena anulado.
export const demoStudentLoans: StudentLoan[] = [
  { id: "l01", folio: "PRE-2026-000014", studentId: "s01", fecha: "2026-10-10", fechaLimite: "2026-10-17", estado: "Activo", unidades: 3 },
  { id: "l02", folio: "PRE-2026-000013", studentId: "s02", fecha: "2026-10-09", fechaLimite: null, estado: "Activo", unidades: 1 },
  { id: "l03", folio: "PRE-2026-000011", studentId: "s04", fecha: "2026-10-07", fechaLimite: "2026-10-21", estado: "Activo", unidades: 2 },
  { id: "l04", folio: "PRE-2026-000016", studentId: "s07", fecha: "2026-10-11", fechaLimite: null, estado: "Activo", unidades: 2 },
  { id: "l05", folio: "PRE-2026-000012", studentId: "s03", fecha: "2026-10-08", fechaLimite: null, estado: "Cerrado", unidades: 4 },
  { id: "l06", folio: "PRE-2026-000010", studentId: "s05", fecha: "2026-10-05", fechaLimite: null, estado: "Anulado", unidades: 1 },
  { id: "l07", folio: "PRE-2026-000009", studentId: "s06", fecha: "2026-10-03", fechaLimite: null, estado: "Cerrado", unidades: 2 },
  { id: "l08", folio: "PRE-2026-000008", studentId: "s09", fecha: "2026-10-01", fechaLimite: null, estado: "Cerrado", unidades: 3 },
  { id: "l09", folio: "PRE-2026-000006", studentId: "s01", fecha: "2026-09-20", fechaLimite: null, estado: "Cerrado", unidades: 2 },
  { id: "l10", folio: "PRE-2026-000004", studentId: "s07", fecha: "2026-09-15", fechaLimite: null, estado: "Cerrado", unidades: 1 },
];

// Incidencias con responsabilidad atribuida explícitamente a un estudiante
// (RN-55, RN-56). El resto de incidencias del sistema son de depósito y no
// aparecen aquí. El artículo afectado es un dato real del inventario.
export const demoStudentIncidents: StudentIncident[] = [
  { id: "i01", codigo: "INC-2026-0007", studentId: "s01", tipo: "Pérdida", estado: "Abierto", fecha: "2026-10-08", articulo: "Cuchillo de chef" },
  { id: "i02", codigo: "INC-2026-0004", studentId: "s03", tipo: "Daño", estado: "Resuelto", fecha: "2026-10-02", articulo: "Colador grande" },
  { id: "i03", codigo: "INC-2026-0002", studentId: "s09", tipo: "Faltante", estado: "Abierto", fecha: "2026-09-28", articulo: "Copas de vino" },
];

export function buildStudentSummary(student: Student): StudentSummary {
  const loans = demoStudentLoans.filter((loan) => loan.studentId === student.id);
  const activos = loans.filter((loan) => loan.estado === "Activo");
  return {
    ...student,
    nombreCompleto: `${student.nombres} ${student.apellidos}`,
    prestamosActivos: activos.length,
    prestamosFinalizados: loans.filter((loan) => loan.estado === "Cerrado")
      .length,
    unidadesActivas: activos.reduce((total, loan) => total + loan.unidades, 0),
    incidencias: demoStudentIncidents.filter(
      (incident) => incident.studentId === student.id,
    ).length,
  };
}

export const studentsWithSummary: StudentSummary[] = demoStudents
  .map(buildStudentSummary)
  .sort((a, b) => a.apellidos.localeCompare(b.apellidos, "es"));

export const studentDirectorySummary = {
  registrados: demoStudents.length,
  conPrestamosActivos: demoStudents.filter((student) =>
    demoStudentLoans.some(
      (loan) => loan.studentId === student.id && loan.estado === "Activo",
    ),
  ).length,
  conIncidencias: demoStudents.filter((student) =>
    demoStudentIncidents.some((incident) => incident.studentId === student.id),
  ).length,
};

// Selectores de la ficha del estudiante. Ordenados de más reciente a más
// antiguo, igual que la vista de préstamos ordena por fecha descendente.
export function getStudentLoans(studentId: string): StudentLoan[] {
  return demoStudentLoans
    .filter((loan) => loan.studentId === studentId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function getStudentIncidents(studentId: string): StudentIncident[] {
  return demoStudentIncidents
    .filter((incident) => incident.studentId === studentId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function normalizarCodigo(value: string): string {
  return value.trim().toLowerCase();
}

// RF-EST-02: el código universitario es único. La comparación ignora espacios
// y mayúsculas; `exceptId` permite excluir al propio estudiante al editar.
export function findStudentByCodigo(
  codigo: string,
  exceptId?: string,
): Student | undefined {
  const target = normalizarCodigo(codigo);
  if (target === "") return undefined;
  return demoStudents.find(
    (student) =>
      student.id !== exceptId &&
      normalizarCodigo(student.codigoUniversitario) === target,
  );
}

// Presentación de fechas ISO (aaaa-mm-dd) al formato usado en la interfaz.
export function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}
