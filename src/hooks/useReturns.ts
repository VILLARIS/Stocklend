// Hooks de Devoluciones (Etapa C).
//
// Envuelven los servicios de lectura (`src/services/returns.ts`) con el mismo
// patrón que `useLoans.ts` y `useStudents.ts`: datos, estado de carga, error y
// `refetch`. Devuelven los DTO crudos de Rust; la conversión a modelos de
// presentación vive en `src/services/returnsAdapters.ts` y la aplica la página.
//
// `requestIdRef` invalida las respuestas de peticiones antiguas cuando cambia el
// préstamo seleccionado, de modo que nunca se muestra el detalle o el historial
// de un préstamo ya reemplazado. `isMountedRef` evita escribir estado tras el
// desmontaje (compatible con StrictMode).
//
// El detalle no se consulta sin un identificador válido: queda en `idle`.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchPendingReturns,
  fetchReturnDetails,
  fetchReturnHistory,
  fetchReturnStats,
  registerReturn,
} from "../services/returns";
import type {
  DevolucionHistorial,
  DevolucionRegistrada,
  DetalleDevolucion,
  EstadisticasDevoluciones,
  PrestamoDevolucionResumen,
  RegistrarDevolucionInput,
} from "../types/returnsApi";

export type ReturnsStatus = "idle" | "loading" | "success" | "error";

export interface UsePendingReturnsResult {
  data: PrestamoDevolucionResumen[] | null;
  status: ReturnsStatus;
  error: string | null;
  refetch: () => void;
}

export interface UseReturnDetailsResult {
  data: DetalleDevolucion | null;
  status: ReturnsStatus;
  error: string | null;
  refetch: () => void;
}

export interface UseReturnHistoryResult {
  data: DevolucionHistorial[] | null;
  status: ReturnsStatus;
  error: string | null;
  refetch: () => void;
}

export interface UseReturnStatsResult {
  data: EstadisticasDevoluciones | null;
  status: ReturnsStatus;
  error: string | null;
  refetch: () => void;
}

/**
 * Recurso asíncrono con descarte de respuestas obsoletas.
 *
 * Con `enabled: false` no se consulta nada: el recurso queda en `idle`, sin
 * datos ni error, y cualquier petición en vuelo se descarta.
 */
function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  enabled: boolean,
): [T | null, ReturnsStatus, string | null, () => void] {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<ReturnsStatus>(
    enabled ? "loading" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) {
      return;
    }
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    setError(null);
    setStatus("loading");

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
  }, [enabled, fetcher]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) {
      requestIdRef.current += 1;
      setData(null);
      setError(null);
      setStatus("idle");
      return () => {
        isMountedRef.current = false;
      };
    }

    // Limpia el resultado anterior antes de consultar: al cambiar de préstamo
    // no se muestra el detalle del préstamo previo.
    setData(null);
    void load();

    return () => {
      isMountedRef.current = false;
    };
  }, [enabled, load]);

  return [data, status, error, load];
}

/** Listado de préstamos con devoluciones pendientes. */
export function usePendingReturns(): UsePendingReturnsResult {
  const [data, status, error, refetch] = useAsyncResource(
    fetchPendingReturns,
    true,
  );
  return { data, status, error, refetch };
}

/** Totales de las tarjetas resumen de Devoluciones. */
export function useReturnStats(): UseReturnStatsResult {
  const [data, status, error, refetch] = useAsyncResource(
    fetchReturnStats,
    true,
  );
  return { data, status, error, refetch };
}

/**
 * Detalle de un préstamo, con sus renglones.
 *
 * Sin un identificador válido no se consulta nada y el recurso queda en `idle`.
 */
export function useReturnDetails(
  prestamoId: number | null,
): UseReturnDetailsResult {
  const enabled =
    prestamoId !== null && Number.isInteger(prestamoId) && prestamoId > 0;
  const fetcher = useCallback(() => {
    if (prestamoId === null || !Number.isInteger(prestamoId) || prestamoId <= 0) {
      return Promise.reject(new Error("No se indicó un préstamo válido."));
    }
    return fetchReturnDetails(prestamoId);
  }, [prestamoId]);
  const [data, status, error, refetch] = useAsyncResource(fetcher, enabled);
  return { data, status, error, refetch };
}

/**
 * Historial de devoluciones, opcionalmente filtrado por préstamo.
 *
 * Sin `prestamoId` devuelve todas las devoluciones; con un identificador
 * inválido no se consulta nada. Cambiar el préstamo descarta la respuesta
 * anterior.
 */
export function useReturnHistory(
  prestamoId?: number | null,
): UseReturnHistoryResult {
  const filtro = prestamoId ?? null;
  const valido = filtro === null || (Number.isInteger(filtro) && filtro > 0);
  const fetcher = useCallback(() => {
    if (!valido) {
      return Promise.reject(new Error("No se indicó un préstamo válido."));
    }
    return fetchReturnHistory(filtro ?? undefined);
  }, [valido, filtro]);
  const [data, status, error, refetch] = useAsyncResource(fetcher, true);
  return { data, status, error, refetch };
}

export interface UseReturnMutationsResult {
  saving: boolean;
  error: string | null;
  clearError: () => void;
  /**
   * Registra una devolución. Devuelve el evento creado (con su id real y el
   * estado resultante del préstamo) o `null` si falló, dejando el mensaje real
   * en `error`.
   */
  registrar: (
    datos: RegistrarDevolucionInput,
  ) => Promise<DevolucionRegistrada | null>;
}

/**
 * Escrituras de devoluciones (`registrar_devolucion`).
 *
 * Igual que `useLoanMutations`: una sola operación en vuelo (evita dobles
 * clics), `saving` mientras SQLite confirma la transacción y el error real del
 * backend en `error`. En ningún caso se ajusta el estado local por adelantado:
 * los datos se recargan desde SQLite tras el éxito.
 */
export function useReturnMutations(): UseReturnMutationsResult {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const registrar = useCallback(
    async (
      datos: RegistrarDevolucionInput,
    ): Promise<DevolucionRegistrada | null> => {
      if (inFlight.current) {
        return null;
      }

      inFlight.current = true;
      setSaving(true);
      setError(null);

      try {
        return await registerReturn(datos);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
        return null;
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return { saving, error, clearError, registrar };
}
