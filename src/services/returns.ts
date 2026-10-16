// Servicio de Devoluciones (Etapas C y E2).
//
// Envuelve los cuatro comandos de solo lectura de Devoluciones y el comando de
// escritura `registrar_devolucion` (Etapa E2), y devuelve los DTO crudos de Rust
// (`src/types/returnsApi.ts`); la conversión a modelos de interfaz vive en
// `src/services/returnsAdapters.ts`.
//
// La escritura (`registerReturn`) delega en el backend E1, que valida el
// préstamo, mueve el inventario, crea los incidentes de daño o pérdida y cierra
// el préstamo si corresponde dentro de una sola transacción. React no crea
// incidentes ni ajusta existencias por su cuenta. Los errores reales se
// propagan; en ningún caso se sustituyen por datos de demostración, ni se
// valida un préstamo sin un id válido antes de consultar.
//
// El manejo de errores replica el de los servicios existentes (`loans.ts`,
// `students.ts`): misma comprobación de ejecución dentro de Tauri y mismo
// `toErrorMessage`.

import { invoke } from "@tauri-apps/api/core";

import type {
  DetalleDevolucion,
  DevolucionHistorial,
  DevolucionRegistrada,
  EstadisticasDevoluciones,
  PrestamoDevolucionResumen,
  RegistrarDevolucionInput,
} from "../types/returnsApi";

export const LISTAR_DEVOLUCIONES_PENDIENTES_COMMAND =
  "listar_devoluciones_pendientes";
export const OBTENER_DETALLE_DEVOLUCION_COMMAND = "obtener_detalle_devolucion";
export const LISTAR_HISTORIAL_DEVOLUCIONES_COMMAND =
  "listar_historial_devoluciones";
export const OBTENER_ESTADISTICAS_DEVOLUCIONES_COMMAND =
  "obtener_estadisticas_devoluciones";
export const REGISTRAR_DEVOLUCION_COMMAND = "registrar_devolucion";

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

/** El detalle y el historial filtrado solo existen para un préstamo concreto. */
function exigirId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("No se indicó un préstamo válido.");
  }
}

/** Préstamos activos con cantidades pendientes de devolución. */
export async function fetchPendingReturns(): Promise<
  PrestamoDevolucionResumen[]
> {
  exigirTauri();
  try {
    return await invoke<PrestamoDevolucionResumen[]>(
      LISTAR_DEVOLUCIONES_PENDIENTES_COMMAND,
    );
  } catch (error) {
    throw new Error(
      toErrorMessage(
        error,
        "No se pudieron obtener las devoluciones pendientes.",
      ),
    );
  }
}

/**
 * Detalle de un préstamo para preparar una devolución.
 *
 * Un `id` inexistente devuelve el error explícito de Rust; un `id` inválido se
 * rechaza antes de consultar. El backend distingue el argumento `prestamo_id`.
 */
export async function fetchReturnDetails(
  prestamoId: number,
): Promise<DetalleDevolucion> {
  exigirId(prestamoId);
  exigirTauri();
  try {
    return await invoke<DetalleDevolucion>(
      OBTENER_DETALLE_DEVOLUCION_COMMAND,
      { prestamo_id: prestamoId },
    );
  } catch (error) {
    throw new Error(
      toErrorMessage(error, "No se pudo obtener el detalle del préstamo."),
    );
  }
}

/**
 * Devoluciones ya registradas, opcionalmente filtradas por préstamo.
 *
 * Sin `prestamoId` se listan todas; con un `prestamoId` inválido se rechaza
 * antes de consultar. Se envía siempre `prestamo_id` (con `null` cuando no hay
 * filtro) para respetar el argumento real del comando.
 */
export async function fetchReturnHistory(
  prestamoId?: number,
): Promise<DevolucionHistorial[]> {
  if (prestamoId !== undefined) {
    exigirId(prestamoId);
  }
  exigirTauri();
  try {
    return await invoke<DevolucionHistorial[]>(
      LISTAR_HISTORIAL_DEVOLUCIONES_COMMAND,
      { prestamo_id: prestamoId ?? null },
    );
  } catch (error) {
    throw new Error(
      toErrorMessage(error, "No se pudo obtener el historial de devoluciones."),
    );
  }
}

/** Tarjetas resumen de Devoluciones. */
export async function fetchReturnStats(): Promise<EstadisticasDevoluciones> {
  exigirTauri();
  try {
    return await invoke<EstadisticasDevoluciones>(
      OBTENER_ESTADISTICAS_DEVOLUCIONES_COMMAND,
    );
  } catch (error) {
    throw new Error(
      toErrorMessage(
        error,
        "No se pudieron obtener las estadísticas de devoluciones.",
      ),
    );
  }
}

function esEnteroPositivo(valor: number): boolean {
  return Number.isInteger(valor) && valor > 0;
}

/**
 * Comprueba la forma del `datos` antes de llamar a Rust.
 *
 * Es una comprobación de cordura: el backend E1 sigue siendo la autoridad y
 * vuelve a validar préstamo, cantidades, unidades y descripción dentro de la
 * transacción. Aquí solo se evitan envíos evidentemente inválidos (sin
 * préstamo, sin renglones, con cantidades negativas o unidades duplicadas) para
 * dar un mensaje claro sin llegar a Tauri.
 */
function validarEntrada(datos: RegistrarDevolucionInput): void {
  if (!Number.isInteger(datos.prestamo_id) || datos.prestamo_id <= 0) {
    throw new Error("No se indicó un préstamo válido.");
  }
  if (datos.lineas.length === 0) {
    throw new Error("La devolución debe incluir al menos un artículo.");
  }

  let totalPositivo = 0;
  let requiereDescripcion = false;

  for (const linea of datos.lineas) {
    if (!esEnteroPositivo(linea.prestamo_detalle_id)) {
      throw new Error("Hay un renglón sin identificar en la devolución.");
    }

    const cantidades = [
      linea.cantidad_devuelta ?? 0,
      linea.cantidad_daniada ?? 0,
      linea.cantidad_perdida ?? 0,
    ];
    if (cantidades.some((valor) => !Number.isInteger(valor) || valor < 0)) {
      throw new Error("Las cantidades de la devolución no pueden ser negativas.");
    }
    const sumaLinea = cantidades.reduce((total, valor) => total + valor, 0);
    requiereDescripcion ||= cantidades[1] > 0 || cantidades[2] > 0;

    const unidades = linea.unidades ?? [];
    if (unidades.length > 0) {
      if (sumaLinea !== 0) {
        throw new Error(
          "Un artículo con control individual se devuelve por unidades, no por cantidad.",
        );
      }
      const ids = new Set<number>();
      for (const unidad of unidades) {
        if (!esEnteroPositivo(unidad.unidad_id)) {
          throw new Error("Hay una unidad sin identificar en la devolución.");
        }
        if (ids.has(unidad.unidad_id)) {
          throw new Error("Una unidad aparece más de una vez en la devolución.");
        }
        ids.add(unidad.unidad_id);
        if (
          unidad.condicion !== "bueno" &&
          unidad.condicion !== "danado" &&
          unidad.condicion !== "perdido"
        ) {
          throw new Error("Una unidad tiene una condición no válida.");
        }
        if (unidad.condicion === "danado" || unidad.condicion === "perdido") {
          requiereDescripcion = true;
        }
      }
      totalPositivo += unidades.length;
    } else {
      totalPositivo += sumaLinea;
    }
  }

  if (totalPositivo <= 0) {
    throw new Error(
      "Indica al menos una unidad en buen estado, dañada o perdida.",
    );
  }

  const descripcion = datos.lineas
    .map((linea) => linea.descripcion?.trim() ?? "")
    .join("");
  if (requiereDescripcion && descripcion.trim() === "") {
    throw new Error(
      "Registrar un daño o una pérdida exige una descripción del incidente.",
    );
  }
}

/**
 * Registra una devolución (completa o parcial) mediante el comando real.
 *
 * El argumento `datos` coincide con `RegistrarDevolucionInput`. La fecha de
 * devolución la fija el backend a partir del reloj de SQLite; la interfaz nunca
 * la envía. Los incidentes de daño o pérdida y el ajuste de inventario los
 * crea el backend dentro de la misma transacción: no se realizan llamadas
 * adicionales desde React.
 */
export async function registerReturn(
  datos: RegistrarDevolucionInput,
): Promise<DevolucionRegistrada> {
  validarEntrada(datos);
  exigirTauri();
  try {
    return await invoke<DevolucionRegistrada>(REGISTRAR_DEVOLUCION_COMMAND, {
      datos,
    });
  } catch (error) {
    throw new Error(
      toErrorMessage(error, "No se pudo registrar la devolución."),
    );
  }
}
