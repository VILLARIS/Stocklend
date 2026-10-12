// Hook del Panel: expone el estado de carga de los datos reales del Dashboard.
//
// Sin polling y sin actualizaciones automáticas. La carga se dispara al montar
// y puede repetirse manualmente con `refetch`.

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchDashboard } from "../services/dashboard";
import type { DashboardPanel } from "../types/dashboard";

export type DashboardStatus = "idle" | "loading" | "success" | "error";

export interface UseDashboardResult {
  /** Datos reales del Panel; `null` mientras no haya una carga exitosa. */
  data: DashboardPanel | null;
  status: DashboardStatus;
  /** Mensaje de error de la última carga fallida; `null` si no hay error. */
  error: string | null;
  /** Vuelve a solicitar los datos manualmente. */
  refetch: () => void;
}

/**
 * Carga los datos del Dashboard desde Rust.
 *
 * - Una base válida sin registros es un éxito con contadores en cero, no un
 *   error.
 * - Los errores se capturan y se exponen en `error`; no cierran la aplicación.
 * - Las respuestas obsoletas (por desmontaje o por solaparse con una solicitud
 *   más reciente) se descartan.
 */
export function useDashboard(): UseDashboardResult {
  const [data, setData] = useState<DashboardPanel | null>(null);
  const [status, setStatus] = useState<DashboardStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    setStatus("loading");
    setError(null);

    try {
      const panel = await fetchDashboard();
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setData(panel);
      setStatus("success");
    } catch (caught) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void load();
    return () => {
      isMountedRef.current = false;
    };
  }, [load]);

  return { data, status, error, refetch: load };
}
