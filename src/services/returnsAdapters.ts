// Adaptadores de Devoluciones (Etapa C).
//
// Traducen los DTO crudos que devuelve Rust (`src/types/returnsApi.ts`, en
// snake_case) a los modelos de presentación que consumirá la interfaz
// (`src/types/returns.ts`, en camelCase). Son funciones puras: no consultan
// nada ni tienen efectos.
//
// Reglas respetadas:
// - Estado de devolución (jerarquía de presentación, mutuamente excluyente):
//   1. `Completada`: el préstamo está `cerrado` (o ya no tiene pendientes).
//   2. `Parcial`: sigue `activo` con pendientes y con alguna devolución ya
//      registrada.
//   3. `Vencida`: sigue `activo`, vencido y con pendientes, sin devoluciones.
//   4. `Pendiente`: sigue `activo`, con pendientes y sin devoluciones.
//   `Parcial` tiene prioridad sobre `Vencida` (igual que el contrato de
//   demostración vigente): un préstamo vencido con devoluciones parciales se
//   muestra como `Parcial`, no como `Vencida`.
// - "Tiene devolución registrada" se deriva de las cantidades devueltas,
//   dañadas o perdidas del DTO (todas son 0 hasta que se registra una
//   devolución). El resumen de Rust no expone un contador de eventos.
// - No se inventan fechas, códigos, folios ni cantidades: se copian los valores
//   reales. `null` se conserva (`undefined` en los campos opcionales).
// - Identificadores: el id del préstamo, el del renglón (`prestamo_detalle.id`),
//   el del artículo y el de la unidad física se conservan cada uno en su campo;
//   no se confunden entre sí.

import { adaptLoan, adaptLoanStatus } from "./loansAdapters";
import type { PrestamoResumen } from "../types/loansApi";
import type {
  DetalleDevolucion,
  DevolucionHistorial,
  EstadisticasDevoluciones,
  LineaDevolucion,
  LineaDevolucionHistorial,
  PrestamoDevolucionResumen,
} from "../types/returnsApi";
import type {
  LoanItem,
  LoanUnitRef,
} from "../types/loans";
import type {
  ReturnHistoryEntry,
  ReturnHistoryItem,
  ReturnRecord,
  ReturnStatus,
  ReturnSummary,
} from "../types/returns";

/** Totales de un préstamo o evento que permiten inferir una devolución previa. */
interface ConCantidadesRegistradas {
  unidades_devueltas: number;
  unidades_daniadas: number;
  unidades_perdidas: number;
}

/**
 * `true` si ya hay alguna cantidad registrada (devuelta, dañada o perdida).
 *
 * Es la evidencia disponible en el resumen para saber que existe al menos una
 * devolución registrada; las cantidades permanecen en cero hasta entonces.
 */
export function tieneDevolucionRegistrada(
  dto: ConCantidadesRegistradas,
): boolean {
  return (
    dto.unidades_devueltas > 0 ||
    dto.unidades_daniadas > 0 ||
    dto.unidades_perdidas > 0
  );
}

/**
 * Estado de devolución de presentación.
 *
 * Jerarquía: `Completada` → `Parcial` → `Vencida` → `Pendiente`. Un estado de
 * préstamo distinto de `activo`/`cerrado` (por ejemplo `anulado`) no tiene
 * equivalente de devolución y es un error explícito.
 */
export function adaptReturnStatus(
  estado: string,
  vencido: boolean,
  pendientes: number,
  huboDevolucion: boolean,
): ReturnStatus {
  if (estado === "cerrado") {
    return "Completada";
  }

  if (estado === "activo") {
    if (pendientes <= 0) {
      return "Completada";
    }
    if (huboDevolucion) {
      return "Parcial";
    }
    if (vencido) {
      return "Vencida";
    }
    return "Pendiente";
  }

  throw new Error(
    `No se puede determinar el estado de devolución de un préstamo "${estado}".`,
  );
}

/** Renglón crudo → renglón de interfaz. */
export function adaptReturnItem(linea: LineaDevolucion): LoanItem {
  const unidadesDetalle: LoanUnitRef[] = linea.unidades.map((unidad) => ({
    id: unidad.id,
    codigo: unidad.codigo,
  }));

  return {
    id: String(linea.id),
    nombre: linea.articulo,
    cantidad: linea.cantidad_prestada,
    devueltas: linea.cantidad_devuelta,
    articuloId: linea.articulo_id,
    pendientes: linea.cantidad_pendiente,
    danadas: linea.cantidad_daniada,
    perdidas: linea.cantidad_perdida,
    estadoDetalle: linea.estado,
    unidades: unidadesDetalle.map((unidad) => unidad.codigo),
    unidadesDetalle,
  };
}

/** Campos comunes de `DemoLoan` que comparten resumen y detalle. */
function adaptReturnBase(
  dto: PrestamoDevolucionResumen | DetalleDevolucion,
): ReturnRecord {
  return {
    id: String(dto.id),
    folio: dto.folio,
    estudiante: dto.nombre_completo,
    codigoUniversitario: dto.codigo_universitario,
    fechaEntrega: dto.fecha_prestamo,
    fechaLimite: dto.fecha_limite,
    estado: adaptLoanStatus(dto.estado, dto.vencido),
    items: dto.lineas.map(adaptReturnItem),
    observacion: dto.comentario ?? undefined,
    estudianteId: dto.estudiante_id,
    renglones: dto.renglones,
    unidadesPrestadas: dto.unidades_prestadas,
    unidadesPendientes: dto.unidades_pendientes,
    estadoDevolucion: adaptReturnStatus(
      dto.estado,
      dto.vencido,
      dto.unidades_pendientes,
      tieneDevolucionRegistrada(dto),
    ),
    // Totales reales de Rust (no se recalculan a partir de los renglones).
    pendientes: dto.unidades_pendientes,
    devueltas: dto.unidades_devueltas,
    total: dto.unidades_prestadas,
  };
}

/** Fila del listado de devoluciones pendientes → préstamo de interfaz. */
export function adaptReturn(dto: PrestamoDevolucionResumen): ReturnRecord {
  return adaptReturnBase(dto);
}

/** Lista de devoluciones pendientes → filas de interfaz. */
export function adaptReturns(dtos: PrestamoDevolucionResumen[]): ReturnRecord[] {
  return dtos.map(adaptReturn);
}

/** Totales reales de las devoluciones registradas de un préstamo. */
export interface DevolucionesPrestamo {
  /** Unidades devueltas en buen estado. */
  devueltas: number;
  /** Unidades dañadas registradas. */
  danadas: number;
  /** Unidades perdidas registradas. */
  perdidas: number;
}

/**
 * Agrupa los eventos del historial por préstamo sumando sus cantidades reales.
 *
 * Sirve para completar los préstamos cerrados, cuyo resumen (de Préstamos) no
 * trae las unidades devueltas. Sin eventos registrados no se añade entrada, de
 * modo que una ausencia permanece como 0: nunca se inventan cantidades.
 */
export function agruparDevolucionesPorPrestamo(
  eventos: DevolucionHistorial[],
): Map<number, DevolucionesPrestamo> {
  const porPrestamo = new Map<number, DevolucionesPrestamo>();

  for (const evento of eventos) {
    const acumulado = porPrestamo.get(evento.prestamo_id) ?? {
      devueltas: 0,
      danadas: 0,
      perdidas: 0,
    };
    acumulado.devueltas += evento.cantidad_devuelta;
    acumulado.danadas += evento.cantidad_daniada;
    acumulado.perdidas += evento.cantidad_perdida;
    porPrestamo.set(evento.prestamo_id, acumulado);
  }

  return porPrestamo;
}

/**
 * Préstamo cerrado (`PrestamoResumen` de Préstamos) → registro de devolución.
 *
 * `listar_devoluciones_pendientes` solo devuelve préstamos activos, así que los
 * completados se toman de Préstamos (`estado === "cerrado"`) y se enriquecen con
 * las unidades devueltas reales del historial agregado. La lista de renglones
 * queda vacía: el detalle real lo aporta `useReturnDetails` al abrir el modal.
 */
export function adaptCompletedLoan(
  dto: PrestamoResumen,
  devoluciones?: DevolucionesPrestamo,
): ReturnRecord {
  const base = adaptLoan(dto);

  return {
    ...base,
    estadoDevolucion: adaptReturnStatus(
      dto.estado,
      dto.vencido,
      dto.unidades_pendientes,
      false,
    ),
    pendientes: dto.unidades_pendientes,
    devueltas: devoluciones?.devueltas ?? 0,
    total: dto.unidades_prestadas,
  };
}

/**
 * Detalle crudo → préstamo de interfaz.
 *
 * Añade `cerradoEn` y el indicador real `elegible` (solo lo aporta el detalle).
 */
export function adaptReturnDetail(dto: DetalleDevolucion): ReturnRecord {
  return {
    ...adaptReturnBase(dto),
    cerradoEn: dto.cerrado_en,
    elegible: dto.elegible,
  };
}

/** Estadísticas crudas → totales de las tarjetas resumen. */
export function adaptReturnStats(
  dto: EstadisticasDevoluciones,
): ReturnSummary {
  return {
    pendientes: dto.pendientes,
    parciales: dto.parciales,
    completadas: dto.completadas,
    vencidas: dto.vencidas,
  };
}

/** Renglón de un evento de devolución → renglón de interfaz. */
export function adaptReturnHistoryItem(
  linea: LineaDevolucionHistorial,
): ReturnHistoryItem {
  return {
    prestamoDetalleId: linea.prestamo_detalle_id,
    articuloId: linea.articulo_id,
    articulo: linea.articulo,
    devueltas: linea.cantidad_devuelta,
    danadas: linea.cantidad_daniada,
    perdidas: linea.cantidad_perdida,
    notas: linea.notas ?? undefined,
  };
}

/** Evento de devolución crudo → evento de interfaz. */
export function adaptReturnHistoryEntry(
  dto: DevolucionHistorial,
): ReturnHistoryEntry {
  return {
    id: dto.id,
    prestamoId: dto.prestamo_id,
    folio: dto.folio,
    estudiante: dto.nombre_completo,
    codigoUniversitario: dto.codigo_universitario,
    fechaDevolucion: dto.fecha_devolucion,
    observaciones: dto.observaciones ?? undefined,
    devueltas: dto.cantidad_devuelta,
    danadas: dto.cantidad_daniada,
    perdidas: dto.cantidad_perdida,
    items: dto.lineas.map(adaptReturnHistoryItem),
  };
}

/** Historial crudo → eventos de interfaz. */
export function adaptReturnHistory(
  dtos: DevolucionHistorial[],
): ReturnHistoryEntry[] {
  return dtos.map(adaptReturnHistoryEntry);
}
