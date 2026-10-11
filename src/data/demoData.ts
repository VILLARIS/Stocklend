// Datos de demostración — Fase 2.1.
// Separados por completo de la capa de presentación y de cualquier fuente real.
// NO provienen de SQLite ni representan información verdadera; se sustituirán
// cuando el Panel se conecte a la base de datos.

export const DEMO_MODE = true;

export type DemoStat = {
  key: string;
  label: string;
  value: number;
  hint?: string;
};

export type DemoLoan = {
  id: string;
  folio: string;
  student: string;
  date: string;
  items: number;
  status: "Activo" | "Cerrado" | "Anulado";
};

export type DemoReturn = {
  id: string;
  student: string;
  folio: string;
  pending: number;
  due: string | null;
};

export type DemoAlert = {
  id: string;
  type: "Daño" | "Pérdida" | "Faltante";
  item: string;
  origin: string;
  status: "Abierto" | "Resuelto";
};

export const demoStats: DemoStat[] = [
  { key: "articles", label: "Artículos registrados", value: 142, hint: "12 con control individual" },
  { key: "units", label: "Unidades en existencia", value: 318, hint: "en todos los artículos" },
  { key: "available", label: "Disponibles para prestar", value: 214, hint: "listas para entregar" },
  { key: "loaned", label: "Prestadas a estudiantes", value: 24, hint: "en 7 préstamos activos" },
];

export const demoRecentLoans: DemoLoan[] = [
  { id: "1", folio: "PRE-2026-000014", student: "Ana Ramírez Solís", date: "10/10/2026", items: 3, status: "Activo" },
  { id: "2", folio: "PRE-2026-000013", student: "Bruno Díaz Navarro", date: "09/10/2026", items: 1, status: "Activo" },
  { id: "3", folio: "PRE-2026-000012", student: "Carla Mendoza Ríos", date: "08/10/2026", items: 4, status: "Cerrado" },
  { id: "4", folio: "PRE-2026-000011", student: "Diego Torres Lima", date: "07/10/2026", items: 2, status: "Activo" },
  { id: "5", folio: "PRE-2026-000010", student: "Elena Vargas Ponce", date: "05/10/2026", items: 1, status: "Anulado" },
];

export const demoPendingReturns: DemoReturn[] = [
  { id: "1", student: "Ana Ramírez Solís", folio: "PRE-2026-000001", pending: 2, due: "05/10/2026" },
  { id: "2", student: "Diego Torres Lima", folio: "PRE-2026-000004", pending: 1, due: null },
];

export const demoAlerts: DemoAlert[] = [
  { id: "1", type: "Daño", item: "Olla grande", origin: "Depósito", status: "Abierto" },
  { id: "2", type: "Pérdida", item: "Llave inglesa", origin: "Préstamo PRE-2026-000008", status: "Abierto" },
  { id: "3", type: "Faltante", item: "Paño de limpieza", origin: "Depósito", status: "Resuelto" },
];
