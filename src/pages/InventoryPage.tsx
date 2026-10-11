
import { useEffect, useMemo, useState } from "react";

import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Package,
  Boxes,
  CircleCheck,
  ArrowRightLeft,
} from "lucide-react";

import background from "../assets/background/background.png";

import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";

import {
  InventoryTabs,
  type InventoryTabKey,
} from "../components/inventory/InventoryTabs";

import {
  InventoryToolbar,
  type AvailabilityFilter,
} from "../components/inventory/InventoryToolbar";

import { InventoryTable } from "../components/inventory/InventoryTable";
import { ArticleFormDialog } from "../components/inventory/ArticleFormDialog";
import { ArticleDetailsDialog } from "../components/inventory/ArticleDetailsDialog";

import { CategoriesToolbar } from "../components/inventory/CategoriesToolbar";
import { CategoriesTable } from "../components/inventory/CategoriesTable";
import { CategoryFormDialog } from "../components/inventory/CategoryFormDialog";

import {
  UnitsToolbar,
  type UnitStateFilter,
} from "../components/inventory/UnitsToolbar";

import { UnitsTable } from "../components/inventory/UnitsTable";
import { UnitDetailsDialog } from "../components/inventory/UnitDetailsDialog";

import { DEMO_MODE } from "../data/demoData";

import {
  inventoryArticles,
  inventoryUnits,
  inventoryCategories,
  inventoryCategoryNames,
  type InventoryArticle,
  type InventoryUnit,
  type InventoryCategory,
} from "../data/inventoryData";

const PAGE_SIZE = 8;

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; article: InventoryArticle }
  | { mode: "details"; article: InventoryArticle }
  | { mode: "unitDetails"; unit: InventoryUnit }
  | { mode: "categoryCreate" }
  | { mode: "categoryEdit"; category: InventoryCategory };

// ========================================
// TARJETA DE ESTADÍSTICA
// ========================================

type StatAccent = "blue" | "violet" | "green" | "orange";

const statStyles: Record<
  StatAccent,
  { background: string; color: string; line: string }
> = {
  blue: {
    background: "bg-[#E9F2FF]",
    color: "text-[#237EFF]",
    line: "#237EFF",
  },
  violet: {
    background: "bg-[#EEEAFE]",
    color: "text-[#7964FF]",
    line: "#7964FF",
  },
  green: {
    background: "bg-[#E2F8EF]",
    color: "text-[#16B981]",
    line: "#16B981",
  },
  orange: {
    background: "bg-[#FFF1DD]",
    color: "text-[#F59B22]",
    line: "#F59B22",
  },
};

function InventoryStatCard({
  value,
  label,
  icon,
  accent,
  description,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  accent: StatAccent;
  description: string;
}) {
  const styles = statStyles[accent];

  return (
    <div
      className="
        relative flex min-h-[132px] min-w-0
        flex-col justify-between
        overflow-hidden rounded-[20px]
        border border-white/80
        bg-white/90 p-4
        shadow-[0_6px_24px_rgba(31,65,122,0.05)]
        backdrop-blur-md
      "
    >
      <div className="flex items-center justify-between gap-3">
        <div
          className={`
            flex h-[48px] w-[48px] shrink-0
            items-center justify-center rounded-[15px]
            ${styles.background} ${styles.color}
          `}
        >
          {icon}
        </div>

        <strong
          className="
            text-[clamp(25px,2.1vw,35px)]
            font-bold leading-none
            tracking-tight tabular-nums
            text-[#132651]
          "
        >
          {value}
        </strong>
      </div>

      <div className="mt-3 min-w-0">
        <p className="truncate text-[13px] font-semibold text-[#435F92]">
          {label}
        </p>

        <p className="mt-1 truncate text-[11px] text-[#8493AE]">
          {description}
        </p>
      </div>

      <div
        className="absolute bottom-0 left-5 right-5 h-[2px] rounded-full opacity-40"
        style={{
          background: `linear-gradient(90deg, ${styles.line}, transparent)`,
        }}
      />
    </div>
  );
}

// ========================================
// PAGINACIÓN REUTILIZABLE LOCAL
// ========================================

function InventoryPagePagination({
  currentPage,
  totalPages,
  resultLabel,
  onPrevious,
  onNext,
  unit = false,
}: {
  currentPage: number;
  totalPages: number;
  resultLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  unit?: boolean;
}) {
  return (
    <div
      className="
        flex flex-wrap items-center justify-between
        gap-3 border-t border-[#E9EEF6]
        bg-white/70 px-4 py-3
        text-[12px] text-[#7385A4]
      "
    >
      <span className="tabular-nums">{resultLabel}</span>

      <div className="flex items-center gap-2">
        <Button
          variant="icon"
          aria-label={
            unit
              ? "Página anterior de unidades"
              : "Página anterior"
          }
          disabled={currentPage <= 1}
          onClick={onPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="min-w-[90px] text-center tabular-nums">
          Página {currentPage} de {totalPages}
        </span>

        <Button
          variant="icon"
          aria-label={
            unit
              ? "Página siguiente de unidades"
              : "Página siguiente"
          }
          disabled={currentPage >= totalPages}
          onClick={onNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ========================================
// INVENTARIO
// ========================================

export function InventoryPage() {
  // Pestaña principal
  const [tab, setTab] = useState<InventoryTabKey>("articulos");

  // Filtros de artículos
  const [query, setQuery] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [estado, setEstado] =
    useState<AvailabilityFilter>("todos");
  const [page, setPage] = useState(1);

  // Filtros de unidades
  const [unitQuery, setUnitQuery] = useState("");
  const [unitCategoria, setUnitCategoria] = useState("todas");
  const [unitEstado, setUnitEstado] =
    useState<UnitStateFilter>("todos");
  const [unitPage, setUnitPage] = useState(1);

  // Filtro de categorías
  const [categoryQuery, setCategoryQuery] = useState("");

  // Modal activo
  const [dialog, setDialog] = useState<DialogState | null>(null);

  // ========================================
  // ESTADÍSTICAS GENERALES
  // ========================================

  const summary = useMemo(() => {
    return inventoryArticles.reduce(
      (acc, article) => {
        acc.units +=
          article.disponible +
          article.prestado +
          article.danado +
          article.faltante;

        acc.available += article.disponible;
        acc.loaned += article.prestado;

        return acc;
      },
      {
        units: 0,
        available: 0,
        loaned: 0,
      }
    );
  }, []);

  // ========================================
  // FILTROS DE ARTÍCULOS
  // ========================================

  const hasActiveFilters =
    query.trim() !== "" ||
    categoria !== "todas" ||
    estado !== "todos";

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    return inventoryArticles.filter((article) => {
      const matchesQuery =
        term === "" ||
        article.nombre.toLowerCase().includes(term) ||
        (article.codigo?.toLowerCase().includes(term) ?? false);

      const matchesCategoria =
        categoria === "todas" ||
        article.categoria === categoria;

      const total =
        article.disponible +
        article.prestado +
        article.danado +
        article.faltante;

      const matchesEstado =
        estado === "todos"
          ? true
          : estado === "prestable"
            ? article.prestable
            : estado === "no_prestable"
              ? !article.prestable
              : estado === "sin_stock"
                ? total === 0
                : true;

      return matchesQuery && matchesCategoria && matchesEstado;
    });
  }, [query, categoria, estado]);

  useEffect(() => {
    setPage(1);
  }, [query, categoria, estado, tab]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE)
  );

  const safePage = Math.min(page, totalPages);

  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const from =
    filtered.length === 0
      ? 0
      : (safePage - 1) * PAGE_SIZE + 1;

  const to = Math.min(
    safePage * PAGE_SIZE,
    filtered.length
  );

  const resultLabel =
    filtered.length === 0
      ? "Sin resultados"
      : `Mostrando ${from}–${to} de ${filtered.length} ${
          filtered.length === 1 ? "artículo" : "artículos"
        }`;

  const clearFilters = () => {
    setQuery("");
    setCategoria("todas");
    setEstado("todos");
  };

  // ========================================
  // FILTROS DE UNIDADES
  // ========================================

  const hasActiveUnitFilters =
    unitQuery.trim() !== "" ||
    unitCategoria !== "todas" ||
    unitEstado !== "todos";

  const unitCategories = useMemo(() => {
    return Array.from(
      new Set(inventoryUnits.map((unit) => unit.categoria))
    ).sort();
  }, []);

  const filteredUnits = useMemo(() => {
    const term = unitQuery.trim().toLowerCase();

    return inventoryUnits.filter((unit) => {
      const matchesQuery =
        term === "" ||
        unit.codigo.toLowerCase().includes(term) ||
        unit.articulo.toLowerCase().includes(term);

      const matchesCategoria =
        unitCategoria === "todas" ||
        unit.categoria === unitCategoria;

      const matchesEstado =
        unitEstado === "todos" ||
        unit.estado === unitEstado;

      return (
        matchesQuery &&
        matchesCategoria &&
        matchesEstado
      );
    });
  }, [unitQuery, unitCategoria, unitEstado]);

  useEffect(() => {
    setUnitPage(1);
  }, [unitQuery, unitCategoria, unitEstado, tab]);

  const unitTotalPages = Math.max(
    1,
    Math.ceil(filteredUnits.length / PAGE_SIZE)
  );

  const unitSafePage = Math.min(
    unitPage,
    unitTotalPages
  );

  const unitItems = filteredUnits.slice(
    (unitSafePage - 1) * PAGE_SIZE,
    unitSafePage * PAGE_SIZE
  );

  const unitFrom =
    filteredUnits.length === 0
      ? 0
      : (unitSafePage - 1) * PAGE_SIZE + 1;

  const unitTo = Math.min(
    unitSafePage * PAGE_SIZE,
    filteredUnits.length
  );

  const unitResultLabel =
    filteredUnits.length === 0
      ? "Sin resultados"
      : `Mostrando ${unitFrom}–${unitTo} de ${
          filteredUnits.length
        } ${
          filteredUnits.length === 1
            ? "unidad"
            : "unidades"
        }`;

  const clearUnitFilters = () => {
    setUnitQuery("");
    setUnitCategoria("todas");
    setUnitEstado("todos");
  };

  // ========================================
  // FILTROS DE CATEGORÍAS
  // ========================================

  const hasCategoryFilter =
    categoryQuery.trim() !== "";

  const filteredCategories = useMemo(() => {
    const term = categoryQuery.trim().toLowerCase();

    return term === ""
      ? inventoryCategories
      : inventoryCategories.filter((category) =>
          category.nombre.toLowerCase().includes(term)
        );
  }, [categoryQuery]);

  const viewCategoryArticles = (
    category: InventoryCategory
  ) => {
    setCategoria(category.nombre);
    setQuery("");
    setEstado("todos");
    setTab("articulos");
  };

  // ========================================
  // RENDER PRINCIPAL
  // ========================================

  return (
    <div
      className="
        flex min-h-0 min-w-0 flex-1
        flex-col overflow-hidden
        bg-cover bg-center bg-no-repeat
      "
      style={{
        backgroundImage: `url(${background})`,
      }}
    >
      {/* ENCABEZADO */}
      <div className="shrink-0">
        <PageHeader
          title="Inventario"
          subtitle="Gestiona los artículos, equipos y existencias del almacén"
          meta={
            DEMO_MODE && (
              <span
                className="
                  inline-flex h-8 items-center gap-2
                  rounded-full border border-white/80
                  bg-white/90 px-3
                  text-[11px] font-medium
                  text-[#405783] shadow-sm
                "
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#267BFA]" />
                Vista de demostración
              </span>
            )
          }
          action={
            <Button
              variant="sidebar"
              onClick={() => setDialog({ mode: "create" })}
            >
              <Plus className="h-4 w-4" />
              Nuevo artículo
            </Button>
          }
        />
      </div>

      {/* CONTENIDO */}
      <main
        className="
          min-h-0 min-w-0 flex-1
          overflow-x-hidden overflow-y-auto
          px-4 pb-4 pt-3
          @[1100px]:px-5
        "
      >
        <div
          className="
            mx-auto flex w-full max-w-[1800px]
            flex-col gap-3
          "
        >
          {/* =====================================
              TARJETAS DE RESUMEN
          ===================================== */}

          <section
            aria-label="Resumen del inventario"
            className="
              grid min-w-0 grid-cols-1 gap-3
              @[560px]:grid-cols-2
              @[960px]:grid-cols-4
            "
          >
            <InventoryStatCard
              value={inventoryArticles.length}
              label="Artículos registrados"
              description="Tipos de artículos en inventario"
              accent="blue"
              icon={<Package className="h-6 w-6" />}
            />

            <InventoryStatCard
              value={summary.units}
              label="Unidades en existencia"
              description="Existencias registradas"
              accent="violet"
              icon={<Boxes className="h-6 w-6" />}
            />

            <InventoryStatCard
              value={summary.available}
              label="Disponibles para prestar"
              description="Unidades listas para entregar"
              accent="green"
              icon={<CircleCheck className="h-6 w-6" />}
            />

            <InventoryStatCard
              value={summary.loaned}
              label="Prestadas a estudiantes"
              description="Unidades actualmente prestadas"
              accent="orange"
              icon={<ArrowRightLeft className="h-6 w-6" />}
            />
          </section>

          {/* =====================================
              PANEL PRINCIPAL DE INVENTARIO
          ===================================== */}

          <section
            className="
              min-w-0 overflow-hidden
              rounded-[20px]
              border border-white/80
              bg-white/95
              shadow-[0_6px_24px_rgba(31,65,122,0.06)]
              backdrop-blur-md
            "
          >
            {/* PESTAÑAS */}
            <InventoryTabs
              value={tab}
              onChange={setTab}
            />

            {/* =================================
                ARTÍCULOS
            ================================= */}

            {tab === "articulos" && (
              <div
                role="tabpanel"
                id="inv-panel-articulos"
                aria-labelledby="inv-tab-articulos"
              >
                <InventoryToolbar
                  query={query}
                  onQuery={setQuery}
                  categoria={categoria}
                  onCategoria={setCategoria}
                  estado={estado}
                  onEstado={setEstado}
                  categorias={inventoryCategoryNames}
                  hasActiveFilters={hasActiveFilters}
                  onClear={clearFilters}
                />

                <InventoryTable
                  items={pageItems}
                  filtered={hasActiveFilters}
                  activeCategory={
                    categoria !== "todas"
                      ? categoria
                      : null
                  }
                  onClear={clearFilters}
                  onEdit={(article) =>
                    setDialog({
                      mode: "edit",
                      article,
                    })
                  }
                  onDetails={(article) =>
                    setDialog({
                      mode: "details",
                      article,
                    })
                  }
                />

                <InventoryPagePagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  resultLabel={resultLabel}
                  onPrevious={() =>
                    setPage((value) =>
                      Math.max(1, value - 1)
                    )
                  }
                  onNext={() =>
                    setPage((value) =>
                      Math.min(totalPages, value + 1)
                    )
                  }
                />
              </div>
            )}

            {/* =================================
                UNIDADES
            ================================= */}

            {tab === "unidades" && (
              <div
                role="tabpanel"
                id="inv-panel-unidades"
                aria-labelledby="inv-tab-unidades"
              >
                <UnitsToolbar
                  query={unitQuery}
                  onQuery={setUnitQuery}
                  categoria={unitCategoria}
                  onCategoria={setUnitCategoria}
                  estado={unitEstado}
                  onEstado={setUnitEstado}
                  categorias={unitCategories}
                  hasActiveFilters={hasActiveUnitFilters}
                  onClear={clearUnitFilters}
                />

                <UnitsTable
                  items={unitItems}
                  filtered={hasActiveUnitFilters}
                  onClear={clearUnitFilters}
                  onDetails={(unit) =>
                    setDialog({
                      mode: "unitDetails",
                      unit,
                    })
                  }
                />

                <InventoryPagePagination
                  currentPage={unitSafePage}
                  totalPages={unitTotalPages}
                  resultLabel={unitResultLabel}
                  onPrevious={() =>
                    setUnitPage((value) =>
                      Math.max(1, value - 1)
                    )
                  }
                  onNext={() =>
                    setUnitPage((value) =>
                      Math.min(unitTotalPages, value + 1)
                    )
                  }
                  unit
                />
              </div>
            )}

            {/* =================================
                CATEGORÍAS
            ================================= */}

            {tab === "categorias" && (
              <div
                role="tabpanel"
                id="inv-panel-categorias"
                aria-labelledby="inv-tab-categorias"
              >
                <div
                  className="
                    border-b border-[#E9EEF6]
                    px-4 py-3
                  "
                >
                  <CategoriesToolbar
                    query={categoryQuery}
                    onQuery={setCategoryQuery}
                    resultCount={filteredCategories.length}
                    totalCount={inventoryCategories.length}
                    onNew={() =>
                      setDialog({
                        mode: "categoryCreate",
                      })
                    }
                  />
                </div>

                <CategoriesTable
                  items={filteredCategories}
                  filtered={hasCategoryFilter}
                  onClear={() =>
                    setCategoryQuery("")
                  }
                  onNew={() =>
                    setDialog({
                      mode: "categoryCreate",
                    })
                  }
                  onViewArticles={viewCategoryArticles}
                  onEdit={(category) =>
                    setDialog({
                      mode: "categoryEdit",
                      category,
                    })
                  }
                />
              </div>
            )}
          </section>
        </div>
      </main>

      {/* =====================================
          MODALES
      ===================================== */}

      {(dialog?.mode === "create" ||
        dialog?.mode === "edit") && (
        <ArticleFormDialog
          open
          mode={dialog.mode}
          article={
            dialog.mode === "edit"
              ? dialog.article
              : undefined
          }
          unidades={
            dialog.mode === "edit"
              ? inventoryUnits.filter(
                  (unit) =>
                    unit.articulo === dialog.article.nombre
                )
              : []
          }
          categorias={inventoryCategoryNames}
          existingNames={inventoryArticles.map(
            (article) => article.nombre
          )}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.mode === "details" && (
        <ArticleDetailsDialog
          open
          article={dialog.article}
          unidades={inventoryUnits.filter(
            (unit) =>
              unit.articulo === dialog.article.nombre
          )}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.mode === "unitDetails" && (
        <UnitDetailsDialog
          open
          unit={dialog.unit}
          onClose={() => setDialog(null)}
        />
      )}

      {(dialog?.mode === "categoryCreate" ||
        dialog?.mode === "categoryEdit") && (
        <CategoryFormDialog
          open
          mode={
            dialog.mode === "categoryEdit"
              ? "edit"
              : "create"
          }
          category={
            dialog.mode === "categoryEdit"
              ? dialog.category
              : undefined
          }
          existingNames={inventoryCategories.map(
            (category) => category.nombre
          )}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
