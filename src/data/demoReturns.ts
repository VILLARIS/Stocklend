
import {
  demoLoans,
  type DemoLoan,
} from "./demoLoans";

// ========================================
// TIPOS DE DEVOLUCIONES
// ========================================

export type ReturnStatus =
  | "Pendiente"
  | "Parcial"
  | "Completada"
  | "Vencida";

export type ReturnRecord = DemoLoan & {
  estadoDevolucion: ReturnStatus;
  pendientes: number;
  devueltas: number;
  total: number;
};

// ========================================
// CALCULAR ESTADO DE DEVOLUCIÓN
// ========================================

function getReturnStatus(
  loan: DemoLoan,
  total: number,
  devueltas: number,
  pendientes: number
): ReturnStatus {
  // Todas las unidades fueron devueltas.
  if (total > 0 && pendientes === 0) {
    return "Completada";
  }

  // Algunas unidades ya fueron devueltas.
  if (devueltas > 0) {
    return "Parcial";
  }

  // El préstamo está vencido.
  if (loan.estado === "Vencido") {
    return "Vencida";
  }

  // Todavía no se registra ninguna devolución.
  return "Pendiente";
}

// ========================================
// TRANSFORMAR PRÉSTAMOS EN DEVOLUCIONES
// ========================================

function createReturnRecord(
  loan: DemoLoan
): ReturnRecord {
  const total = loan.items.reduce(
    (sum, item) => sum + item.cantidad,
    0
  );

  const devueltas = loan.items.reduce(
    (sum, item) => sum + item.devueltas,
    0
  );

  const pendientes = Math.max(
    0,
    total - devueltas
  );

  const estadoDevolucion = getReturnStatus(
    loan,
    total,
    devueltas,
    pendientes
  );

  return {
    ...loan,
    total,
    devueltas,
    pendientes,
    estadoDevolucion,
  };
}

// ========================================
// DATOS DE DEMOSTRACIÓN
// ========================================

export const demoReturns: ReturnRecord[] =
  demoLoans
    .filter((loan) => loan.estado !== "Anulado")
    .map(createReturnRecord);

// ========================================
// ESTADÍSTICAS
// ========================================

export const returnsSummary = {
  pendientes: demoReturns.filter(
    (loan) => loan.pendientes > 0
  ).length,

  parciales: demoReturns.filter(
    (loan) => loan.estadoDevolucion === "Parcial"
  ).length,

  completadas: demoReturns.filter(
    (loan) => loan.estadoDevolucion === "Completada"
  ).length,

  vencidas: demoReturns.filter(
    (loan) => loan.estadoDevolucion === "Vencida"
  ).length,
};
