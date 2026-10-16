// Contrato de tipos del módulo de Devoluciones.
//
// Se separan de los datos de demostración (`src/data/demoReturns.ts`) para que,
// cuando la información venga de SQLite, solo cambie la fuente de datos y no las
// formas que consume la UI. `ReturnRecord` amplía el préstamo de presentación
// (`DemoLoan`) con los totales derivados que la vista de devoluciones necesita.
//
// Nota (Etapa A): "Pendiente", "Parcial", "Completada" y "Vencida" son etiquetas
// derivadas de la vista; no se almacenan en la base (ver `docs/DATABASE_DESIGN.md`
// §4.6/§4.7 y las reglas RN-35, RN-36, RN-25).

import type { DemoLoan } from "./loans";

/** Estado de devolución mostrado en la tabla y en el detalle. */
export type ReturnStatus =
  | "Pendiente"
  | "Parcial"
  | "Completada"
  | "Vencida";

/** Préstamo con sus totales de devolución derivados. */
export interface ReturnRecord extends DemoLoan {
  estadoDevolucion: ReturnStatus;
  /** Unidades aún por devolver (`total - devueltas`). */
  pendientes: number;
  /** Unidades devueltas en buen estado. */
  devueltas: number;
  /** Unidades totales entregadas (Σ `cantidad` de cada renglón). */
  total: number;
  /**
   * Solo lo aporta el detalle: `true` si el préstamo está activo y aún tiene
   * pendientes (única situación para registrar una devolución nueva).
   */
  elegible?: boolean;
}

/** Renglón de una devolución ya registrada (evento del historial). */
export interface ReturnHistoryItem {
  /** `prestamo_detalle.id` del renglón devuelto. */
  prestamoDetalleId: number;
  articuloId: number;
  articulo: string;
  /** Unidades devueltas en buen estado. */
  devueltas: number;
  /** Unidades dañadas registradas. */
  danadas: number;
  /** Unidades perdidas registradas. */
  perdidas: number;
  notas?: string;
}

/** Evento de devolución ya registrado (una devolución puede aportar varios). */
export interface ReturnHistoryEntry {
  /** `devolucion.id`. */
  id: number;
  prestamoId: number;
  folio: string;
  estudiante: string;
  codigoUniversitario: string;
  /** Fecha y hora del registro, copiada de la base (nunca inventada). */
  fechaDevolucion: string;
  observaciones?: string;
  /** Totales del evento, sumados por Rust (no se recalculan aquí). */
  devueltas: number;
  danadas: number;
  perdidas: number;
  items: ReturnHistoryItem[];
}

/** Totales de las tarjetas resumen de Devoluciones. */
export interface ReturnSummary {
  /** Préstamos con unidades pendientes. */
  pendientes: number;
  /** Préstamos con devoluciones parciales. */
  parciales: number;
  /** Préstamos completamente devueltos. */
  completadas: number;
  /** Préstamos vencidos con unidades pendientes. */
  vencidas: number;
}
