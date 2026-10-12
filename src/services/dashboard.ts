// Servicio del Panel: única capa que habla con Rust vía IPC.
//
// Solo lectura. No usa datos de demostración, no escribe en SQLite y no
// inventa información: si el comando falla, el error se propaga.

import { invoke } from "@tauri-apps/api/core";

import type { DashboardPanel } from "../types/dashboard";

/** Nombre exacto del comando registrado en Rust (`obtener_panel`). */
export const DASHBOARD_COMMAND = "obtener_panel";

/** Forma mínima del puente IPC inyectado por Tauri en el WebView. */
interface TauriInternals {
  invoke: (cmd: string, args?: unknown, options?: unknown) => Promise<unknown>;
}

type TauriWindow = Window & { __TAURI_INTERNALS__?: TauriInternals };

/**
 * Devuelve el puente IPC de Tauri si existe. Permite detectar si la interfaz
 * se ejecuta dentro de la aplicación (y no, por ejemplo, en un navegador).
 */
function getTauriInternals(): TauriInternals | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return (window as TauriWindow).__TAURI_INTERNALS__;
}

/** Convierte un error desconocido (string de Rust, `Error`, etc.) en mensaje. */
function toErrorMessage(error: unknown): string {
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
    // Se ignora y se usa el mensaje genérico.
  }
  return "No se pudo obtener la información del panel.";
}

/**
 * Obtiene todos los datos del Dashboard en una sola llamada IPC al comando
 * `obtener_panel`.
 *
 * Una base válida pero sin registros resuelve correctamente con contadores en
 * cero; solo un fallo real de conexión o del comando rechaza la promesa.
 */
export async function fetchDashboard(): Promise<DashboardPanel> {
  if (getTauriInternals() === undefined) {
    throw new Error(
      "No se pudo conectar con StockLend: la interfaz no se está ejecutando dentro de la aplicación Tauri.",
    );
  }

  try {
    return await invoke<DashboardPanel>(DASHBOARD_COMMAND);
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}
