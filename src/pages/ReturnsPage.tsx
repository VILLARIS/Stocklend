
import { useEffect, useMemo, useState } from "react";

import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";

import background from "../assets/background/background.png";

import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";

import { ReturnsStats } from "../components/returns/ReturnsStats";

import {
  ReturnsToolbar,
  type ReturnFilter,
} from "../components/returns/ReturnsToolbar";

import { ReturnsTable } from "../components/returns/ReturnsTable";

import { ReturnDetailsDialog } from "../components/returns/ReturnDetailsDialog";
import { ReturnFormDialog } from "../components/returns/ReturnFormDialog";

import {
  demoReturns,
  type ReturnRecord,
} from "../data/demoReturns";

// ========================================
// CONFIGURACIÓN
// ========================================

const PAGE_SIZE = 8;

// ========================================
// UTILIDADES
// ========================================

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// ========================================
// PÁGINA DE DEVOLUCIONES
// ========================================

export function ReturnsPage() {
  // ----------------------------------------
  // BÚSQUEDA Y FILTROS
  // ----------------------------------------

  const [query, setQuery] = useState("");

  const [filter, setFilter] =
    useState<ReturnFilter>("todos");

  const [page, setPage] = useState(1);

  // ----------------------------------------
  // MODAL DE DEVOLUCIÓN
  // ----------------------------------------

  const [formOpen, setFormOpen] = useState(false);

  const [formLoan, setFormLoan] =
    useState<ReturnRecord | null>(null);

  // ----------------------------------------
  // MODAL DE DETALLES
  // ----------------------------------------

  const [detailLoan, setDetailLoan] =
    useState<ReturnRecord | null>(null);

  // ========================================
  // FILTROS
  // ========================================

  const hasActiveFilters =
    query.trim() !== "" || filter !== "todos";

  const filtered = useMemo(() => {
    const term = normalize(query);

    return demoReturns.filter((loan) => {
      const matchesQuery =
        term === "" ||
        [
          loan.folio,
          loan.estudiante,
          loan.codigoUniversitario,
        ].some((value) =>
          normalize(value ?? "").includes(term)
        );

      const matchesFilter =
        filter === "todos" ||
        loan.estadoDevolucion === filter;

      return matchesQuery && matchesFilter;
    });
  }, [query, filter]);

  // ========================================
  // REINICIAR PAGINACIÓN AL FILTRAR
  // ========================================

  useEffect(() => {
    setPage(1);
  }, [query, filter]);

  // ========================================
  // PAGINACIÓN
  // ========================================

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
      : `Mostrando ${from}–${to} de ${
          filtered.length
        } ${
          filtered.length === 1
            ? "devolución"
            : "devoluciones"
        }`;

  // ========================================
  // LIMPIAR FILTROS
  // ========================================

  const clearFilters = () => {
    setQuery("");
    setFilter("todos");
    setPage(1);
  };

  // ========================================
  // ACCIONES: MODAL DE DEVOLUCIÓN
  // ========================================

  const openReturnForm = (
    loan: ReturnRecord | null = null
  ) => {
    // Evita tener dos modales abiertos a la vez.
    setDetailLoan(null);

    setFormLoan(loan);
    setFormOpen(true);
  };

  const closeReturnForm = () => {
    setFormOpen(false);
    setFormLoan(null);
  };

  // ========================================
  // ACCIONES: DETALLES
  // ========================================

  const openDetails = (loan: ReturnRecord) => {
    setFormOpen(false);
    setDetailLoan(loan);
  };

  const closeDetails = () => {
    setDetailLoan(null);
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <div
      className="
        flex min-h-0 min-w-0
        flex-1 flex-col
        overflow-hidden
        bg-cover bg-center bg-no-repeat
      "
      style={{
        backgroundImage: `url(${background})`,
      }}
    >
      {/* =====================================
          ENCABEZADO
      ===================================== */}

      <div className="shrink-0">
        <PageHeader
          title="Devoluciones"
          subtitle="Controla los artículos devueltos y los pendientes por recibir."
          meta={
            <span
              className="
                inline-flex h-8 items-center gap-2
                rounded-full
                border border-white/80
                bg-white/90 px-3
                text-[11px] font-medium
                text-[#405783]
                shadow-sm
              "
            >
              <span
                className="
                  h-1.5 w-1.5
                  rounded-full
                  bg-[#267BFA]
                "
              />

              Vista de demostración
            </span>
          }
          action={
            <Button
              variant="sidebar"
              onClick={() => openReturnForm()}
            >
              <Plus className="h-4 w-4" />
              Nueva devolución
            </Button>
          }
        />
      </div>

      {/* =====================================
          CONTENIDO PRINCIPAL
      ===================================== */}

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
            mx-auto flex w-full
            max-w-[1800px]
            flex-col gap-3
          "
        >
          {/* =====================================
              TARJETAS ESTADÍSTICAS
          ===================================== */}

          <section aria-label="Resumen de devoluciones">
            <ReturnsStats />
          </section>

          {/* =====================================
              PANEL PRINCIPAL
          ===================================== */}

          <section
            aria-label="Listado de devoluciones"
            className="
              min-w-0 overflow-hidden
              rounded-[20px]
              border border-white/80
              bg-white/95

              shadow-[0_6px_24px_rgba(31,65,122,0.06)]
              backdrop-blur-md
            "
          >
            {/* BUSCADOR Y FILTROS */}
            <ReturnsToolbar
              query={query}
              onQuery={setQuery}
              filter={filter}
              onFilter={setFilter}
              hasActiveFilters={hasActiveFilters}
              onClear={clearFilters}
            />

            {/* TABLA */}
            <ReturnsTable
              items={pageItems}
              totalCount={demoReturns.length}
              filtered={hasActiveFilters}
              onClear={clearFilters}
              onDetails={openDetails}
              onReturn={(loan) => openReturnForm(loan)}
            />

            {/* =================================
                PAGINACIÓN
            ================================= */}

            <div
              className="
                flex flex-wrap items-center
                justify-between gap-3
                border-t border-[#E9EEF6]
                bg-white/70
                px-4 py-3
                text-[12px] text-[#7385A4]
              "
            >
              {/* TOTAL DE RESULTADOS */}
              <span className="tabular-nums">
                {resultLabel}
              </span>

              {/* BOTONES DE PAGINACIÓN */}
              <div className="flex items-center gap-2">
                <Button
                  variant="icon"
                  aria-label="Página anterior de devoluciones"
                  title="Página anterior"
                  disabled={safePage <= 1}
                  onClick={() =>
                    setPage((previous) =>
                      Math.max(1, previous - 1)
                    )
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <span
                  className="
                    min-w-[100px]
                    text-center font-medium
                    tabular-nums
                    text-[#647794]
                  "
                >
                  Página {safePage} de {totalPages}
                </span>

                <Button
                  variant="icon"
                  aria-label="Página siguiente de devoluciones"
                  title="Página siguiente"
                  disabled={safePage >= totalPages}
                  onClick={() =>
                    setPage((previous) =>
                      Math.min(
                        totalPages,
                        previous + 1
                      )
                    )
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* =====================================
          MODAL DE DETALLES
      ===================================== */}

      <ReturnDetailsDialog
        open={detailLoan !== null}
        loan={detailLoan}
        onClose={closeDetails}
        onReturn={(loan) => openReturnForm(loan)}
      />

      {/* =====================================
          MODAL NUEVA DEVOLUCIÓN
      ===================================== */}

      <ReturnFormDialog
        open={formOpen}
        loan={formLoan}
        onClose={closeReturnForm}
      />
    </div>
  );
}
