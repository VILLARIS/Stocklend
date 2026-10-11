import { useEffect, useMemo, useState } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
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
import { UnitsToolbar, type UnitStateFilter } from "../components/inventory/UnitsToolbar";
import { UnitsTable } from "../components/inventory/UnitsTable";
import { UnitDetailsDialog } from "../components/inventory/UnitDetailsDialog";
import {
  DEMO_MODE,
} from "../data/demoData";
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

export function InventoryPage() {
  const [tab, setTab] = useState<InventoryTabKey>("articulos");
  const [query, setQuery] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [estado, setEstado] = useState<AvailabilityFilter>("todos");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [unitQuery, setUnitQuery] = useState("");
  const [unitCategoria, setUnitCategoria] = useState("todas");
  const [unitEstado, setUnitEstado] = useState<UnitStateFilter>("todos");
  const [unitPage, setUnitPage] = useState(1);
  const [categoryQuery, setCategoryQuery] = useState("");

  const hasCategoryFilter = categoryQuery.trim() !== "";

  const filteredCategories = useMemo(() => {
    const term = categoryQuery.trim().toLowerCase();
    return term === ""
      ? inventoryCategories
      : inventoryCategories.filter((categoriaItem) =>
          categoriaItem.nombre.toLowerCase().includes(term),
        );
  }, [categoryQuery]);

  const hasActiveFilters =
    query.trim() !== "" || categoria !== "todas" || estado !== "todos";

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return inventoryArticles.filter((article) => {
      const matchesQuery =
        term === "" ||
        article.nombre.toLowerCase().includes(term) ||
        (article.codigo?.toLowerCase().includes(term) ?? false);

      const matchesCategoria =
        categoria === "todas" || article.categoria === categoria;

      const total =
        article.disponible + article.prestado + article.danado + article.faltante;
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

  useEffect(() => {
    setUnitPage(1);
  }, [unitQuery, unitCategoria, unitEstado, tab]);

  const hasActiveUnitFilters =
    unitQuery.trim() !== "" || unitCategoria !== "todas" || unitEstado !== "todos";

  const unitCategories = useMemo(
    () => Array.from(new Set(inventoryUnits.map((unit) => unit.categoria))).sort(),
    [],
  );

  const filteredUnits = useMemo(() => {
    const term = unitQuery.trim().toLowerCase();
    return inventoryUnits.filter((unit) => {
      const matchesQuery =
        term === "" ||
        unit.codigo.toLowerCase().includes(term) ||
        unit.articulo.toLowerCase().includes(term);

      const matchesCategoria =
        unitCategoria === "todas" || unit.categoria === unitCategoria;

      const matchesEstado = unitEstado === "todos" || unit.estado === unitEstado;

      return matchesQuery && matchesCategoria && matchesEstado;
    });
  }, [unitQuery, unitCategoria, unitEstado]);

  const clearUnitFilters = () => {
    setUnitQuery("");
    setUnitCategoria("todas");
    setUnitEstado("todos");
  };

  const unitTotalPages = Math.max(1, Math.ceil(filteredUnits.length / PAGE_SIZE));
  const unitSafePage = Math.min(unitPage, unitTotalPages);
  const unitItems = filteredUnits.slice(
    (unitSafePage - 1) * PAGE_SIZE,
    unitSafePage * PAGE_SIZE,
  );
  const unitFrom =
    filteredUnits.length === 0 ? 0 : (unitSafePage - 1) * PAGE_SIZE + 1;
  const unitTo = Math.min(unitSafePage * PAGE_SIZE, filteredUnits.length);
  const unitResultLabel =
    filteredUnits.length === 0
      ? "Sin resultados"
      : `Mostrando ${unitFrom}–${unitTo} de ${filteredUnits.length} ${
          filteredUnits.length === 1 ? "unidad" : "unidades"
        }`;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const clearFilters = () => {
    setQuery("");
    setCategoria("todas");
    setEstado("todos");
  };

  const viewCategoryArticles = (category: InventoryCategory) => {
    setCategoria(category.nombre);
    setQuery("");
    setEstado("todos");
    setTab("articulos");
  };

  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);
  const resultLabel =
    filtered.length === 0
      ? "Sin resultados"
      : `Mostrando ${from}–${to} de ${filtered.length} ${
          filtered.length === 1 ? "artículo" : "artículos"
        }`;

  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle="Gestiona los artículos, equipos y existencias del almacén"
        meta={
          DEMO_MODE && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border-soft bg-surface px-3 text-[11px] font-medium text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-[#828D9E]" />
              Datos de demostración
            </span>
          )
        }
        action={
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nuevo artículo
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-6 pt-5">
        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
          <InventoryTabs value={tab} onChange={setTab} />

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
                activeCategory={categoria !== "todas" ? categoria : null}
                onClear={clearFilters}
                onEdit={(item) => setDialog({ mode: "edit", article: item })}
                onDetails={(item) =>
                  setDialog({ mode: "details", article: item })
                }
              />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft px-4 py-2.5 text-[12.5px] text-text-secondary">
                <span className="tabular-nums">{resultLabel}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="icon"
                    aria-label="Página anterior"
                    disabled={safePage <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="tabular-nums">
                    Página {safePage} de {totalPages}
                  </span>
                  <Button
                    variant="icon"
                    aria-label="Página siguiente"
                    disabled={safePage >= totalPages}
                    onClick={() =>
                      setPage((value) => Math.min(totalPages, value + 1))
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

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
                onDetails={(unit) => setDialog({ mode: "unitDetails", unit })}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft px-4 py-2.5 text-[12.5px] text-text-secondary">
                <span className="tabular-nums">{unitResultLabel}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="icon"
                    aria-label="Página anterior de unidades"
                    disabled={unitSafePage <= 1}
                    onClick={() =>
                      setUnitPage((value) => Math.max(1, value - 1))
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="tabular-nums">
                    Página {unitSafePage} de {unitTotalPages}
                  </span>
                  <Button
                    variant="icon"
                    aria-label="Página siguiente de unidades"
                    disabled={unitSafePage >= unitTotalPages}
                    onClick={() =>
                      setUnitPage((value) => Math.min(unitTotalPages, value + 1))
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {tab === "categorias" && (
            <div
              role="tabpanel"
              id="inv-panel-categorias"
              aria-labelledby="inv-tab-categorias"
            >
              <div className="border-b border-border-soft px-4 py-3">
                <CategoriesToolbar
                  query={categoryQuery}
                  onQuery={setCategoryQuery}
                  resultCount={filteredCategories.length}
                  totalCount={inventoryCategories.length}
                  onNew={() => setDialog({ mode: "categoryCreate" })}
                />
              </div>

              <CategoriesTable
                items={filteredCategories}
                filtered={hasCategoryFilter}
                onClear={() => setCategoryQuery("")}
                onNew={() => setDialog({ mode: "categoryCreate" })}
                onViewArticles={viewCategoryArticles}
                onEdit={(categoryItem) =>
                  setDialog({ mode: "categoryEdit", category: categoryItem })
                }
              />
            </div>
          )}
        </div>
      </div>

      {(dialog?.mode === "create" || dialog?.mode === "edit") && (
        <ArticleFormDialog
          open
          mode={dialog.mode}
          article={dialog.mode === "edit" ? dialog.article : undefined}
          unidades={
            dialog.mode === "edit"
              ? inventoryUnits.filter(
                  (unit) => unit.articulo === dialog.article.nombre,
                )
              : []
          }
          categorias={inventoryCategoryNames}
          existingNames={inventoryArticles.map((item) => item.nombre)}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.mode === "details" && (
        <ArticleDetailsDialog
          open
          article={dialog.article}
          unidades={inventoryUnits.filter(
            (unit) => unit.articulo === dialog.article.nombre,
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

      {(dialog?.mode === "categoryCreate" || dialog?.mode === "categoryEdit") && (
        <CategoryFormDialog
          open
          mode={dialog.mode === "categoryEdit" ? "edit" : "create"}
          category={dialog.mode === "categoryEdit" ? dialog.category : undefined}
          existingNames={inventoryCategories.map((item) => item.nombre)}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
