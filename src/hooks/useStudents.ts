import { useCallback, useEffect, useRef, useState } from "react";

import {
  actualizarEstudiante,
  cambiarEstadoEstudiante,
  crearEstudiante,
  fetchStudentHistory,
  fetchStudentIncidents,
  fetchStudents,
  fetchStudentStats,
} from "../services/students";
import type {
  EstadisticasEstudiantes,
  EstudianteDirectorio,
  IncidenciaEstudiante,
  PrestamoHistorialEstudiante,
} from "../types/studentsApi";

export type StudentsStatus = "idle" | "loading" | "success" | "error";

export interface UseStudentsDirectoryResult {
  data: EstudianteDirectorio[] | null;
  status: StudentsStatus;
  error: string | null;
  refetch: () => void;
}

export interface UseStudentStatsResult {
  data: EstadisticasEstudiantes | null;
  status: StudentsStatus;
  error: string | null;
  refetch: () => void;
}

export interface UseStudentHistoryResult {
  data: PrestamoHistorialEstudiante[] | null;
  status: StudentsStatus;
  error: string | null;
  refetch: () => void;
}

export interface UseStudentIncidentsResult {
  data: IncidenciaEstudiante[] | null;
  status: StudentsStatus;
  error: string | null;
  refetch: () => void;
}

/**
 * Recurso asíncrono con descarte de respuestas obsoletas.
 *
 * `requestIdRef` invalida las respuestas de peticiones antiguas cuando cambia
 * la dependencia (por ejemplo, al cambiar de estudiante), de modo que nunca se
 * muestra la respuesta de un recurso ya reemplazado. `isMountedRef` evita
 * escribir estado tras el desmontaje (compatible con StrictMode).
 *
 * Con `enabled: false` no se consulta nada: el recurso queda en `idle`, sin
 * datos ni error, y cualquier petición en vuelo se descarta.
 */
function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  enabled: boolean,
): [T | null, StudentsStatus, string | null, () => void] {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<StudentsStatus>(
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

    // Limpia el resultado anterior antes de consultar: al cambiar de
    // estudiante no se muestra el historial del estudiante previo.
    setData(null);
    void load();

    return () => {
      isMountedRef.current = false;
    };
  }, [enabled, load]);

  return [data, status, error, load];
}

/** Directorio completo de estudiantes. */
export function useStudentsDirectory(): UseStudentsDirectoryResult {
  const [data, status, error, refetch] = useAsyncResource(fetchStudents, true);
  return { data, status, error, refetch };
}

/** Totales de las tarjetas del directorio. */
export function useStudentStats(): UseStudentStatsResult {
  const [data, status, error, refetch] = useAsyncResource(
    fetchStudentStats,
    true,
  );
  return { data, status, error, refetch };
}

/**
 * Historial de préstamos de un estudiante.
 *
 * Sin un `studentId` válido (por ejemplo, con la ficha cerrada) no se consulta
 * nada y el recurso queda en `idle`.
 */
export function useStudentHistory(
  studentId: number | null,
): UseStudentHistoryResult {
  const enabled =
    studentId !== null && Number.isInteger(studentId) && studentId > 0;
  const fetcher = useCallback(() => {
    if (studentId === null || !Number.isInteger(studentId) || studentId <= 0) {
      return Promise.reject(new Error("No se indicó un estudiante válido."));
    }
    return fetchStudentHistory(studentId);
  }, [studentId]);
  const [data, status, error, refetch] = useAsyncResource(fetcher, enabled);
  return { data, status, error, refetch };
}

// ---------------------------------------------------------------------------
// Escrituras de estudiante
// ---------------------------------------------------------------------------

export interface UseStudentMutationsResult {
  /** Hay una operación en curso; bloquea nuevos envíos. */
  saving: boolean;
  /** Último error devuelto por Rust (o por la capa de transporte). */
  error: string | null;
  clearError: () => void;
  crear: (
    codigo: string,
    nombres: string,
    apellidos: string,
  ) => Promise<boolean>;
  actualizar: (
    id: number,
    codigo: string,
    nombres: string,
    apellidos: string,
  ) => Promise<boolean>;
  cambiarEstado: (id: number, activo: boolean) => Promise<boolean>;
}

/**
 * Gestiona las tres escrituras de estudiantes con un único estado de guardado y
 * error, impidiendo envíos duplicados.
 *
 * No toca el directorio: cada operación devuelve `true`/`false` para que la
 * página decida cuándo refrescar (nunca antes de que Rust confirme).
 */
export function useStudentMutations(): UseStudentMutationsResult {
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
        setError(caught instanceof Error ? caught.message : String(caught));
        return false;
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [],
  );

  const crear = useCallback(
    (codigo: string, nombres: string, apellidos: string) =>
      run(() => crearEstudiante({ codigo_universitario: codigo, nombres, apellidos })),
    [run],
  );

  const actualizar = useCallback(
    (id: number, codigo: string, nombres: string, apellidos: string) =>
      run(() =>
        actualizarEstudiante({
          id,
          codigo_universitario: codigo,
          nombres,
          apellidos,
        }),
      ),
    [run],
  );

  const cambiarEstado = useCallback(
    (id: number, activo: boolean) =>
      run(() => cambiarEstadoEstudiante({ id, activo })),
    [run],
  );

  const clearError = useCallback(() => setError(null), []);

  return { saving, error, clearError, crear, actualizar, cambiarEstado };
}

/**
 * Incidencias atribuidas a un estudiante.
 *
 * Sin un `studentId` válido no se consulta nada y el recurso queda en `idle`.
 */
export function useStudentIncidents(
  studentId: number | null,
): UseStudentIncidentsResult {
  const enabled =
    studentId !== null && Number.isInteger(studentId) && studentId > 0;
  const fetcher = useCallback(() => {
    if (studentId === null || !Number.isInteger(studentId) || studentId <= 0) {
      return Promise.reject(new Error("No se indicó un estudiante válido."));
    }
    return fetchStudentIncidents(studentId);
  }, [studentId]);
  const [data, status, error, refetch] = useAsyncResource(fetcher, enabled);
  return { data, status, error, refetch };
}
