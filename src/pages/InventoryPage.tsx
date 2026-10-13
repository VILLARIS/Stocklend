
import { useEffect, useMemo, useState } from "react";

import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Package,
  Boxes,
  CircleCheck,
  ArrowRightLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";

import background from "../assets/background/background.png";

import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";

import {
  InventoryTabs,
  type InventoryTabKey,
} from "../components/inventory/InventoryTabs";

import {
  InventoryToolbar,
  type AvailabilityFilter,
} from "../components/inventory/InventoryToolbar";

import { InventoryTable } from "../components/inventory/InventoryTable";
import {
  ArticleFormDialog,
  type ArticleFormValues,
} from "../components/inventory/ArticleFormDialog";
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

import type {
  InventoryArticle,
  InventoryUnit,
  InventoryCategory,
} from "../data/inventoryData";

import {
  useInventoryArticles,
  useInventoryUnits,
  useInventoryCategories,
  useInventoryStats,
  useInventoryCategoryMutations,
  useInventoryArticleMutations,
} from "../hooks/useInventory";

import {
  adaptArticles,
  adaptUnits,
  adaptCategories,
} from "../services/inventoryAdapters";

const PAGE_SIZE = 8;

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; article: InventoryArticle }
  | { mode: "details"; article: InventoryArticle }
  | { mode: "unitDetails"; unit: InventoryUnit }
  | { mode: "categoryCreate" }
  | { mode: "categoryEdit"; category: InventoryCategory };

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

function LoadingOverlay() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[#267BFA]" />
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
      <AlertCircle className="h-8 w-8 text-[#E43F50]" />
      <p className="max-w-md text-center text-[13px] text-[#435F92]">{message}</p>
      <Button variant="secondary" onClick={onRetry}>Reintentar</Button>
    </div>
  );
}

export function InventoryPage() {
  const [tab, setTab] = useState<InventoryTabKey>("articulos");

  const [query, setQuery] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [estado, setEstado] =
    useState<AvailabilityFilter>("todos");
  const [page, setPage] = useState(1);

  const [unitQuery, setUnitQuery] = useState("");
  const [unitCategoria, setUnitCategoria] = useState("todas");
  const [unitEstado, setUnitEstado] =
    useState<UnitStateFilter>("todos");
  const [unitPage, setUnitPage] = useState(1);

  const [categoryQuery, setCategoryQuery] = useState("");

  const [dialog, setDialog] = useState<DialogState | null>(null);

  const articles = useInventoryArticles();
  const units = useInventoryUnits();
  const categories = useInventoryCategories();
  const stats = useInventoryStats();

  const adaptedArticles = useMemo(
    () => (articles.data ? adaptArticles(articles.data) : []),
    [articles.data],
  );
  const adaptedUnits = useMemo(
    () => (units.data ? adaptUnits(units.data) : []),
    [units.data],
  );
  const adaptedCategories = useMemo(
    () => (categories.data ? adaptCategories(categories.data) : []),
    [categories.data],
  );

  const inventoryArticles: InventoryArticle[] = useMemo(
    () => adaptedArticles.map(({ id, nombre, codigo, categoria: cat, categoriaId, notas, disponible, prestado, danado, faltante, prestable, controlIndividual }) => ({
      id, nombre, codigo, categoria: cat, categoriaId, notas, disponible, prestado, danado, faltante, prestable, controlIndividual,
    })),
    [adaptedArticles],
  );

  const inventoryUnits: InventoryUnit[] = useMemo(
    () => adaptedUnits.map(({ id, codigo, articulo, categoria: cat, estado: est, estudiante, prestamo, prestamoFecha, prestamoEstado, incidente, incidenteTipo, incidenteEstado }) => ({
      id, codigo, articulo, categoria: cat, estado: est, estudiante, prestamo, prestamoFecha, prestamoEstado, incidente, incidenteTipo, incidenteEstado,
    })),
    [adaptedUnits],
  );

  const inventoryCategories: InventoryCategory[] = useMemo(
    () => adaptedCategories.map(({ id, nombre, descripcion, articulos: art, activo }) => ({
      id, nombre, descripcion, articulos: art, activo,
    })),
    [adaptedCategories],
  );

  const inventoryCategoryNames = useMemo(
    () => inventoryCategories.map((c) => c.nombre),
    [inventoryCategories],
  );

  const articleCategoryOptions = useMemo(
    () =>
      inventoryCategories.map((categoria) => ({
        id: Number(categoria.id),
        nombre: categoria.nombre,
        activo: categoria.activo ?? true,
      })),
    [inventoryCategories],
  );

  const existingArticles = useMemo(
    () =>
      inventoryArticles.map((article) => ({
        id: article.id,
        nombre: article.nombre,
        categoriaId: article.categoriaId ?? -1,
      })),
    [inventoryArticles],
  );

  const categoryMutations = useInventoryCategoryMutations();
  const articleMutations = useInventoryArticleMutations();

  const [categoryNotice, setCategoryNotice] = useState<string | null>(null);
  const [pendingDeactivate, setPendingDeactivate] =
    useState<InventoryCategory | null>(null);
  const [articleNotice, setArticleNotice] = useState<string | null>(null);

  const isCategoryDialogOpen =
    dialog?.mode === "categoryCreate" || dialog?.mode === "categoryEdit";

  useEffect(() => {
    if (categoryNotice === null) return;
    const timer = window.setTimeout(() => setCategoryNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [categoryNotice]);

  useEffect(() => {
    if (articleNotice === null) return;
    const timer = window.setTimeout(() => setArticleNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [articleNotice]);

  const openArticleCreate = () => {
    articleMutations.clearError();
    setArticleNotice(null);
    setDialog({ mode: "create" });
  };

  const openArticleEdit = (article: InventoryArticle) => {
    articleMutations.clearError();
    setArticleNotice(null);
    setDialog({ mode: "edit", article });
  };

  const refreshAfterArticleChange = () => {
    articles.refetch();
    categories.refetch();
    stats.refetch();
    units.refetch();
  };

  const handleCreateArticle = async (values: ArticleFormValues) => {
    const ok = await articleMutations.crear({
      nombre: values.nombre,
      categoria_id: values.categoriaId,
      cantidad_inicial: values.cantidadInicial,
      control_individual: values.controlIndividual,
      prestable: values.prestable,
      notas: values.notas,
      unidades: values.unidades,
    });
    if (!ok) return;
    setDialog(null);
    refreshAfterArticleChange();
    setArticleNotice(`Artículo «${values.nombre}» creado.`);
  };

  const handleUpdateArticle = async (
    article: InventoryArticle,
    values: ArticleFormValues,
  ) => {
    const ok = await articleMutations.actualizar({
      id: Number(article.id),
      nombre: values.nombre,
      categoria_id: values.categoriaId,
      prestable: values.prestable,
      notas: values.notas,
    });
    if (!ok) return;
    setDialog(null);
    refreshAfterArticleChange();
    setArticleNotice(`Artículo «${values.nombre}» actualizado.`);
  };

  const handleArticleSubmit = (values: ArticleFormValues) => {
    if (dialog?.mode === "edit") {
      void handleUpdateArticle(dialog.article, values);
    } else if (dialog?.mode === "create") {
      void handleCreateArticle(values);
    }
  };

  const openCategoryCreate = () => {
    categoryMutations.clearError();
    setCategoryNotice(null);
    setDialog({ mode: "categoryCreate" });
  };

  const openCategoryEdit = (category: InventoryCategory) => {
    categoryMutations.clearError();
    setCategoryNotice(null);
    setDialog({ mode: "categoryEdit", category });
  };

  const handleCreateCategory = async (values: {
    nombre: string;
    descripcion: string | null;
  }) => {
    const ok = await categoryMutations.crear(values.nombre, values.descripcion);
    if (!ok) return;
    setDialog(null);
    categories.refetch();
    setCategoryNotice(`Categoría «${values.nombre}» creada.`);
  };

  const handleUpdateCategory = async (
    category: InventoryCategory,
    values: { nombre: string; descripcion: string | null },
  ) => {
    const ok = await categoryMutations.actualizar(
      Number(category.id),
      values.nombre,
      values.descripcion,
    );
    if (!ok) return;
    setDialog(null);
    categories.refetch();

    if (values.nombre !== category.nombre) {
      if (categoria === category.nombre) setCategoria(values.nombre);
      if (unitCategoria === category.nombre) setUnitCategoria(values.nombre);
      articles.refetch();
      stats.refetch();
    }
    setCategoryNotice(`Categoría «${values.nombre}» actualizada.`);
  };

  const handleCategorySubmit = (values: {
    nombre: string;
    descripcion: string | null;
  }) => {
    if (dialog?.mode === "categoryEdit") {
      void handleUpdateCategory(dialog.category, values);
    } else if (dialog?.mode === "categoryCreate") {
      void handleCreateCategory(values);
    }
  };

  const handleToggleCategory = async (category: InventoryCategory) => {
    categoryMutations.clearError();
    setCategoryNotice(null);
    if (category.activo === false) {
      const ok = await categoryMutations.cambiarEstado(Number(category.id), true);
      if (!ok) return;
      categories.refetch();
      setCategoryNotice(`Categoría «${category.nombre}» reactivada.`);
    } else {
      setPendingDeactivate(category);
    }
  };

  const confirmDeactivate = async () => {
    if (pendingDeactivate === null) return;
    const ok = await categoryMutations.cambiarEstado(
      Number(pendingDeactivate.id),
      false,
    );
    if (!ok) return;
    setPendingDeactivate(null);
    categories.refetch();
    setCategoryNotice(`Categoría «${pendingDeactivate.nombre}» desactivada.`);
  };

  const anyLoading = articles.status === "loading" || units.status === "loading" || categories.status === "loading" || stats.status === "loading";
  const anyError = articles.status === "error" || units.status === "error" || categories.status === "error" || stats.status === "error";
  const errorMessage = articles.error || units.error || categories.error || stats.error || "";

  const summary = useMemo(() => {
    if (stats.data) {
      return {
        units: stats.data.unidades_totales,
        available: stats.data.unidades_disponibles,
        loaned: stats.data.unidades_prestadas,
        registered: stats.data.articulos_registrados,
      };
    }
    return adaptedArticles.reduce(
      (acc, article) => {
        acc.units += article.disponible + article.prestado + article.danado + article.faltante;
        acc.available += article.disponible;
        acc.loaned += article.prestado;
        acc.registered += 1;
        return acc;
      },
      { units: 0, available: 0, loaned: 0, registered: 0 },
    );
  }, [stats.data, adaptedArticles]);

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
  }, [inventoryArticles, query, categoria, estado]);

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
      : `Mostrando ${from}\u2013${to} de ${filtered.length} ${
          filtered.length === 1 ? "artículo" : "artículos"
        }`;

  const clearFilters = () => {
    setQuery("");
    setCategoria("todas");
    setEstado("todos");
  };

  const hasActiveUnitFilters =
    unitQuery.trim() !== "" ||
    unitCategoria !== "todas" ||
    unitEstado !== "todos";

  const unitCategories = useMemo(() => {
    return Array.from(
      new Set(inventoryUnits.map((unit) => unit.categoria))
    ).sort();
  }, [inventoryUnits]);

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
  }, [inventoryUnits, unitQuery, unitCategoria, unitEstado]);

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
      : `Mostrando ${unitFrom}\u2013${unitTo} de ${
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

  const hasCategoryFilter =
    categoryQuery.trim() !== "";

  const filteredCategories = useMemo(() => {
    const term = categoryQuery.trim().toLowerCase();

    return term === ""
      ? inventoryCategories
      : inventoryCategories.filter((category) =>
          category.nombre.toLowerCase().includes(term)
        );
  }, [inventoryCategories, categoryQuery]);

  const viewCategoryArticles = (
    category: InventoryCategory
  ) => {
    setCategoria(category.nombre);
    setQuery("");
    setEstado("todos");
    setTab("articulos");
  };

  const retryAll = () => {
    articles.refetch();
    units.refetch();
    categories.refetch();
    stats.refetch();
  };

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
      <div className="shrink-0">
        <PageHeader
          title="Inventario"
          subtitle="Gestiona los artículos, equipos y existencias del almacén"
          meta={
            <span
              className="
                inline-flex h-8 items-center gap-2
                rounded-full border border-white/80
                bg-white/90 px-3
                text-[11px] font-medium
                text-[#405783] shadow-sm
              "
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#F59B22]" />
              Los cambios se guardarán al habilitar el registro de datos
            </span>
          }
          action={
            <Button
              variant="sidebar"
              onClick={openArticleCreate}
            >
              <Plus className="h-4 w-4" />
              Nuevo artículo
            </Button>
          }
        />
      </div>

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
          <section
            aria-label="Resumen del inventario"
            className="
              grid min-w-0 grid-cols-1 gap-3
              @[560px]:grid-cols-2
              @[960px]:grid-cols-4
            "
          >
            <InventoryStatCard
              value={summary.registered}
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
            <InventoryTabs
              value={tab}
              onChange={setTab}
            />

            {anyError && !anyLoading ? (
              <ErrorBanner message={errorMessage} onRetry={retryAll} />
            ) : (
              <>
                {tab === "articulos" && (
                  <div
                    role="tabpanel"
                    id="inv-panel-articulos"
                    aria-labelledby="inv-tab-articulos"
                  >
                    {articleNotice !== null && (
                      <div
                        role="status"
                        className="
                          flex items-center gap-2
                          border-b border-[#CDEBDD]
                          bg-[#EAF9F2]
                          px-4 py-2
                          text-[12px] font-medium
                          text-[#0F7B54]
                        "
                      >
                        <CircleCheck className="h-4 w-4 shrink-0" />
                        {articleNotice}
                      </div>
                    )}

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

                    {articles.status === "loading" ? (
                      <LoadingOverlay />
                    ) : articles.status === "error" ? (
                      <ErrorBanner message={articles.error || ""} onRetry={articles.refetch} />
                    ) : (
                      <>
                        <InventoryTable
                          items={pageItems}
                          filtered={hasActiveFilters}
                          activeCategory={
                            categoria !== "todas"
                              ? categoria
                              : null
                          }
                          onClear={clearFilters}
                          onEdit={openArticleEdit}
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
                      </>
                    )}
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

                    {units.status === "loading" ? (
                      <LoadingOverlay />
                    ) : units.status === "error" ? (
                      <ErrorBanner message={units.error || ""} onRetry={units.refetch} />
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                )}

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
                        onNew={openCategoryCreate}
                      />
                    </div>

                    {categoryNotice !== null && (
                      <div
                        role="status"
                        className="
                          flex items-center gap-2
                          border-b border-[#CDEBDD]
                          bg-[#EAF9F2]
                          px-4 py-2
                          text-[12px] font-medium
                          text-[#0F7B54]
                        "
                      >
                        <CircleCheck className="h-4 w-4 shrink-0" />
                        {categoryNotice}
                      </div>
                    )}

                    {categoryMutations.error !== null &&
                      !isCategoryDialogOpen &&
                      pendingDeactivate === null && (
                        <div
                          role="alert"
                          className="
                            flex items-center gap-2
                            border-b border-[#F3C9CC]
                            bg-[#FDECEE]
                            px-4 py-2
                            text-[12px] font-medium
                            text-[#B23540]
                          "
                        >
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">
                            {categoryMutations.error}
                          </span>
                          <button
                            type="button"
                            onClick={categoryMutations.clearError}
                            className="shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold text-[#B23540] hover:bg-[#F9DDE0]"
                          >
                            Cerrar
                          </button>
                        </div>
                      )}

                    {categories.status === "loading" ? (
                      <LoadingOverlay />
                    ) : categories.status === "error" ? (
                      <ErrorBanner message={categories.error || ""} onRetry={categories.refetch} />
                    ) : (
                      <CategoriesTable
                        items={filteredCategories}
                        filtered={hasCategoryFilter}
                        busy={categoryMutations.saving}
                        onClear={() =>
                          setCategoryQuery("")
                        }
                        onNew={openCategoryCreate}
                        onViewArticles={viewCategoryArticles}
                        onEdit={openCategoryEdit}
                        onToggleActive={handleToggleCategory}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

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
          categorias={articleCategoryOptions}
          existingArticles={existingArticles}
          saving={articleMutations.saving}
          serverError={articleMutations.error}
          onClose={() => setDialog(null)}
          onSubmit={handleArticleSubmit}
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
          saving={categoryMutations.saving}
          serverError={categoryMutations.error}
          onClose={() => setDialog(null)}
          onSubmit={handleCategorySubmit}
        />
      )}

      {pendingDeactivate !== null && (
        <Dialog
          open
          onClose={() => {
            if (!categoryMutations.saving) setPendingDeactivate(null);
          }}
          title="Desactivar categoría"
          subtitle="La categoría dejará de estar disponible para nuevos registros."
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                disabled={categoryMutations.saving}
                onClick={() => setPendingDeactivate(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={categoryMutations.saving}
                onClick={() => void confirmDeactivate()}
              >
                {categoryMutations.saving ? "Desactivando…" : "Desactivar"}
              </Button>
            </>
          }
        >
          <p className="text-[13px] leading-6 text-[#435F92]">
            ¿Seguro que quieres desactivar la categoría
            <strong className="text-[#1D3155]"> «{pendingDeactivate.nombre}»</strong>?
          </p>
          <p className="mt-2 text-[12px] leading-5 text-[#7385A4]">
            No se elimina ni se modifica ningún artículo. Solo dejará de
            aparecer como opción al registrar artículos nuevos.
            {pendingDeactivate.articulos > 0 && (
              <>
                {" "}Actualmente agrupa {pendingDeactivate.articulos}{" "}
                {pendingDeactivate.articulos === 1 ? "artículo" : "artículos"}.
              </>
            )}
          </p>

          {categoryMutations.error !== null && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-1.5 text-[12px] text-[#B23540]"
            >
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{categoryMutations.error}</span>
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
}
