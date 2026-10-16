import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Hash,
  Loader2,
  Package,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { SectionTitle } from "./SectionTitle";
import { QuantityEditor } from "../ui/QuantityEditor";
import { loanInputClass } from "./formStyles";
import { normalizeText } from "../../utils/normalize";
import type { ArticuloInventario } from "../../types/inventory";
import type { LoanInventorySource } from "../../types/loansForm";

/**
 * Artículo elegido en el formulario.
 *
 * Sin control individual se presta por `cantidad` (mínimo 1). Con control
 * individual se presta por `unidadIds` (unidades concretas identificadas) y
 * `cantidad` queda como reflejo de `unidadIds.length`.
 */
export interface SelectedArticle {
  articuloId: number;
  cantidad: number;
  unidadIds: number[];
}

interface LoanArticleFieldProps {
  open: boolean;
  source: LoanInventorySource;
  value: SelectedArticle[];
  onChange: (articles: SelectedArticle[]) => void;
}

/** Sección "Artículos del préstamo": buscador y lista de artículos elegidos. */
export function LoanArticleField({
  open,
  source,
  value,
  onChange,
}: LoanArticleFieldProps) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { articles, units, status, error, onRetry } = source;

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setSearchOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  const prestables = useMemo(
    () => articles.filter((article) => article.activo && article.prestable),
    [articles],
  );

  const selectedIds = useMemo(
    () => new Set(value.map((item) => item.articuloId)),
    [value],
  );

  const results = useMemo(() => {
    const term = normalizeText(query);

    return prestables
      .filter((article) => !selectedIds.has(article.id))
      .filter((article) => {
        if (!term) return true;

        return (
          normalizeText(article.nombre).includes(term) ||
          normalizeText(article.codigo ?? "").includes(term)
        );
      })
      .slice(0, 8);
  }, [prestables, selectedIds, query]);

  /** Unidades disponibles (identificadas) de un artículo de control individual. */
  const unidadesDisponibles = (articuloId: number) =>
    units.filter(
      (unit) => unit.articulo_id === articuloId && unit.estado === "disponible",
    );

  const addArticle = (article: ArticuloInventario) => {
    if (article.cantidad_disponible <= 0 || selectedIds.has(article.id)) return;

    onChange([
      ...value,
      {
        articuloId: article.id,
        cantidad: article.control_individual ? 0 : 1,
        unidadIds: [],
      },
    ]);
    setQuery("");
    setSearchOpen(false);
  };

  const updateQuantity = (articuloId: number, cantidad: number) => {
    const article = articles.find((item) => item.id === articuloId);
    if (!article) return;

    const disponible = Math.max(1, article.cantidad_disponible);
    const next = Math.min(Math.max(1, Math.trunc(cantidad)), disponible);

    onChange(
      value.map((item) =>
        item.articuloId === articuloId ? { ...item, cantidad: next } : item,
      ),
    );
  };

  const toggleUnit = (articuloId: number, unidadId: number) => {
    onChange(
      value.map((item) => {
        if (item.articuloId !== articuloId) return item;

        const has = item.unidadIds.includes(unidadId);
        const unidadIds = has
          ? item.unidadIds.filter((id) => id !== unidadId)
          : [...item.unidadIds, unidadId];

        return { ...item, unidadIds, cantidad: unidadIds.length };
      }),
    );
  };

  const removeArticle = (articuloId: number) => {
    onChange(value.filter((item) => item.articuloId !== articuloId));
  };

  const totalUnits = value.reduce(
    (total, item) =>
      total + (item.unidadIds.length > 0 ? item.unidadIds.length : item.cantidad),
    0,
  );

  return (
    <section>
      <SectionTitle
        icon={<PackagePlus className="h-[17px] w-[17px]" />}
        title="Artículos del préstamo"
        description="Busca y agrega los artículos necesarios."
      />

      <div ref={searchRef} className="relative mt-3">
        <label
          htmlFor="loan-article-search"
          className="mb-1.5 block text-[11.5px] font-semibold text-[#455875]"
        >
          Agregar artículo
        </label>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#8C9BB2]" />

          <input
            id="loan-article-search"
            type="search"
            role="combobox"
            aria-expanded={searchOpen}
            aria-controls="loan-article-results"
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSearchOpen(false);
              }

              if (event.key === "Enter" && searchOpen) {
                const firstAvailable = results.find(
                  (item) => item.cantidad_disponible > 0,
                );

                if (firstAvailable) {
                  event.preventDefault();
                  addArticle(firstAvailable);
                }
              }
            }}
            placeholder="Buscar artículo por nombre o código..."
            className={`${loanInputClass} pl-10`}
          />
        </div>

        {searchOpen && (
          <div
            id="loan-article-results"
            role="listbox"
            aria-label="Resultados de artículos"
            className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[245px] overflow-y-auto rounded-xl border border-[#DCE7F5] bg-white p-1.5 shadow-[0_12px_30px_rgba(29,62,110,0.14)]"
          >
            {status === "loading" ? (
              <div className="flex items-center justify-center gap-2 px-3 py-5 text-[12px] text-[#7486A1]">
                <Loader2 className="h-4 w-4 animate-spin text-[#398BFF]" />
                Cargando inventario…
              </div>
            ) : status === "error" ? (
              <div className="px-3 py-4 text-center">
                <AlertCircle className="mx-auto h-6 w-6 text-[#D65367]" />

                <p className="mt-2 text-[12px] text-[#B23540]">
                  {error ?? "No se pudo cargar el inventario."}
                </p>

                <button
                  type="button"
                  onClick={onRetry}
                  className="mx-auto mt-2 flex items-center gap-1.5 rounded-lg border border-[#DCE7F5] px-2.5 py-1 text-[11.5px] font-semibold text-[#3478D5] hover:bg-[#F0F6FF]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reintentar
                </button>
              </div>
            ) : prestables.length === 0 ? (
              <div className="px-3 py-5 text-center">
                <Package className="mx-auto h-6 w-6 text-[#A8B8CC]" />

                <p className="mt-2 text-[12px] text-[#7486A1]">
                  No hay artículos prestables en el inventario.
                </p>
              </div>
            ) : results.length > 0 ? (
              results.map((article) => {
                const available = article.cantidad_disponible > 0;

                return (
                  <button
                    key={article.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    disabled={!available}
                    onClick={() => addArticle(article)}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-[#F0F6FF] focus:bg-[#F0F6FF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2EBF7] bg-[#F1F6FE] text-[#4D86D2]">
                      <Package className="h-[19px] w-[19px]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-[#283F61]">
                        {article.nombre}
                      </p>

                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10.5px] text-[#8797AE]">
                        <span>{article.codigo ?? "Sin código"}</span>
                        <span>·</span>
                        <span>{article.categoria}</span>

                        {article.control_individual && (
                          <span className="inline-flex items-center gap-0.5 font-semibold text-[#7A5BD0]">
                            <Hash className="h-3 w-3" />
                            Control individual
                          </span>
                        )}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-[10.5px] font-semibold ${
                        available
                          ? "bg-[#EDF8F1] text-[#1B8E57]"
                          : "bg-[#F3F5F8] text-[#9AA7B8]"
                      }`}
                    >
                      {article.cantidad_disponible} disponibles
                    </span>

                    {available && (
                      <Plus className="h-4 w-4 shrink-0 text-[#398BFF]" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-5 text-center">
                <Package className="mx-auto h-6 w-6 text-[#A8B8CC]" />

                <p className="mt-2 text-[12px] text-[#7486A1]">
                  No se encontraron artículos.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =====================================
          ARTÍCULOS SELECCIONADOS
      ===================================== */}

      <div className="mt-3 overflow-hidden rounded-xl border border-[#E4ECF7] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#E9EEF6] bg-[#F8FAFE] px-3.5 py-2.5">
          <span className="text-[11.5px] font-semibold text-[#405676]">
            Artículos seleccionados
          </span>

          <span className="rounded-lg bg-[#EAF2FF] px-2.5 py-1 text-[10.5px] font-semibold tabular-nums text-[#3478D5]">
            {value.length} tipos
          </span>
        </div>

        {value.length === 0 ? (
          <div className="flex min-h-[105px] flex-col items-center justify-center gap-2 px-4 py-4 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0F5FD] text-[#87A4CC]">
              <PackagePlus className="h-5 w-5" />
            </div>

            <p className="text-[11.5px] text-[#8999B0]">
              Busca un artículo para añadirlo al préstamo.
            </p>
          </div>
        ) : (
          <div className="max-h-[280px] divide-y divide-[#E9EEF6] overflow-y-auto">
            {value.map((selected) => {
              const article = articles.find(
                (item) => item.id === selected.articuloId,
              );

              if (!article) return null;

              const esControl = article.control_individual;
              const disponibles = esControl
                ? unidadesDisponibles(article.id)
                : [];
              const sinUnidades =
                esControl && selected.unidadIds.length === 0;

              return (
                <div
                  key={article.id}
                  className="px-3.5 py-3 transition-colors hover:bg-[#FAFCFF]"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2EBF7] bg-[#F1F6FE] text-[#4D86D2]">
                      <Package className="h-[19px] w-[19px]" />
                    </div>

                    <div className="min-w-[135px] flex-1">
                      <p className="truncate text-[12px] font-semibold text-[#253B5D]">
                        {article.nombre}
                      </p>

                      <p className="mt-0.5 text-[10.5px] text-[#8A9BB0]">
                        {article.codigo ?? "Sin código"}
                        {" · "}
                        {esControl
                          ? "Control individual"
                          : `${article.cantidad_disponible} disponibles`}
                      </p>
                    </div>

                    {esControl ? (
                      <span className="shrink-0 rounded-lg bg-[#EFEAFB] px-2.5 py-1 text-[10.5px] font-semibold tabular-nums text-[#6A4FC4]">
                        {selected.unidadIds.length} de {disponibles.length} unidades
                      </span>
                    ) : (
                      <QuantityEditor
                        value={selected.cantidad}
                        max={article.cantidad_disponible}
                        articleName={article.nombre}
                        onChange={(cantidad) =>
                          updateQuantity(article.id, cantidad)
                        }
                      />
                    )}

                    <button
                      type="button"
                      aria-label={`Eliminar ${article.nombre} del préstamo`}
                      title="Eliminar artículo"
                      onClick={() => removeArticle(article.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#A0AEC0] hover:bg-[#FFF0F2] hover:text-[#D65367]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {esControl && (
                    <div className="mt-2.5 pl-[52px]">
                      {disponibles.length === 0 ? (
                        <p className="text-[11px] font-medium text-[#B23540]">
                          No hay unidades disponibles para este artículo.
                        </p>
                      ) : (
                        <>
                          <p
                            className={`mb-1.5 text-[10.5px] font-semibold ${
                              sinUnidades ? "text-[#B23540]" : "text-[#6A4FC4]"
                            }`}
                          >
                            {sinUnidades
                              ? "Selecciona las unidades que se entregarán."
                              : "Unidades incluidas en el préstamo:"}
                          </p>

                          <div className="flex flex-wrap gap-1.5">
                            {disponibles.map((unit) => {
                              const active = selected.unidadIds.includes(
                                unit.id,
                              );

                              return (
                                <button
                                  key={unit.id}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => toggleUnit(article.id, unit.id)}
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10.5px] font-medium tabular-nums transition-colors ${
                                    active
                                      ? "border-[#B79CF0] bg-[#EFEAFB] text-[#6A4FC4]"
                                      : "border-[#DFE7F2] bg-white text-[#5B708E] hover:border-[#BAD0EC] hover:bg-[#F3F8FF]"
                                  }`}
                                >
                                  {active ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Hash className="h-3 w-3" />
                                  )}
                                  {unit.codigo}
                                </button>
                              );
                            })}
                          </div>

                          {sinUnidades && (
                            <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-[#B23540]">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Selecciona al menos una unidad para continuar.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {value.length > 0 && (
          <div className="flex items-center justify-between border-t border-[#E9EEF6] bg-[#F8FAFE] px-3.5 py-3">
            <span className="text-[11.5px] font-semibold text-[#5B708E]">
              Total de unidades
            </span>

            <span className="text-[15px] font-bold tabular-nums text-[#267BF0]">
              {totalUnits}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
