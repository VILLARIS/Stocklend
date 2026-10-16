import { useEffect, useMemo, useRef, useState } from "react";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Package,
  Search,
  X,
} from "lucide-react";

import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { QuantityEditor } from "../ui/QuantityEditor";

import { usePendingReturns, useReturnDetails } from "../../hooks/useReturns";
import { adaptReturns } from "../../services/returnsAdapters";

import type { ReturnRecord } from "../../types/returns";
import type {
  CondicionUnidad,
  DetalleDevolucion,
  LineaDevolucion,
  LineaDevolucionInput,
  RegistrarDevolucionInput,
} from "../../types/returnsApi";
import { normalizeText } from "../../utils/normalize";

interface ReturnFormDialogProps {
  open: boolean;
  loan: ReturnRecord | null;
  saving: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (datos: RegistrarDevolucionInput) => void;
}

type Campo = "devuelta" | "danada" | "perdida";

type Responsabilidad = "sin_determinar" | "estudiante";

interface LineaDraft {
  devuelta: number;
  danada: number;
  perdida: number;
  /** `articulo_unidad.id` → condición elegida (solo control individual). */
  unidades: Record<number, CondicionUnidad>;
}

const EMPTY_DRAFT: LineaDraft = {
  devuelta: 0,
  danada: 0,
  perdida: 0,
  unidades: {},
};

interface UnidadSeleccion {
  unidadId: number;
  codigo: string;
  condicion: CondicionUnidad;
}

/** Renglón del detalle real combinado con la selección local. */
interface LineaCalculada {
  detalle: LineaDevolucion;
  individual: boolean;
  /** Unidades pendientes actuales del renglón. */
  pendiente: number;
  devuelta: number;
  danada: number;
  perdida: number;
  /** Unidades que esta devolución registraría en el renglón. */
  total: number;
  /** Pendientes que quedarían tras guardar. */
  restante: number;
  unidades: UnidadSeleccion[];
}

const CONDICIONES: CondicionUnidad[] = ["bueno", "danado", "perdido"];

const CONDICION_ETIQUETA: Record<CondicionUnidad, string> = {
  bueno: "Bueno",
  danado: "Dañado",
  perdido: "Perdido",
};

const NOTE_MAX = 240;

/** Combina el detalle real de SQLite con la selección local sin inventar datos. */
function calcularLinea(
  detalle: LineaDevolucion,
  draft: LineaDraft,
): LineaCalculada {
  const pendiente = Math.max(0, detalle.cantidad_pendiente);
  const individual = detalle.unidades.length > 0;

  if (individual) {
    let devuelta = 0;
    let danada = 0;
    let perdida = 0;
    const unidades: UnidadSeleccion[] = [];

    for (const unidad of detalle.unidades) {
      const condicion = draft.unidades[unidad.id];
      if (!condicion) continue;

      unidades.push({ unidadId: unidad.id, codigo: unidad.codigo, condicion });

      if (condicion === "bueno") devuelta += 1;
      else if (condicion === "danado") danada += 1;
      else perdida += 1;
    }

    const total = unidades.length;

    return {
      detalle,
      individual: true,
      pendiente,
      devuelta,
      danada,
      perdida,
      total,
      restante: pendiente - total,
      unidades,
    };
  }

  // Red de seguridad: normaliza en orden si el borrador quedara inconsistente.
  const devuelta = Math.min(Math.max(0, draft.devuelta), pendiente);
  const danada = Math.min(draft.danada, pendiente - devuelta);
  const perdida = Math.min(draft.perdida, pendiente - devuelta - danada);
  const total = devuelta + danada + perdida;

  return {
    detalle,
    individual: false,
    pendiente,
    devuelta,
    danada,
    perdida,
    total,
    restante: pendiente - total,
    unidades: [],
  };
}

// ========================================
// FORMULARIO
// ========================================

export function ReturnFormDialog({
  open,
  loan,
  saving,
  serverError,
  onClose,
  onSubmit,
}: ReturnFormDialogProps) {
  const [loanId, setLoanId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const [drafts, setDrafts] = useState<Record<number, LineaDraft>>({});
  const [descripcion, setDescripcion] = useState("");
  const [responsabilidad, setResponsabilidad] =
    useState<Responsabilidad>("sin_determinar");
  const [observaciones, setObservaciones] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ========================================
  // DATOS REALES: PRÉSTAMOS ELEGIBLES
  // ========================================

  // `listar_devoluciones_pendientes` solo devuelve préstamos activos con
  // unidades pendientes: nunca se puede elegir un préstamo cerrado o anulado.
  const pendingReturns = usePendingReturns();

  const candidates = useMemo(
    () => (pendingReturns.data ? adaptReturns(pendingReturns.data) : []),
    [pendingReturns.data],
  );

  // ========================================
  // DETALLE REAL DEL PRÉSTAMO SELECCIONADO
  // ========================================

  // Al elegir un préstamo se consulta su detalle real
  // (`obtener_detalle_devolucion`): el formulario nunca trabaja con el resumen
  // desactualizado del listado.
  const details = useReturnDetails(loanId);

  // ========================================
  // REINICIAR AL ABRIR
  // ========================================

  useEffect(() => {
    if (!open) return;

    setLoanId(loan ? Number(loan.id) : null);
    setQuery("");
    setSearchOpen(false);
    setDrafts({});
    setDescripcion("");
    setResponsabilidad("sin_determinar");
    setObservaciones("");
    setStep("form");
  }, [open, loan]);

  // ========================================
  // CERRAR RESULTADOS AL HACER CLIC FUERA
  // ========================================

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  // ========================================
  // PRÉSTAMO SELECCIONADO (ENCABEZADO)
  // ========================================

  const selected: ReturnRecord | null =
    candidates.find((item) => item.id === String(loanId)) ??
    (loan && String(loan.id) === String(loanId) ? loan : null);

  // ========================================
  // BÚSQUEDA DE PRÉSTAMOS CON PENDIENTES
  // ========================================

  const matches = useMemo(() => {
    const term = normalizeText(query);

    return candidates
      .filter((item) => {
        if (item.pendientes <= 0) return false;
        if (!term) return true;
        return [item.folio, item.estudiante, item.codigoUniversitario].some(
          (value) => normalizeText(value).includes(term),
        );
      })
      .slice(0, 8);
  }, [candidates, query]);

  const selectLoan = (item: ReturnRecord) => {
    setLoanId(Number(item.id));
    setQuery("");
    setSearchOpen(false);
    setDrafts({});
    setDescripcion("");
    setResponsabilidad("sin_determinar");
    setObservaciones("");
    setStep("form");
  };

  const clearLoan = () => {
    setLoanId(null);
    setQuery("");
    setSearchOpen(false);
    setDrafts({});
    setDescripcion("");
    setStep("form");

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  // ========================================
  // DETALLE REAL
  // ========================================

  const detailsReady = details.status === "success" && details.data !== null;
  const detail: DetalleDevolucion | null =
    detailsReady && details.data && details.data.id === loanId
      ? details.data
      : null;

  const lineas = useMemo<LineaCalculada[]>(() => {
    if (!detail) return [];
    return detail.lineas.map((linea) =>
      calcularLinea(linea, drafts[linea.id] ?? EMPTY_DRAFT),
    );
  }, [detail, drafts]);

  const seleccionadas = lineas.filter((linea) => linea.total > 0);

  const totalSeleccionado = seleccionadas.reduce(
    (total, linea) => total + linea.total,
    0,
  );

  const pendienteTotal = detail?.unidades_pendientes ?? selected?.pendientes ?? 0;

  const restanteTotal = Math.max(0, pendienteTotal - totalSeleccionado);

  const requiereDescripcion = lineas.some(
    (linea) => linea.danada > 0 || linea.perdida > 0,
  );

  const puedeContinuar =
    detail !== null &&
    detail.elegible &&
    totalSeleccionado > 0 &&
    (!requiereDescripcion || descripcion.trim() !== "") &&
    !saving;

  const motivo = !detail
    ? details.status === "error"
      ? "No se pudo cargar el detalle real del préstamo."
      : "Selecciona un préstamo pendiente de devolución."
    : !detail.elegible
      ? "El préstamo ya no tiene unidades pendientes."
      : totalSeleccionado === 0
        ? "Indica al menos una unidad a devolver."
        : requiereDescripcion && descripcion.trim() === ""
          ? "Describe el daño o la pérdida para poder registrarlo."
          : null;

  // ========================================
  // ACTUALIZAR CANTIDADES
  // ========================================

  const updateCantidad = (
    detalleId: number,
    campo: Campo,
    valor: number,
    pendiente: number,
  ) => {
    setDrafts((previous) => {
      const base = { ...EMPTY_DRAFT, ...(previous[detalleId] ?? {}) };

      const otros =
        (campo === "devuelta" ? 0 : base.devuelta) +
        (campo === "danada" ? 0 : base.danada) +
        (campo === "perdida" ? 0 : base.perdida);

      const maximo = Math.max(0, pendiente - otros);
      const siguiente = Math.min(Math.max(0, Math.trunc(valor)), maximo);

      return { ...previous, [detalleId]: { ...base, [campo]: siguiente } };
    });
  };

  // ========================================
  // ACTUALIZAR UNIDADES (CONTROL INDIVIDUAL)
  // ========================================

  const toggleUnidad = (detalleId: number, unidadId: number) => {
    setDrafts((previous) => {
      const base = { ...EMPTY_DRAFT, ...(previous[detalleId] ?? {}) };
      const unidades = { ...base.unidades };

      if (unidades[unidadId]) delete unidades[unidadId];
      else unidades[unidadId] = "bueno";

      return { ...previous, [detalleId]: { ...base, unidades } };
    });
  };

  const setCondicion = (
    detalleId: number,
    unidadId: number,
    condicion: CondicionUnidad,
  ) => {
    setDrafts((previous) => {
      const base = { ...EMPTY_DRAFT, ...(previous[detalleId] ?? {}) };
      return {
        ...previous,
        [detalleId]: { ...base, unidades: { ...base.unidades, [unidadId]: condicion } },
      };
    });
  };

  // ========================================
  // PAYLOAD
  // ========================================

  const construirPayload = (detalleReal: DetalleDevolucion) => {
    const lineasPayload: LineaDevolucionInput[] = seleccionadas.map((linea) => {
      const incidente = linea.danada > 0 || linea.perdida > 0;

      const comun = {
        prestamo_detalle_id: Number(linea.detalle.id),
        descripcion: incidente ? descripcion.trim() : null,
        estudiante_id:
          incidente && responsabilidad === "estudiante"
            ? detalleReal.estudiante_id
            : null,
      };

      if (linea.individual) {
        return {
          ...comun,
          cantidad_devuelta: 0,
          cantidad_daniada: 0,
          cantidad_perdida: 0,
          unidades: linea.unidades.map((unidad) => ({
            unidad_id: unidad.unidadId,
            condicion: unidad.condicion,
          })),
        };
      }

      return {
        ...comun,
        cantidad_devuelta: linea.devuelta,
        cantidad_daniada: linea.danada,
        cantidad_perdida: linea.perdida,
      };
    });

    return {
      prestamo_id: detalleReal.id,
      lineas: lineasPayload,
      observaciones: observaciones.trim() === "" ? null : observaciones.trim(),
    };
  };

  const confirmar = () => {
    if (!detail || !puedeContinuar) return;
    onSubmit(construirPayload(detail));
  };

  // ========================================
  // PASO DE CONFIRMACIÓN
  // ========================================

  if (step === "confirm" && detail) {
    const cerraria = restanteTotal === 0;

    return (
      <Dialog
        open={open}
        onClose={() => {
          if (!saving) setStep("form");
        }}
        title="Confirmar devolución"
        subtitle="Revisa los datos antes de guardarlos en la base local."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => setStep("form")}
            >
              Volver
            </Button>

            <Button disabled={saving} onClick={confirmar}>
              {saving ? "Registrando…" : "Confirmar y registrar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E4ECF7] bg-[#F8FAFE] px-3.5 py-3">
            <p className="text-[11.5px] font-semibold text-[#405676]">
              Préstamo y estudiante responsable
            </p>

            <p className="mt-1 text-[12.5px] font-semibold text-[#253B5D]">
              {detail.nombre_completo}
            </p>

            <p className="mt-0.5 font-mono text-[11px] text-[#8797AE]">
              {detail.folio}
              {" · "}
              {detail.codigo_universitario}
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E4ECF7]">
            <div className="border-b border-[#E9EEF6] bg-[#F8FAFE] px-3.5 py-2.5 text-[11.5px] font-semibold text-[#405676]">
              Artículos ({seleccionadas.length})
            </div>

            <ul className="divide-y divide-[#E9EEF6]">
              {seleccionadas.map((linea) => (
                <li key={linea.detalle.id} className="px-3.5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#294361]">
                      {linea.detalle.articulo}
                    </span>

                    <span className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold">
                      <span className="rounded-md bg-[#EAF8F0] px-2 py-0.5 tabular-nums text-[#1B9B66]">
                        {linea.devuelta} buenas
                      </span>
                      <span className="rounded-md bg-[#FFF7EB] px-2 py-0.5 tabular-nums text-[#B87916]">
                        {linea.danada} dañadas
                      </span>
                      <span className="rounded-md bg-[#FDECEE] px-2 py-0.5 tabular-nums text-[#B23540]">
                        {linea.perdida} perdidas
                      </span>
                    </span>
                  </div>

                  {linea.unidades.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {linea.unidades.map((unidad) => (
                        <li
                          key={unidad.unidadId}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[#E4ECF7] bg-white px-2 py-0.5 font-mono text-[10.5px] text-[#5C7291]"
                        >
                          {unidad.codigo}
                          <span className="font-sans text-[10px] text-[#8797AE]">
                            {CONDICION_ETIQUETA[unidad.condicion]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#E4ECF7] bg-white px-3.5 py-3">
              <p className="text-[11.5px] font-semibold text-[#405676]">
                Unidades a devolver
              </p>

              <p className="mt-1 text-[12.5px] font-bold tabular-nums text-[#317FE7]">
                {totalSeleccionado}
              </p>
            </div>

            <div className="rounded-xl border border-[#E4ECF7] bg-white px-3.5 py-3">
              <p className="text-[11.5px] font-semibold text-[#405676]">
                Estado previsto del préstamo
              </p>

              <p
                className={`mt-1 text-[12.5px] font-semibold ${
                  cerraria ? "text-[#1B9B66]" : "text-[#B87916]"
                }`}
              >
                {cerraria
                  ? "Quedaría cerrado"
                  : `Continuaría activo (${restanteTotal} pendientes)`}
              </p>
            </div>
          </div>

          {observaciones.trim() !== "" && (
            <div className="rounded-xl border border-[#E4ECF7] bg-white px-3.5 py-3">
              <p className="text-[11.5px] font-semibold text-[#405676]">
                Observaciones
              </p>

              <p className="mt-1 whitespace-pre-line text-[12px] leading-5 text-[#435F92]">
                {observaciones.trim()}
              </p>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-xl border border-[#E1EBFA] bg-[#F3F8FF] px-3 py-2.5">
            <Info className="h-4 w-4 shrink-0 text-[#347CE6]" />

            <p className="text-[10.5px] leading-[17px] text-[#6881A4]">
              La vista previa del estado es orientativa. La fecha, los incidentes
              y el ajuste de existencias los fija el backend al confirmar.
            </p>
          </div>

          {requiereDescripcion && descripcion.trim() !== "" && (
            <div className="rounded-xl border border-[#F1DFC0] bg-[#FFFBF2] px-3.5 py-3">
              <p className="text-[11.5px] font-semibold text-[#8A6412]">
                Incidente ·{" "}
                {responsabilidad === "estudiante"
                  ? "responsabilidad del estudiante"
                  : "responsabilidad sin determinar"}
              </p>

              <p className="mt-1 whitespace-pre-line text-[12px] leading-5 text-[#987A51]">
                {descripcion.trim()}
              </p>
            </div>
          )}

          {serverError !== null && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[#F3C9CC] bg-[#FDECEE] px-3.5 py-2.5 text-[12px] font-medium text-[#B23540]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">{serverError}</span>
            </p>
          )}
        </div>
      </Dialog>
    );
  }

  // ========================================
  // PASO PRINCIPAL
  // ========================================

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Registrar devolución"
      subtitle="Selecciona un préstamo y prepara los artículos recibidos."
      size="xl"
      initialFocusRef={loan ? undefined : inputRef}
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>

          <span title={motivo ?? undefined}>
            <Button disabled={!puedeContinuar} onClick={() => setStep("confirm")}>
              Continuar
            </Button>
          </span>
        </>
      }
    >
      <div className="space-y-4">
        {/* =====================================
            SELECCIÓN DEL PRÉSTAMO
        ===================================== */}

        <section>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EAF3FF] text-[#287FF0]">
              <ClipboardCheck className="h-[17px] w-[17px]" />
            </div>

            <div>
              <h3 className="text-[12.5px] font-semibold text-[#253D61]">
                Préstamo y estudiante responsable
              </h3>

              <p className="mt-0.5 text-[10.5px] text-[#8293AA]">
                Busca el préstamo activo con unidades pendientes.
              </p>
            </div>
          </div>

          {loanId !== null ? (
            <div className="flex items-center gap-3 rounded-xl border border-[#CFE2FF] bg-[#F2F7FF] px-3.5 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#2F80DF]">
                <ClipboardCheck className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-[#233A5D]">
                  {detail?.nombre_completo ?? selected?.estudiante ?? "Cargando…"}
                </p>

                <p className="mt-0.5 font-mono text-[10.5px] text-[#6882A6]">
                  {detail?.folio ?? selected?.folio ?? ""}
                  {" · "}
                  {detail?.codigo_universitario ?? selected?.codigoUniversitario ?? ""}
                </p>
              </div>

              <span className="hidden shrink-0 rounded-lg bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#B87916] sm:inline-flex">
                {pendienteTotal} pendientes
              </span>

              <button
                type="button"
                onClick={clearLoan}
                aria-label="Cambiar préstamo"
                title="Cambiar préstamo"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8495AA] hover:bg-white hover:text-[#D65367]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div ref={searchRef} className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#8C9BB2]" />

              <input
                ref={inputRef}
                type="search"
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSearchOpen(false);
                  }

                  if (event.key === "Enter" && searchOpen && matches.length > 0) {
                    event.preventDefault();
                    selectLoan(matches[0]);
                  }
                }}
                placeholder="Buscar préstamo, estudiante o código..."
                aria-label="Buscar préstamo pendiente de devolución"
                className="h-10 w-full rounded-xl border border-[#DFE7F2] bg-white pl-10 pr-3 text-[12px] text-[#243B60] placeholder:text-[#9AA8BC] outline-none hover:border-[#BAD0EC] focus:border-[#398BFF] focus:ring-2 focus:ring-[#398BFF]/10"
              />

              {searchOpen && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[230px] overflow-y-auto rounded-xl border border-[#DCE7F5] bg-white p-1.5 shadow-[0_12px_30px_rgba(29,62,110,0.14)]">
                  {matches.length > 0 ? (
                    matches.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectLoan(item)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[#F0F6FF]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold text-[#294361]">
                            {item.estudiante}
                          </p>

                          <p className="mt-0.5 font-mono text-[10.5px] text-[#8A9AAF]">
                            {item.folio}
                            {" · "}
                            {item.codigoUniversitario}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-lg bg-[#FFF7EB] px-2 py-1 text-[10.5px] font-semibold text-[#B87916]">
                          {item.pendientes} pendientes
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-6 text-center text-[12px] text-[#8797AA]">
                      No se encontraron préstamos pendientes.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* =====================================
            DETALLE DEL PRÉSTAMO
        ===================================== */}

        {loanId !== null && (
          <>
            <div className="h-px bg-[#E9EEF6]" />

            {details.status === "error" ? (
              <div
                role="alert"
                className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[#F3C9CC] bg-[#FDECEE] px-3.5 py-2.5 text-[11.5px] font-medium text-[#B23540]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  {details.error ?? "No se pudo cargar el detalle del préstamo."}
                </span>
                <Button variant="secondary" onClick={details.refetch}>
                  Reintentar
                </Button>
              </div>
            ) : detail === null ? (
              <p className="rounded-xl border border-[#E5EDF6] bg-[#FBFCFF] px-4 py-6 text-center text-[11.5px] text-[#8293AA]">
                Cargando el detalle real del préstamo…
              </p>
            ) : !detail.elegible ? (
              <p className="rounded-xl border border-[#F5E8D0] bg-[#FFF7EB] px-4 py-3 text-[11.5px] text-[#987A51]">
                El préstamo ya no tiene unidades pendientes de devolución.
              </p>
            ) : (
              <>
                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EAF3FF] text-[#287FF0]">
                        <Package className="h-[17px] w-[17px]" />
                      </div>

                      <h3 className="text-[12.5px] font-semibold text-[#253D61]">
                        Unidades que se reciben
                      </h3>
                    </div>

                    <span className="rounded-lg bg-[#EAF2FF] px-2.5 py-1 text-[10.5px] font-semibold text-[#3478D5]">
                      {pendienteTotal} pendientes
                    </span>
                  </div>

                  <div className="max-h-[300px] space-y-2 overflow-y-auto pr-0.5">
                    {lineas.map((linea) => (
                      <div
                        key={linea.detalle.id}
                        className="rounded-xl border border-[#E4ECF7] bg-white px-3.5 py-3 transition-colors hover:bg-[#FAFCFF]"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2EBF7] bg-[#F1F6FE] text-[#4D86D2]">
                            {linea.restante === 0 ? (
                              <CheckCircle2 className="h-[19px] w-[19px] text-[#1FA26D]" />
                            ) : (
                              <Package className="h-[19px] w-[19px]" />
                            )}
                          </div>

                          <div className="min-w-[140px] flex-1">
                            <p
                              className="truncate text-[12px] font-semibold text-[#28405F]"
                              title={linea.detalle.articulo}
                            >
                              {linea.detalle.articulo}
                            </p>

                            <p className="mt-1 text-[10.5px] text-[#8293AA]">
                              {linea.detalle.cantidad_prestada} prestadas ·{" "}
                              {linea.detalle.cantidad_devuelta} devueltas ·{" "}
                              {linea.detalle.cantidad_daniada} dañadas ·{" "}
                              {linea.detalle.cantidad_perdida} perdidas ·{" "}
                              <span className="font-semibold text-[#B87916]">
                                {linea.pendiente} pendientes
                              </span>
                            </p>
                          </div>

                          <span className="shrink-0 rounded-lg bg-[#EAF2FF] px-2.5 py-1.5 text-[11px] font-semibold tabular-nums text-[#3478D5]">
                            +{linea.total} · {linea.restante} por quedar
                          </span>
                        </div>

                        {/* CONTROL INDIVIDUAL */}

                        {linea.individual ? (
                          <ul className="mt-2.5 space-y-1.5">
                            {linea.detalle.unidades.map((unidad) => {
                              const elegida =
                                drafts[linea.detalle.id]?.unidades[unidad.id] ??
                                null;

                              return (
                                <li
                                  key={unidad.id}
                                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
                                    elegida
                                      ? "border-[#CFE2FF] bg-[#F5FAFF]"
                                      : "border-[#E9EEF6] bg-white"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleUnidad(linea.detalle.id, unidad.id)
                                    }
                                    aria-pressed={elegida !== null}
                                    className="flex min-w-0 items-center gap-2"
                                  >
                                    <span
                                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border ${
                                        elegida
                                          ? "border-[#398BFF] bg-[#398BFF] text-white"
                                          : "border-[#C7D5E8] bg-white text-transparent"
                                      }`}
                                    >
                                      <CheckCircle2 className="h-3 w-3" />
                                    </span>

                                    <span className="truncate font-mono text-[11px] text-[#40597C]">
                                      {unidad.codigo}
                                    </span>
                                  </button>

                                  {elegida && (
                                    <div className="flex shrink-0 gap-1">
                                      {CONDICIONES.map((condicion) => (
                                        <button
                                          key={condicion}
                                          type="button"
                                          onClick={() =>
                                            setCondicion(
                                              linea.detalle.id,
                                              unidad.id,
                                              condicion,
                                            )
                                          }
                                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                            elegida === condicion
                                              ? condicion === "bueno"
                                                ? "bg-[#1B9B66] text-white"
                                                : condicion === "danado"
                                                  ? "bg-[#B87916] text-white"
                                                  : "bg-[#B23540] text-white"
                                              : "bg-[#EEF3FA] text-[#5C7291] hover:bg-[#E1EAF6]"
                                          }`}
                                        >
                                          {CONDICION_ETIQUETA[condicion]}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        ) : linea.pendiente === 0 ? (
                          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#EAF8F0] px-2.5 py-1.5 text-[11px] font-semibold text-[#1A9B67]">
                            <CheckCircle2 className="h-4 w-4" />
                            Completo
                          </span>
                        ) : (
                          /* SIN CONTROL INDIVIDUAL */

                          <div className="mt-2.5 flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[10.5px] font-medium text-[#5C7291]">
                                Buenas
                              </span>

                              <QuantityEditor
                                value={linea.devuelta}
                                min={0}
                                max={linea.pendiente - linea.danada - linea.perdida}
                                articleName={`${linea.detalle.articulo} en buen estado`}
                                onChange={(valor) =>
                                  updateCantidad(
                                    linea.detalle.id,
                                    "devuelta",
                                    valor,
                                    linea.pendiente,
                                  )
                                }
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10.5px] font-medium text-[#987A51]">
                                Dañadas
                              </span>

                              <QuantityEditor
                                value={linea.danada}
                                min={0}
                                max={linea.pendiente - linea.devuelta - linea.perdida}
                                articleName={`${linea.detalle.articulo} dañadas`}
                                onChange={(valor) =>
                                  updateCantidad(
                                    linea.detalle.id,
                                    "danada",
                                    valor,
                                    linea.pendiente,
                                  )
                                }
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10.5px] font-medium text-[#A9525C]">
                                Perdidas
                              </span>

                              <QuantityEditor
                                value={linea.perdida}
                                min={0}
                                max={linea.pendiente - linea.devuelta - linea.danada}
                                articleName={`${linea.detalle.articulo} perdidas`}
                                onChange={(valor) =>
                                  updateCantidad(
                                    linea.detalle.id,
                                    "perdida",
                                    valor,
                                    linea.pendiente,
                                  )
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* =================================
                    INCIDENTES (DAÑO O PÉRDIDA)
                ================================= */}

                {requiereDescripcion && (
                  <section className="rounded-xl border border-[#F1DFC0] bg-[#FFFBF2] px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-[#D89A1F]" />

                      <h3 className="text-[12px] font-semibold text-[#8A6412]">
                        Daño o pérdida registrada
                      </h3>
                    </div>

                    <p className="mt-1 text-[10.5px] leading-[17px] text-[#987A51]">
                      El backend abrirá un incidente con estas unidades. Describe
                      qué ocurrió; es obligatorio.
                    </p>

                    <label
                      htmlFor="return-descripcion"
                      className="mt-2.5 mb-1.5 block text-[11.5px] font-semibold text-[#455875]"
                    >
                      Descripción del incidente
                      <span className="ml-1 font-normal text-[#B23540]">
                        (obligatoria)
                      </span>
                    </label>

                    <textarea
                      id="return-descripcion"
                      rows={2}
                      maxLength={NOTE_MAX}
                      value={descripcion}
                      onChange={(event) => setDescripcion(event.target.value)}
                      placeholder="Detalle del daño o la pérdida..."
                      className="w-full resize-none rounded-xl border border-[#DFE7F2] bg-white px-3 py-2.5 text-[12px] leading-5 text-[#2A4061] placeholder:text-[#9AA8BC] outline-none hover:border-[#BAD0EC] focus:border-[#398BFF] focus:ring-2 focus:ring-[#398BFF]/10"
                    />

                    <div className="mt-3">
                      <p className="mb-1.5 text-[11.5px] font-semibold text-[#455875]">
                        Responsabilidad del incidente
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setResponsabilidad("sin_determinar")}
                          aria-pressed={responsabilidad === "sin_determinar"}
                          className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                            responsabilidad === "sin_determinar"
                              ? "border-[#398BFF] bg-[#EDF5FF] text-[#287FF0]"
                              : "border-[#DFE7F2] bg-white text-[#5C7291] hover:bg-[#F3F7FC]"
                          }`}
                        >
                          Sin determinar
                        </button>

                        <button
                          type="button"
                          onClick={() => setResponsabilidad("estudiante")}
                          aria-pressed={responsabilidad === "estudiante"}
                          className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                            responsabilidad === "estudiante"
                              ? "border-[#398BFF] bg-[#EDF5FF] text-[#287FF0]"
                              : "border-[#DFE7F2] bg-white text-[#5C7291] hover:bg-[#F3F7FC]"
                          }`}
                        >
                          Estudiante
                          {detail.nombre_completo
                            ? ` · ${detail.nombre_completo}`
                            : ""}
                        </button>
                      </div>

                      <p className="mt-1.5 text-[10px] text-[#987A51]">
                        No se atribuye automáticamente al estudiante del préstamo.
                      </p>
                    </div>
                  </section>
                )}

                {/* =================================
                    RESUMEN
                ================================= */}

                <section className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#DFEAFE] bg-[#EDF5FF] px-4 py-3">
                    <p className="text-[11px] font-medium text-[#7087A9]">
                      Unidades a devolver
                    </p>

                    <p className="mt-1 text-[24px] font-bold tabular-nums text-[#317FE7]">
                      {totalSeleccionado}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#F5E8D0] bg-[#FFF7EB] px-4 py-3">
                    <p className="text-[11px] font-medium text-[#987A51]">
                      Quedarían pendientes
                    </p>

                    <p className="mt-1 text-[24px] font-bold tabular-nums text-[#B87916]">
                      {restanteTotal}
                    </p>
                  </div>
                </section>

                {/* OBSERVACIONES */}

                <section>
                  <label
                    htmlFor="return-note"
                    className="mb-1.5 block text-[11.5px] font-semibold text-[#455875]"
                  >
                    Observaciones
                    <span className="ml-1 font-normal text-[#9AA8BC]">
                      (opcional)
                    </span>
                  </label>

                  <textarea
                    id="return-note"
                    rows={2}
                    maxLength={NOTE_MAX}
                    value={observaciones}
                    onChange={(event) => setObservaciones(event.target.value)}
                    placeholder="Estado de los artículos al recibirlos..."
                    className="w-full resize-none rounded-xl border border-[#DFE7F2] bg-white px-3 py-2.5 text-[12px] leading-5 text-[#2A4061] placeholder:text-[#9AA8BC] outline-none hover:border-[#BAD0EC] focus:border-[#398BFF] focus:ring-2 focus:ring-[#398BFF]/10"
                  />

                  <p className="mt-1 text-right text-[10px] tabular-nums text-[#9AA8BC]">
                    {observaciones.length}/{NOTE_MAX}
                  </p>
                </section>
              </>
            )}
          </>
        )}

        {/* MENSAJE DEL SERVIDOR */}

        {serverError !== null && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-[#F3C9CC] bg-[#FDECEE] px-3.5 py-2.5 text-[12px] font-medium text-[#B23540]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{serverError}</span>
          </p>
        )}

        {/* MOTIVO */}

        {motivo !== null && (
          <p className="flex items-center gap-2 rounded-xl border border-[#E1EBFA] bg-[#F3F8FF] px-3 py-2 text-[11.5px] text-[#6881A4]">
            <Info className="h-4 w-4 shrink-0 text-[#347CE6]" />
            {motivo}
          </p>
        )}
      </div>
    </Dialog>
  );
}
