import { invoke } from "@tauri-apps/api/core";

import type {
  ArticuloInventario,
  CategoriaInventario,
  EstadisticasInventario,
  UnidadInventario,
} from "../types/inventory";

export const LISTAR_ARTICULOS_COMMAND = "listar_articulos";
export const LISTAR_UNIDADES_COMMAND = "listar_unidades";
export const LISTAR_CATEGORIAS_COMMAND = "listar_categorias";
export const OBTENER_ESTADISTICAS_INVENTARIO_COMMAND =
  "obtener_estadisticas_inventario";

export const CREAR_CATEGORIA_COMMAND = "crear_categoria";
export const ACTUALIZAR_CATEGORIA_COMMAND = "actualizar_categoria";
export const CAMBIAR_ESTADO_CATEGORIA_COMMAND = "cambiar_estado_categoria";

export const CREAR_ARTICULO_COMMAND = "crear_articulo";
export const ACTUALIZAR_ARTICULO_COMMAND = "actualizar_articulo";

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
    // ignored
  }
  return "Error desconocido al comunicarse con el backend.";
}

export async function fetchArticulos(): Promise<ArticuloInventario[]> {
  if (getTauriInternals() === undefined) {
    throw new Error(
      "No se pudo conectar con StockLend: la interfaz no se está ejecutando dentro de la aplicación Tauri.",
    );
  }
  try {
    return await invoke<ArticuloInventario[]>(LISTAR_ARTICULOS_COMMAND);
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export async function fetchUnidades(): Promise<UnidadInventario[]> {
  if (getTauriInternals() === undefined) {
    throw new Error(
      "No se pudo conectar con StockLend: la interfaz no se está ejecutando dentro de la aplicación Tauri.",
    );
  }
  try {
    return await invoke<UnidadInventario[]>(LISTAR_UNIDADES_COMMAND);
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export async function fetchCategorias(): Promise<CategoriaInventario[]> {
  if (getTauriInternals() === undefined) {
    throw new Error(
      "No se pudo conectar con StockLend: la interfaz no se está ejecutando dentro de la aplicación Tauri.",
    );
  }
  try {
    return await invoke<CategoriaInventario[]>(LISTAR_CATEGORIAS_COMMAND);
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export async function fetchEstadisticasInventario(): Promise<EstadisticasInventario> {
  if (getTauriInternals() === undefined) {
    throw new Error(
      "No se pudo conectar con StockLend: la interfaz no se está ejecutando dentro de la aplicación Tauri.",
    );
  }
  try {
    return await invoke<EstadisticasInventario>(
      OBTENER_ESTADISTICAS_INVENTARIO_COMMAND,
    );
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

// ---------------------------------------------------------------------------
// Categorías (escrituras). Todas reciben un objeto `datos` con el contrato
// exacto del backend Rust y devuelven la fila resultante (CategoriaInventario).
// ---------------------------------------------------------------------------

/** Argumento del comando `crear_categoria`. */
export interface CrearCategoriaArgs {
  nombre: string;
  descripcion: string | null;
}

/** Argumento del comando `actualizar_categoria`. */
export interface ActualizarCategoriaArgs {
  id: number;
  nombre: string;
  descripcion: string | null;
}

/** Argumento del comando `cambiar_estado_categoria`. */
export interface CambiarEstadoCategoriaArgs {
  id: number;
  activo: boolean;
}

/** Crea una categoría y devuelve la fila persistida por SQLite. */
export async function crearCategoria(
  datos: CrearCategoriaArgs,
): Promise<CategoriaInventario> {
  return invocarEscrituraCategoria(
    CREAR_CATEGORIA_COMMAND,
    datos,
    "No se pudo crear la categoría.",
  );
}

/** Edita nombre y descripción de una categoría existente. */
export async function actualizarCategoria(
  datos: ActualizarCategoriaArgs,
): Promise<CategoriaInventario> {
  return invocarEscrituraCategoria(
    ACTUALIZAR_CATEGORIA_COMMAND,
    datos,
    "No se pudo actualizar la categoría.",
  );
}

/** Activa (`true`) o desactiva (`false`) una categoría sin borrarla. */
export async function cambiarEstadoCategoria(
  datos: CambiarEstadoCategoriaArgs,
): Promise<CategoriaInventario> {
  return invocarEscrituraCategoria(
    CAMBIAR_ESTADO_CATEGORIA_COMMAND,
    datos,
    "No se pudo cambiar el estado de la categoría.",
  );
}

/**
 * Envía una escritura de categoría al backend y normaliza los errores.
 *
 * El mensaje devuelto por Rust (por ejemplo, nombre duplicado) se conserva tal
 * cual; solo se usa `fallback` si el error llega vacío.
 */
async function invocarEscrituraCategoria(
  comando: string,
  datos: CrearCategoriaArgs | ActualizarCategoriaArgs | CambiarEstadoCategoriaArgs,
  fallback: string,
): Promise<CategoriaInventario> {
  if (getTauriInternals() === undefined) {
    throw new Error(
      "No se pudo conectar con StockLend: la interfaz no se está ejecutando dentro de la aplicación Tauri.",
    );
  }
  try {
    return await invoke<CategoriaInventario>(comando, { datos });
  } catch (error) {
    const message = toErrorMessage(error);
    throw new Error(message === "" ? fallback : message);
  }
}

// ---------------------------------------------------------------------------
// Artículos (escrituras). Mismo contrato `datos` que el backend Rust y misma
// normalización de errores que las categorías.
// ---------------------------------------------------------------------------

/** Unidad individual enviada al crear un artículo con control individual. */
export interface UnidadNuevaArgs {
  codigo: string;
  descripcion: string | null;
}

/** Argumento del comando `crear_articulo`. */
export interface CrearArticuloArgs {
  nombre: string;
  categoria_id: number;
  cantidad_inicial: number;
  control_individual: boolean;
  prestable: boolean;
  notas: string | null;
  unidades: UnidadNuevaArgs[];
}

/** Argumento del comando `actualizar_articulo`. */
export interface ActualizarArticuloArgs {
  id: number;
  nombre: string;
  categoria_id: number;
  prestable: boolean;
  notas: string | null;
}

/** Crea un artículo y devuelve la fila persistida por SQLite. */
export async function crearArticulo(
  datos: CrearArticuloArgs,
): Promise<ArticuloInventario> {
  return invocarEscrituraArticulo(
    CREAR_ARTICULO_COMMAND,
    datos,
    "No se pudo crear el artículo.",
  );
}

/** Edita nombre, categoría, `prestable` y notas de un artículo existente. */
export async function actualizarArticulo(
  datos: ActualizarArticuloArgs,
): Promise<ArticuloInventario> {
  return invocarEscrituraArticulo(
    ACTUALIZAR_ARTICULO_COMMAND,
    datos,
    "No se pudo actualizar el artículo.",
  );
}

/**
 * Envía una escritura de artículo al backend y normaliza los errores.
 *
 * El mensaje devuelto por Rust (nombre duplicado, categoría desactivada, etc.)
 * se conserva tal cual; solo se usa `fallback` si el error llega vacío.
 */
async function invocarEscrituraArticulo(
  comando: string,
  datos: CrearArticuloArgs | ActualizarArticuloArgs,
  fallback: string,
): Promise<ArticuloInventario> {
  if (getTauriInternals() === undefined) {
    throw new Error(
      "No se pudo conectar con StockLend: la interfaz no se está ejecutando dentro de la aplicación Tauri.",
    );
  }
  try {
    return await invoke<ArticuloInventario>(comando, { datos });
  } catch (error) {
    const message = toErrorMessage(error);
    throw new Error(message === "" ? fallback : message);
  }
}
