import { invoke } from "@tauri-apps/api/core";

import type {
  EstadisticasEstudiantes,
  EstudianteDirectorio,
  IncidenciaEstudiante,
  PrestamoHistorialEstudiante,
} from "../types/studentsApi";

export const LISTAR_ESTUDIANTES_COMMAND = "listar_estudiantes";
export const OBTENER_ESTADISTICAS_ESTUDIANTES_COMMAND =
  "obtener_estadisticas_estudiantes";
export const OBTENER_HISTORIAL_ESTUDIANTE_COMMAND =
  "obtener_historial_estudiante";
export const OBTENER_INCIDENCIAS_ESTUDIANTE_COMMAND =
  "obtener_incidencias_estudiante";

export const CREAR_ESTUDIANTE_COMMAND = "crear_estudiante";
export const ACTUALIZAR_ESTUDIANTE_COMMAND = "actualizar_estudiante";
export const CAMBIAR_ESTADO_ESTUDIANTE_COMMAND = "cambiar_estado_estudiante";

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

/** El historial y las incidencias solo existen para un estudiante concreto. */
function exigirId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("No se indicó un estudiante válido.");
  }
}

/** Directorio completo de estudiantes, activos e inactivos. */
export async function fetchStudents(): Promise<EstudianteDirectorio[]> {
  exigirTauri();
  try {
    return await invoke<EstudianteDirectorio[]>(LISTAR_ESTUDIANTES_COMMAND);
  } catch (error) {
    throw new Error(
      toErrorMessage(error, "No se pudo obtener el directorio de estudiantes."),
    );
  }
}

/** Totales de las tarjetas del directorio. */
export async function fetchStudentStats(): Promise<EstadisticasEstudiantes> {
  exigirTauri();
  try {
    return await invoke<EstadisticasEstudiantes>(
      OBTENER_ESTADISTICAS_ESTUDIANTES_COMMAND,
    );
  } catch (error) {
    throw new Error(
      toErrorMessage(
        error,
        "No se pudieron obtener las estadísticas de estudiantes.",
      ),
    );
  }
}

/**
 * Préstamos de un estudiante (más reciente primero).
 *
 * Un estudiante sin préstamos devuelve una lista vacía, no un error. Un `id`
 * inexistente sí lanza el mensaje de Rust.
 */
export async function fetchStudentHistory(
  id: number,
): Promise<PrestamoHistorialEstudiante[]> {
  exigirId(id);
  exigirTauri();
  try {
    return await invoke<PrestamoHistorialEstudiante[]>(
      OBTENER_HISTORIAL_ESTUDIANTE_COMMAND,
      { id },
    );
  } catch (error) {
    throw new Error(
      toErrorMessage(error, "No se pudo obtener el historial del estudiante."),
    );
  }
}

/**
 * Incidencias atribuidas a un estudiante (más reciente primero).
 *
 * Un estudiante sin incidencias devuelve una lista vacía, no un error.
 */
export async function fetchStudentIncidents(
  id: number,
): Promise<IncidenciaEstudiante[]> {
  exigirId(id);
  exigirTauri();
  try {
    return await invoke<IncidenciaEstudiante[]>(
      OBTENER_INCIDENCIAS_ESTUDIANTE_COMMAND,
      { id },
    );
  } catch (error) {
    throw new Error(
      toErrorMessage(
        error,
        "No se pudieron obtener las incidencias del estudiante.",
      ),
    );
  }
}

/** Datos para registrar un estudiante nuevo. */
export interface CrearEstudianteArgs {
  codigo_universitario: string;
  nombres: string;
  apellidos: string;
}

/** Datos para corregir un estudiante existente. */
export interface ActualizarEstudianteArgs {
  id: number;
  codigo_universitario: string;
  nombres: string;
  apellidos: string;
}

/** Datos para activar o desactivar un estudiante. */
export interface CambiarEstadoEstudianteArgs {
  id: number;
  activo: boolean;
}

function exigirTexto(valor: string, mensaje: string): string {
  const texto = valor.trim();
  if (texto === "") {
    throw new Error(mensaje);
  }
  return texto;
}

/** Registra un estudiante y devuelve su fila del directorio (RN-11, RN-12). */
export async function crearEstudiante(
  datos: CrearEstudianteArgs,
): Promise<EstudianteDirectorio> {
  exigirTauri();
  const codigo = exigirTexto(
    datos.codigo_universitario,
    "El código universitario es obligatorio.",
  );
  const nombres = datos.nombres.trim();
  const apellidos = datos.apellidos.trim();
  if (nombres === "") {
    throw new Error("Los nombres son obligatorios.");
  }
  if (apellidos === "") {
    throw new Error("Los apellidos son obligatorios.");
  }
  try {
    return await invoke<EstudianteDirectorio>(CREAR_ESTUDIANTE_COMMAND, {
      datos: {
        codigo_universitario: codigo,
        nombres,
        apellidos,
      },
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, "No se pudo registrar el estudiante."));
  }
}

/** Corrige los datos de un estudiante sin tocar su historial (RN-15). */
export async function actualizarEstudiante(
  datos: ActualizarEstudianteArgs,
): Promise<EstudianteDirectorio> {
  exigirId(datos.id);
  exigirTauri();
  const codigo = datos.codigo_universitario.trim();
  const nombres = datos.nombres.trim();
  const apellidos = datos.apellidos.trim();
  if (codigo === "") {
    throw new Error("El código universitario es obligatorio.");
  }
  if (nombres === "") {
    throw new Error("Los nombres son obligatorios.");
  }
  if (apellidos === "") {
    throw new Error("Los apellidos son obligatorios.");
  }
  try {
    return await invoke<EstudianteDirectorio>(ACTUALIZAR_ESTUDIANTE_COMMAND, {
      datos: {
        id: datos.id,
        codigo_universitario: codigo,
        nombres,
        apellidos,
      },
    });
  } catch (error) {
    throw new Error(
      toErrorMessage(error, "No se pudo actualizar el estudiante."),
    );
  }
}

/** Activa o desactiva un estudiante sin borrarlo (RN-14). */
export async function cambiarEstadoEstudiante(
  datos: CambiarEstadoEstudianteArgs,
): Promise<EstudianteDirectorio> {
  exigirId(datos.id);
  exigirTauri();
  try {
    return await invoke<EstudianteDirectorio>(CAMBIAR_ESTADO_ESTUDIANTE_COMMAND, {
      datos: { id: datos.id, activo: datos.activo },
    });
  } catch (error) {
    throw new Error(
      toErrorMessage(error, "No se pudo cambiar el estado del estudiante."),
    );
  }
}
