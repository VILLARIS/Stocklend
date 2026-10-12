
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CheckCircle2,
  ClipboardCheck,
  Info,
  Minus,
  Package,
  Plus,
  Search,
  X,
} from "lucide-react";

import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";

import {
  demoReturns,
  type ReturnRecord,
} from "../../data/demoReturns";

interface ReturnFormDialogProps {
  open: boolean;
  loan: ReturnRecord | null;
  onClose: () => void;
}

type QuantityDrafts = Record<string, string>;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function clampQuantity(
  value: string,
  max: number
): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || value.trim() === "") {
    return 0;
  }

  return Math.min(
    max,
    Math.max(0, Math.trunc(numeric))
  );
}

// ========================================
// CONTROL DE CANTIDAD
// ========================================

function ReturnQuantityInput({
  value,
  max,
  name,
  onChange,
}: {
  value: string;
  max: number;
  name: string;
  onChange: (value: string) => void;
}) {
  const numeric = clampQuantity(value, max);

  return (
    <div
      className="
        flex shrink-0 items-center gap-1
        rounded-[10px]
        border border-[#DFE7F2]
        bg-white p-1
        transition-colors
        focus-within:border-[#398BFF]
        focus-within:ring-2
        focus-within:ring-[#398BFF]/10
      "
    >
      <button
        type="button"
        aria-label={`Restar una unidad de ${name}`}
        disabled={numeric <= 0}
        onClick={() =>
          onChange(String(Math.max(0, numeric - 1)))
        }
        className="
          flex h-7 w-7 items-center justify-center
          rounded-md text-[#617794]
          hover:bg-[#EDF5FF] hover:text-[#287FF0]
          disabled:cursor-not-allowed
          disabled:opacity-30
        "
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(event) => {
          const next = event.target.value;

          if (/^\d*$/.test(next)) {
            onChange(next);
          }
        }}
        onBlur={() =>
          onChange(String(clampQuantity(value, max)))
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onFocus={(event) => event.currentTarget.select()}
        aria-label={`Cantidad a devolver de ${name}`}
        title={`Máximo: ${max} unidades`}
        className="
          h-7 w-12 rounded-md
          bg-transparent px-1
          text-center text-[12px]
          font-semibold tabular-nums
          text-[#283F61] outline-none
        "
      />

      <button
        type="button"
        aria-label={`Sumar una unidad de ${name}`}
        disabled={numeric >= max}
        onClick={() =>
          onChange(String(Math.min(max, numeric + 1)))
        }
        className="
          flex h-7 w-7 items-center justify-center
          rounded-md text-[#617794]
          hover:bg-[#EDF5FF] hover:text-[#287FF0]
          disabled:cursor-not-allowed
          disabled:opacity-30
        "
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ========================================
// FORMULARIO
// ========================================

export function ReturnFormDialog({
  open,
  loan,
  onClose,
}: ReturnFormDialogProps) {
  const [loanId, setLoanId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const [quantities, setQuantities] =
    useState<QuantityDrafts>({});

  const [note, setNote] = useState("");

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ========================================
  // REINICIAR AL ABRIR
  // ========================================

  useEffect(() => {
    if (!open) return;

    setLoanId(loan?.id ?? null);
    setQuery("");
    setSearchOpen(false);
    setQuantities({});
    setNote("");
  }, [open, loan]);

  // ========================================
  // CERRAR RESULTADOS AL HACER CLIC FUERA
  // ========================================

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );
    };
  }, [open]);

  // ========================================
  // PRÉSTAMO SELECCIONADO
  // ========================================

  const selected = useMemo(() => {
    return (
      demoReturns.find((item) => item.id === loanId) ??
      null
    );
  }, [loanId]);

  // ========================================
  // BUSCAR PRÉSTAMOS CON PENDIENTES
  // ========================================

  const matches = useMemo(() => {
    const term = normalize(query);

    return demoReturns
      .filter((item) => {
        if (item.pendientes <= 0) return false;

        if (!term) return true;

        return [
          item.folio,
          item.estudiante,
          item.codigoUniversitario,
        ].some((value) =>
          normalize(value).includes(term)
        );
      })
      .slice(0, 8);
  }, [query]);

  // ========================================
  // SELECCIONAR PRÉSTAMO
  // ========================================

  const selectLoan = (item: ReturnRecord) => {
    setLoanId(item.id);
    setQuery("");
    setSearchOpen(false);
    setQuantities({});
  };

  const clearLoan = () => {
    setLoanId(null);
    setQuery("");
    setSearchOpen(false);
    setQuantities({});

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  // ========================================
  // ACTUALIZAR CANTIDAD
  // ========================================

  const updateQuantity = (
    itemId: string,
    value: string
  ) => {
    setQuantities((previous) => ({
      ...previous,
      [itemId]: value,
    }));
  };

  // ========================================
  // RESUMEN DE DEVOLUCIÓN
  // ========================================

  const totalToReturn =
    selected?.items.reduce((total, item) => {
      const pending = Math.max(
        0,
        item.cantidad - item.devueltas
      );

      const amount = clampQuantity(
        quantities[item.id] ?? "0",
        pending
      );

      return total + amount;
    }, 0) ?? 0;

  const pendingAfter = Math.max(
    0,
    (selected?.pendientes ?? 0) - totalToReturn
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Registrar devolución"
      subtitle="Selecciona un préstamo y prepara los artículos recibidos."
      size="xl"
      initialFocusRef={loan ? undefined : inputRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>

          <span title="Disponible cuando se conecte la base de datos">
            <Button disabled>
              Confirmar devolución
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
                Busca el préstamo que deseas recibir.
              </p>
            </div>
          </div>

          {selected ? (
            <div className="flex items-center gap-3 rounded-xl border border-[#CFE2FF] bg-[#F2F7FF] px-3.5 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#2F80DF]">
                <ClipboardCheck className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-[#233A5D]">
                  {selected.estudiante}
                </p>

                <p className="mt-0.5 font-mono text-[10.5px] text-[#6882A6]">
                  {selected.folio}
                  {" · "}
                  {selected.codigoUniversitario}
                </p>
              </div>

              <span className="hidden shrink-0 rounded-lg bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#B87916] sm:inline-flex">
                {selected.pendientes} pendientes
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

                  if (
                    event.key === "Enter" &&
                    searchOpen &&
                    matches.length > 0
                  ) {
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
                    <p className="px-3 py-6 text-center text-[12px] text-[#8797AE]">
                      No se encontraron préstamos pendientes.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* =====================================
            UNIDADES QUE SE RECIBEN
        ===================================== */}

        {selected && (
          <>
            <div className="h-px bg-[#E9EEF6]" />

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
                  {selected.pendientes} pendientes
                </span>
              </div>

              <div className="max-h-[280px] divide-y divide-[#E9EEF6] overflow-y-auto rounded-xl border border-[#E4ECF7] bg-white">
                {selected.items.map((item) => {
                  const pending = Math.max(
                    0,
                    item.cantidad - item.devueltas
                  );

                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center gap-3 px-3.5 py-3 transition-colors hover:bg-[#FAFCFF]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2EBF7] bg-[#F1F6FE] text-[#4D86D2]">
                        {pending === 0 ? (
                          <CheckCircle2 className="h-[19px] w-[19px] text-[#1FA26D]" />
                        ) : (
                          <Package className="h-[19px] w-[19px]" />
                        )}
                      </div>

                      <div className="min-w-[140px] flex-1">
                        <p className="truncate text-[12px] font-semibold text-[#28405F]">
                          {item.nombre}
                        </p>

                        <p className="mt-1 text-[10.5px] text-[#8293AA]">
                          {item.devueltas} devueltas
                          {" · "}
                          {pending} pendientes
                        </p>
                      </div>

                      {pending > 0 ? (
                        <ReturnQuantityInput
                          name={item.nombre}
                          max={pending}
                          value={quantities[item.id] ?? "0"}
                          onChange={(value) =>
                            updateQuantity(item.id, value)
                          }
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAF8F0] px-2.5 py-1.5 text-[11px] font-semibold text-[#1A9B67]">
                          <CheckCircle2 className="h-4 w-4" />
                          Completo
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* =================================
                RESUMEN DE DEVOLUCIÓN
            ================================= */}

            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#DFEAFE] bg-[#EDF5FF] px-4 py-3">
                <p className="text-[11px] font-medium text-[#7087A9]">
                  Unidades a devolver
                </p>

                <p className="mt-1 text-[24px] font-bold tabular-nums text-[#317FE7]">
                  {totalToReturn}
                </p>
              </div>

              <div className="rounded-xl border border-[#F5E8D0] bg-[#FFF7EB] px-4 py-3">
                <p className="text-[11px] font-medium text-[#987A51]">
                  Quedarían pendientes
                </p>

                <p className="mt-1 text-[24px] font-bold tabular-nums text-[#B87916]">
                  {pendingAfter}
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
                maxLength={200}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Estado de los artículos al recibirlos..."
                className="w-full resize-none rounded-xl border border-[#DFE7F2] bg-white px-3 py-2.5 text-[12px] leading-5 text-[#2A4061] placeholder:text-[#9AA8BC] outline-none hover:border-[#BAD0EC] focus:border-[#398BFF] focus:ring-2 focus:ring-[#398BFF]/10"
              />

              <p className="mt-1 text-right text-[10px] tabular-nums text-[#9AA8BC]">
                {note.length}/200
              </p>
            </section>
          </>
        )}

        {/* AVISO DEMO */}
        <div className="flex items-start gap-2.5 rounded-xl border border-[#E1EBFA] bg-[#F3F8FF] px-3 py-2.5">
          <Info className="h-4 w-4 shrink-0 text-[#347CE6]" />

          <p className="text-[10.5px] leading-4 text-[#6881A4]">
            Prototipo visual: puedes preparar una devolución
            total o parcial. Todavía no se modifican los
            préstamos, las existencias ni la base de datos.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
