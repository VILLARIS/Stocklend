export type LoanStatus = "Activo" | "Finalizado" | "Vencido" | "Anulado";

export interface LoanItem {
  id: string;
  nombre: string;
  cantidad: number;
  devueltas: number;
}

export interface DemoLoan {
  id: string;
  folio: string;
  estudiante: string;
  codigoUniversitario: string;
  fechaEntrega: string;
  fechaLimite: string;
  estado: LoanStatus;
  items: LoanItem[];
  observacion?: string;
}

export const demoLoans: DemoLoan[] = [
  { id: "1", folio: "PRE-2026-001", estudiante: "Ana María Ramírez", codigoUniversitario: "20231234567", fechaEntrega: "2026-10-09", fechaLimite: "2026-10-13", estado: "Activo", items: [{ id: "1a", nombre: "Olla grande", cantidad: 2, devueltas: 0 }, { id: "1b", nombre: "Tabla de picar", cantidad: 1, devueltas: 0 }] },
  { id: "2", folio: "PRE-2026-002", estudiante: "Luis Fernando Torres", codigoUniversitario: "20231024531", fechaEntrega: "2026-10-08", fechaLimite: "2026-10-10", estado: "Vencido", items: [{ id: "2a", nombre: "Cuchillo de chef", cantidad: 2, devueltas: 0 }, { id: "2b", nombre: "Sartén antiadherente", cantidad: 1, devueltas: 0 }], observacion: "Pendiente de devolución." },
  { id: "3", folio: "PRE-2026-003", estudiante: "Valeria Mendoza", codigoUniversitario: "20231183729", fechaEntrega: "2026-10-07", fechaLimite: "2026-10-09", estado: "Finalizado", items: [{ id: "3a", nombre: "Licuadora", cantidad: 1, devueltas: 1 }] },
  { id: "4", folio: "PRE-2026-004", estudiante: "Carlos Huamán", codigoUniversitario: "20231278954", fechaEntrega: "2026-10-10", fechaLimite: "2026-10-14", estado: "Activo", items: [{ id: "4a", nombre: "Colador grande", cantidad: 3, devueltas: 1 }] },
  { id: "5", folio: "PRE-2026-005", estudiante: "María Fernanda Salas", codigoUniversitario: "20221057348", fechaEntrega: "2026-10-06", fechaLimite: "2026-10-07", estado: "Finalizado", items: [{ id: "5a", nombre: "Olla mediana", cantidad: 2, devueltas: 2 }] },
  { id: "6", folio: "PRE-2026-006", estudiante: "Diego Quispe", codigoUniversitario: "20231347891", fechaEntrega: "2026-10-10", fechaLimite: "2026-10-15", estado: "Activo", items: [{ id: "6a", nombre: "Prensa de ajos", cantidad: 2, devueltas: 0 }] },
  { id: "7", folio: "PRE-2026-007", estudiante: "Lucía Paredes", codigoUniversitario: "20231209875", fechaEntrega: "2026-10-05", fechaLimite: "2026-10-08", estado: "Anulado", items: [{ id: "7a", nombre: "Batidora", cantidad: 1, devueltas: 0 }] },
  { id: "8", folio: "PRE-2026-008", estudiante: "José Miguel Rojas", codigoUniversitario: "20221098432", fechaEntrega: "2026-10-09", fechaLimite: "2026-10-12", estado: "Activo", items: [{ id: "8a", nombre: "Tabla de picar", cantidad: 2, devueltas: 0 }] },
  { id: "9", folio: "PRE-2026-009", estudiante: "Elena Castillo", codigoUniversitario: "20231123456", fechaEntrega: "2026-10-04", fechaLimite: "2026-10-06", estado: "Finalizado", items: [{ id: "9a", nombre: "Olla grande", cantidad: 1, devueltas: 1 }] },
  { id: "10", folio: "PRE-2026-010", estudiante: "Andrés Flores", codigoUniversitario: "20231004567", fechaEntrega: "2026-10-08", fechaLimite: "2026-10-09", estado: "Vencido", items: [{ id: "10a", nombre: "Cuchillo de chef", cantidad: 1, devueltas: 0 }] },
];

export function totalUnidades(loan: DemoLoan): number {
  return loan.items.reduce((sum, item) => sum + item.cantidad, 0);
}

export function formatLoanDate(value: string): string {
  if (!value) return "—";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export const loanSummary = {
  total: demoLoans.length,
  activos: demoLoans.filter((loan) => loan.estado === "Activo").length,
  finalizados: demoLoans.filter((loan) => loan.estado === "Finalizado").length,
  vencidos: demoLoans.filter((loan) => loan.estado === "Vencido").length,
};
