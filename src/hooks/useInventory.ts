import { useCallback, useEffect, useRef, useState } from "react";

import {
  actualizarArticulo,
  actualizarCategoria,
  cambiarEstadoCategoria,
  crearArticulo,
  crearCategoria,
  fetchArticulos,
  fetchCategorias,
  fetchEstadisticasInventario,
  fetchUnidades,
  type ActualizarArticuloArgs,
  type CrearArticuloArgs,
} from "../services/inventory";
import type {
  ArticuloInventario,
  CategoriaInventario,
  EstadisticasInventario,
  UnidadInventario,
} from "../types/inventory";

export type InventoryStatus = "idle" | "loading" | "success" | "error";

export interface UseInventoryArticlesResult {
  data: ArticuloInventario[] | null;
  status: InventoryStatus;
  error: string | null;
  refetch: () => void;
}

export interface UseInventoryUnitsResult {
  data: UnidadInventario[] | null;
  status: InventoryStatus;
  error: string | null;
  refetch: () => void;
}

export interface UseInventoryCategoriesResult {
  data: CategoriaInventario[] | null;
  status: InventoryStatus;
  error: string | null;
  refetch: () => void;
}

export interface UseInventoryStatsResult {
  data: EstadisticasInventario | null;
  status: InventoryStatus;
  error: string | null;
  refetch: () => void;
}

function useAsyncResource<T>(
  fetcher: () => Promise<T>,
): [T | null, InventoryStatus, string | null, () => void] {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<InventoryStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    setStatus("loading");
    setError(null);

    try {
      const result = await fetcher();
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setData(result);
      setStatus("success");
    } catch (caught) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("error");
    }
  }, [fetcher]);

  useEffect(() => {
    isMountedRef.current = true;
    void load();
    return () => {
      isMountedRef.current = false;
    };
  }, [load]);

  return [data, status, error, load];
}

export function useInventoryArticles(): UseInventoryArticlesResult {
  const [data, status, error, refetch] = useAsyncResource(fetchArticulos);
  return { data, status, error, refetch };
}

export function useInventoryUnits(): UseInventoryUnitsResult {
  const [data, status, error, refetch] = useAsyncResource(fetchUnidades);
  return { data, status, error, refetch };
}

export function useInventoryCategories(): UseInventoryCategoriesResult {
  const [data, status, error, refetch] = useAsyncResource(fetchCategorias);
  return { data, status, error, refetch };
}

export function useInventoryStats(): UseInventoryStatsResult {
  const [data, status, error, refetch] = useAsyncResource(
    fetchEstadisticasInventario,
  );
  return { data, status, error, refetch };
}

// ---------------------------------------------------------------------------
// Escrituras de categorías
// ---------------------------------------------------------------------------

export interface UseInventoryCategoryMutationsResult {
  /** Hay una operación en curso; bloquea nuevos envíos. */
  saving: boolean;
  /** Último error devuelto por Rust (o por la capa de transporte). */
  error: string | null;
  clearError: () => void;
  crear: (nombre: string, descripcion: string | null) => Promise<boolean>;
  actualizar: (
    id: number,
    nombre: string,
    descripcion: string | null,
  ) => Promise<boolean>;
  cambiarEstado: (id: number, activo: boolean) => Promise<boolean>;
}

/**
 * Gestiona las tres escrituras de categorías con un único estado de guardado y
 * error, impidiendo envíos duplicados.
 *
 * No toca la lista: cada operación devuelve `true`/`false` para que la página
 * decida cuándo refrescar (nunca antes de que Rust confirme). Pensado para tres
 * operaciones, no para abstraer un CRUD completo.
 */
export function useInventoryCategoryMutations(): UseInventoryCategoryMutationsResult {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(
    async (operation: () => Promise<unknown>): Promise<boolean> => {
      if (inFlight.current) {
        return false;
      }
      inFlight.current = true;
      setSaving(true);
      setError(null);
      try {
        await operation();
        return true;
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : String(caught),
        );
        return false;
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [],
  );

  const crear = useCallback(
    (nombre: string, descripcion: string | null) =>
      run(() => crearCategoria({ nombre, descripcion })),
    [run],
  );

  const actualizar = useCallback(
    (id: number, nombre: string, descripcion: string | null) =>
      run(() => actualizarCategoria({ id, nombre, descripcion })),
    [run],
  );

  const cambiarEstado = useCallback(
    (id: number, activo: boolean) =>
      run(() => cambiarEstadoCategoria({ id, activo })),
    [run],
  );

  const clearError = useCallback(() => setError(null), []);

  return { saving, error, clearError, crear, actualizar, cambiarEstado };
}

// ---------------------------------------------------------------------------
// Escrituras de artículos
// ---------------------------------------------------------------------------

export interface UseInventoryArticleMutationsResult {
  /** Hay una operación en curso; bloquea nuevos envíos. */
  saving: boolean;
  /** Último error devuelto por Rust (o por la capa de transporte). */
  error: string | null;
  clearError: () => void;
  crear: (datos: CrearArticuloArgs) => Promise<boolean>;
  actualizar: (datos: ActualizarArticuloArgs) => Promise<boolean>;
}

/**
 * Gestiona el alta y la edición de artículos con un único estado de guardado y
 * error, impidiendo envíos duplicados. No toca la lista: cada operación devuelve
 * `true`/`false` para que la página refresque solo cuando Rust confirma.
 */
export function useInventoryArticleMutations(): UseInventoryArticleMutationsResult {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(
    async (operation: () => Promise<unknown>): Promise<boolean> => {
      if (inFlight.current) {
        return false;
      }
      inFlight.current = true;
      setSaving(true);
      setError(null);
      try {
        await operation();
        return true;
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : String(caught),
        );
        return false;
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [],
  );

  const crear = useCallback(
    (datos: CrearArticuloArgs) => run(() => crearArticulo(datos)),
    [run],
  );

  const actualizar = useCallback(
    (datos: ActualizarArticuloArgs) => run(() => actualizarArticulo(datos)),
    [run],
  );

  return { saving, error, clearError: () => setError(null), crear, actualizar };
}
