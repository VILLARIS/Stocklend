// Servicio de Préstamos.
//
// Envuelve los comandos de Tauri: los tres de solo lectura (Etapa C) y el de
// registro (Etapa E2, `registrar_prestamo`). Devuelve los DTO crudos de Rust
// (`src/types/loansApi.ts`); la conversión a modelos de interfaz vive en
// `src/services/loansAdapters.ts`.
//
// Editar, anular o devolver préstamos pertenece a etapas posteriores; aquí solo
// se registra. Los errores reales se propagan; en ningún caso se sustituyen por
// datos de demostración.

import { invoke } from "@tauri-apps/api/core";

import type {
  EstadisticasPrestamos,
  PrestamoDetalle,
  PrestamoResumen,
} from "../types/loansApi";

export const LISTAR_PRESTAMOS_COMMAND = "listar_prestamos";
export const OBTENER_DETALLE_PRESTAMO_COMMAND = "obtener_detalle_prestamo";
export const OBTENER_ESTADISTICAS_PRESTAMOS_COMMAND =
  "obtener_estadisticas_prestamos";
export const REGISTRAR_PRESTAMO_COMMAND = "registrar_prestamo";

/**
 * Renglón de un préstamo a registrar.
 *
 * Un artículo de control individual se presta por unidades (`unidad_ids`); uno
 * sin control individual, por `cantidad`. Son mutuamente excluyentes, así lo
 * exige también el backend.
 */
export interface LineaPrestamoInput {
  articulo_id: number;
  cantidad?: number;
  unidad_ids?: number[];
}

/** Datos de entrada de `registrar_prestamo` (DTO snake_case de Rust). */
export interface RegistrarPrestamoArgs {
  estudiante_id: number;
  lineas: LineaPrestamoInput[];
  fecha_limite?: string | null;
  comentario?: string | null;
}

interface TauriInternals {
  invoke: (cmd: string, args?: unknown, options?: unknown) => Promise<unknown>;
}

type TauriWindow = Window & { __TAURI_INTERNALS__?: TauriInternals };

function getTauriInternals(): TauriInternals | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return (window as TauriWindow).__TAURI_INTERNALS__;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }
  try {
    const serialized = JSON.stringify(error);
    if (typeof serialized === "string" && serialized !== "undefined") {
      return serialized;
    }
  } catch {
    // ignored
  }
  return fallback;
}

function exigirTauri(): void {
  if (getTauriInternals() === undefined) {
    throw new Error(
      "No se pudo conectar con StockLend: la interfaz no se está ejecutando dentro de la aplicación Tauri.",
    );
  }
}

/** El detalle solo existe para un préstamo concreto. */
function exigirId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("No se indicó un préstamo válido.");
  }
}

/** Lista de préstamos (más reciente primero), con sus totales derivados. */
export async function fetchLoans(): Promise<PrestamoResumen[]> {
  exigirTauri();
  try {
    return await invoke<PrestamoResumen[]>(LISTAR_PRESTAMOS_COMMAND);
  } catch (error) {
    throw new Error(
      toErrorMessage(error, "No se pudo obtener la lista de préstamos."),
    );
  }
}

/**
 * Detalle de un préstamo, con sus renglones.
 *
 * Un `id` inexistente devuelve el error explícito de Rust; un `id` inválido se
 * rechaza antes de consultar.
 */
export async function fetchLoanDetails(id: number): Promise<PrestamoDetalle> {
  exigirId(id);
  exigirTauri();
  try {
    return await invoke<PrestamoDetalle>(OBTENER_DETALLE_PRESTAMO_COMMAND, {
      id,
    });
  } catch (error) {
    throw new Error(
      toErrorMessage(error, "No se pudo obtener el detalle del préstamo."),
    );
  }
}

/** Totales de las tarjetas resumen de Préstamos. */
export async function fetchLoanStats(): Promise<EstadisticasPrestamos> {
  exigirTauri();
  try {
    return await invoke<EstadisticasPrestamos>(
      OBTENER_ESTADISTICAS_PRESTAMOS_COMMAND,
    );
  } catch (error) {
    throw new Error(
      toErrorMessage(
        error,
        "No se pudieron obtener las estadísticas de préstamos.",
      ),
    );
  }
}

/**
 * Registra un préstamo.
 *
 * Un renglón con control individual se envía por `unidad_ids`; uno sin control
 * individual, por `cantidad`. La fecha de préstamo la fija el backend: el
 * formulario nunca la envía.
 */
export async function registerLoan(
  datos: RegistrarPrestamoArgs,
): Promise<PrestamoDetalle> {
  if (!Number.isInteger(datos.estudiante_id) || datos.estudiante_id <= 0) {
    throw new Error("No se indicó un estudiante válido.");
  }

  if (datos.lineas.length === 0) {
    throw new Error("El préstamo debe incluir al menos un artículo.");
  }

  for (const linea of datos.lineas) {
    if (!Number.isInteger(linea.articulo_id) || linea.articulo_id <= 0) {
      throw new Error("Hay un artículo sin identificar en el préstamo.");
    }

    const unidadIds = linea.unidad_ids ?? [];

    if (unidadIds.length > 0) {
      if (new Set(unidadIds).size !== unidadIds.length) {
        throw new Error("Una unidad aparece más de una vez en el préstamo.");
      }
      if (linea.cantidad !== undefined) {
        throw new Error(
          "Un artículo con control individual se presta por unidades, no por cantidad.",
        );
      }
      continue;
    }

    if (linea.cantidad === undefined || linea.cantidad <= 0) {
      throw new Error("La cantidad de cada artículo debe ser mayor que cero.");
    }
  }

  exigirTauri();
  try {
    return await invoke<PrestamoDetalle>(REGISTRAR_PRESTAMO_COMMAND, {
      datos,
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, "No se pudo registrar el préstamo."));
  }
}
