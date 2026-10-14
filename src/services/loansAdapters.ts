// Adaptadores de Préstamos (Etapa C).
//
// Traducen los DTO crudos que devuelve Rust (`src/types/loansApi.ts`, en
// snake_case) a los modelos de presentación que consume la interfaz
// (`src/types/loans.ts`, en camelCase).
//
// Reglas respetadas:
// - El estado almacenado en la base es `activo | cerrado | anulado`. La vista
//   usa `Activo`, `Finalizado` (= cerrado), `Anulado` y `Vencido` (= activo con
//   vencimiento pasado). Un préstamo cerrado o anulado NUNCA es `Vencido`.
// - No se inventan fechas, códigos, folios ni cantidades: se copian los valores
//   reales. Un `fecha_limite` nulo se conserva como `null`.
// - Se conservan los identificadores reales de préstamo, estudiante y artículo.
// - La lista no trae renglones; el detalle sí. Por eso las filas del listado
//   llevan `items` vacío y sus totales viajan en `renglones`,
//   `unidadesPrestadas` y `unidadesPendientes`.

import type {
  EstadisticasPrestamos,
  PrestamoDetalle,
  PrestamoLinea,
  PrestamoResumen,
} from "../types/loansApi";
import type { DemoLoan, LoanItem, LoanStatus, LoanSummary } from "../types/loans";

/**
 * Normaliza el estado real a la etiqueta de la vista.
 *
 * `vencido` solo aplica a préstamos activos; para `cerrado` y `anulado` se
 * ignora por completo.
 */
export function adaptLoanStatus(estado: string, vencido: boolean): LoanStatus {
  if (estado === "activo") {
    return vencido ? "Vencido" : "Activo";
  }
  if (estado === "cerrado") {
    return "Finalizado";
  }
  if (estado === "anulado") {
    return "Anulado";
  }
  throw new Error(`Estado de préstamo desconocido: "${estado}".`);
}

/** Renglón crudo → renglón de interfaz. */
export function adaptLoanItem(linea: PrestamoLinea): LoanItem {
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
    unidades: linea.unidades,
  };
}

/**
 * Fila del listado → préstamo de interfaz.
 *
 * El comando de listado no trae los renglones, por lo que `items` queda vacío;
 * los totales reales viajan en `renglones`, `unidadesPrestadas` y
 * `unidadesPendientes`. Para el detalle completo usar `adaptLoanDetail`.
 */
export function adaptLoan(dto: PrestamoResumen): DemoLoan {
  return {
    id: String(dto.id),
    folio: dto.folio,
    estudiante: dto.nombre_completo,
    codigoUniversitario: dto.codigo_universitario,
    fechaEntrega: dto.fecha_prestamo,
    fechaLimite: dto.fecha_limite,
    estado: adaptLoanStatus(dto.estado, dto.vencido),
    items: [],
    observacion: dto.comentario ?? undefined,
    estudianteId: dto.estudiante_id,
    cerradoEn: dto.cerrado_en,
    renglones: dto.renglones,
    unidadesPrestadas: dto.unidades_prestadas,
    unidadesPendientes: dto.unidades_pendientes,
  };
}

/** Lista de préstamos → filas de interfaz. */
export function adaptLoans(dtos: PrestamoResumen[]): DemoLoan[] {
  return dtos.map(adaptLoan);
}

/** Detalle crudo → préstamo de interfaz con sus renglones reales. */
export function adaptLoanDetail(dto: PrestamoDetalle): DemoLoan {
  return {
    id: String(dto.id),
    folio: dto.folio,
    estudiante: dto.nombre_completo,
    codigoUniversitario: dto.codigo_universitario,
    fechaEntrega: dto.fecha_prestamo,
    fechaLimite: dto.fecha_limite,
    estado: adaptLoanStatus(dto.estado, dto.vencido),
    items: dto.lineas.map(adaptLoanItem),
    observacion: dto.comentario ?? undefined,
    estudianteId: dto.estudiante_id,
    cerradoEn: dto.cerrado_en,
    renglones: dto.renglones,
    unidadesPrestadas: dto.unidades_prestadas,
    unidadesPendientes: dto.unidades_pendientes,
  };
}

/** Estadísticas crudas → totales de las tarjetas resumen. */
export function adaptLoanStats(dto: EstadisticasPrestamos): LoanSummary {
  return {
    total: dto.total,
    activos: dto.activos,
    finalizados: dto.finalizados,
    vencidos: dto.vencidos,
    anulados: dto.anulados,
    unidadesPendientes: dto.unidades_pendientes,
  };
}
