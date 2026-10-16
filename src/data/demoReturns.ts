import {
  demoLoans,
  type DemoLoan,
} from "./demoLoans";
import type {
  ReturnRecord,
  ReturnStatus,
  ReturnSummary,
} from "../types/returns";

// ========================================
// DERIVAR DEVOLUCIONES DE LOS PRÉSTAMOS
// ========================================

function getReturnStatus(
  loan: DemoLoan,
  total: number,
  devueltas: number,
  pendientes: number
): ReturnStatus {
  if (total > 0 && pendientes === 0) {
    return "Completada";
  }

  if (devueltas > 0) {
    return "Parcial";
  }

  if (loan.estado === "Vencido") {
    return "Vencida";
  }

  return "Pendiente";
}

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
    estadoDevolucion,
    pendientes,
    devueltas,
    total,
  };
}

/**
 * Deriva los totales de las tarjetas resumen a partir de un listado de
 * devoluciones ya construido. Separado de los datos de demostración para que la
 * misma lógica sirva cuando el listado venga de SQLite.
 */
export function summarizeReturns(
  records: ReturnRecord[]
): ReturnSummary {
  return {
    pendientes: records.filter(
      (loan) => loan.pendientes > 0
    ).length,

    parciales: records.filter(
      (loan) => loan.estadoDevolucion === "Parcial"
    ).length,

    completadas: records.filter(
      (loan) => loan.estadoDevolucion === "Completada"
    ).length,

    vencidas: records.filter(
      (loan) => loan.estadoDevolucion === "Vencida"
    ).length,
  };
}

export const demoReturns: ReturnRecord[] =
  demoLoans
    .filter((loan: DemoLoan) => loan.estado !== "Anulado")
    .map(createReturnRecord);
