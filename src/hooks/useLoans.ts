// Hooks de Préstamos.
//
// La lectura sigue el patrón de `src/hooks/useStudents.ts`: un recurso asíncrono
// con descarte de respuestas obsoletas y estado de carga explícito. La escritura
// (registrar préstamo, Etapa E2) vive en `useLoanMutations`.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchLoanDetails,
  fetchLoans,
  fetchLoanStats,
  registerLoan,
  type RegistrarPrestamoArgs,
} from "../services/loans";
import type {
  EstadisticasPrestamos,
  PrestamoDetalle,
  PrestamoResumen,
} from "../types/loansApi";

export type LoansStatus = "idle" | "loading" | "success" | "error";

export interface UseLoansDirectoryResult {
  data: PrestamoResumen[] | null;
  status: LoansStatus;
  error: string | null;
  refetch: () => void;
}

export interface UseLoanStatsResult {
  data: EstadisticasPrestamos | null;
  status: LoansStatus;
  error: string | null;
  refetch: () => void;
}

export interface UseLoanDetailsResult {
  data: PrestamoDetalle | null;
  status: LoansStatus;
  error: string | null;
  refetch: () => void;
}

/**
 * Recurso asíncrono con descarte de respuestas obsoletas.
 *
 * `requestIdRef` invalida las respuestas de peticiones antiguas cuando cambia la
 * dependencia (por ejemplo, al cambiar de préstamo), de modo que nunca se
 * muestra el detalle de un préstamo ya reemplazado. `isMountedRef` evita
 * escribir estado tras el desmontaje (compatible con StrictMode).
 *
 * Con `enabled: false` no se consulta nada: el recurso queda en `idle`, sin
 * datos ni error, y cualquier petición en vuelo se descarta.
 */
function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  enabled: boolean,
): [T | null, LoansStatus, string | null, () => void] {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<LoansStatus>(
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

/** Listado de préstamos. */
export function useLoansDirectory(): UseLoansDirectoryResult {
  const [data, status, error, refetch] = useAsyncResource(fetchLoans, true);
  return { data, status, error, refetch };
}

/** Totales de las tarjetas resumen de Préstamos. */
export function useLoanStats(): UseLoanStatsResult {
  const [data, status, error, refetch] = useAsyncResource(fetchLoanStats, true);
  return { data, status, error, refetch };
}

/**
 * Detalle de un préstamo, con sus renglones.
 *
 * Sin un identificador válido no se consulta nada y el recurso queda en `idle`.
 */
export function useLoanDetails(id: number | null): UseLoanDetailsResult {
  const enabled = id !== null && Number.isInteger(id) && id > 0;
  const fetcher = useCallback(() => {
    if (id === null || !Number.isInteger(id) || id <= 0) {
      return Promise.reject(new Error("No se indicó un préstamo válido."));
    }
    return fetchLoanDetails(id);
  }, [id]);
  const [data, status, error, refetch] = useAsyncResource(fetcher, enabled);
  return { data, status, error, refetch };
}

export interface UseLoanMutationsResult {
  saving: boolean;
  error: string | null;
  clearError: () => void;
  /**
   * Registra un préstamo. Devuelve el detalle creado (con su folio) o `null` si
   * falló, dejando el mensaje real en `error`.
   */
  registrar: (datos: RegistrarPrestamoArgs) => Promise<PrestamoDetalle | null>;
}

/** Escrituras de préstamos (actualmente solo el registro). */
export function useLoanMutations(): UseLoanMutationsResult {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const registrar = useCallback(
    async (datos: RegistrarPrestamoArgs): Promise<PrestamoDetalle | null> => {
      if (inFlight.current) {
        return null;
      }

      inFlight.current = true;
      setSaving(true);
      setError(null);

      try {
        return await registerLoan(datos);
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
