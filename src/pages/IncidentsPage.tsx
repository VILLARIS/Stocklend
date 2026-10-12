
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";

import background from "../assets/background/background.png";

import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";

import { IncidentsStats } from "../components/incidents/IncidentsStats";

import {
  IncidentsToolbar,
  type IncidentStatusFilter,
  type IncidentTypeFilter,
} from "../components/incidents/IncidentsToolbar";

import { IncidentsTable } from "../components/incidents/IncidentsTable";
import { IncidentFormDialog } from "../components/incidents/IncidentFormDialog";
import { IncidentDetailsDialog } from "../components/incidents/IncidentDetailsDialog";

import {
  demoIncidents,
  type DemoIncident,
} from "../data/demoIncidents";

const PAGE_SIZE = 8;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function IncidentsPage() {
  // ========================================
  // FILTROS
  // ========================================

  const [query, setQuery] = useState("");

  const [type, setType] =
    useState<IncidentTypeFilter>("todos");

  const [status, setStatus] =
    useState<IncidentStatusFilter>("todos");

  const [page, setPage] = useState(1);

  // ========================================
  // MODALES
  // ========================================

  const [formOpen, setFormOpen] = useState(false);

  const [detail, setDetail] =
    useState<DemoIncident | null>(null);

  // ========================================
  // FILTRADO
  // ========================================

  const active =
    Boolean(query.trim()) ||
    type !== "todos" ||
    status !== "todos";

  const filtered = useMemo(() => {
    const term = normalize(query);

    return demoIncidents.filter((incident) => {
      const matchesQuery =
        !term ||
        [
          incident.codigo,
          incident.articulo,
          incident.estudiante,
          incident.codigoUniversitario,
          incident.prestamo,
        ].some((value) =>
          normalize(value).includes(term)
        );

      const matchesType =
        type === "todos" ||
        incident.tipo === type;

      const matchesStatus =
        status === "todos" ||
        incident.estado === status;

      return (
        matchesQuery &&
        matchesType &&
        matchesStatus
      );
    });
  }, [query, type, status]);

  // Reiniciar paginación al cambiar filtros.
  useEffect(() => {
    setPage(1);
  }, [query, type, status]);

  // ========================================
  // PAGINACIÓN
  // ========================================

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE)
  );

  const safePage = Math.min(
    page,
    totalPages
  );

  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const from =
    filtered.length > 0
      ? (safePage - 1) * PAGE_SIZE + 1
      : 0;

  const to = Math.min(
    safePage * PAGE_SIZE,
    filtered.length
  );

  const resultLabel =
    filtered.length > 0
      ? `Mostrando ${from}–${to} de ${filtered.length} incidencias`
      : "Sin resultados";

  // ========================================
  // ACCIONES
  // ========================================

  const clearFilters = () => {
    setQuery("");
    setType("todos");
    setStatus("todos");
    setPage(1);
  };

  const openCreate = () => {
    setDetail(null);
    setFormOpen(true);
  };

  const closeCreate = () => {
    setFormOpen(false);
  };

  const openDetails = (incident: DemoIncident) => {
    setFormOpen(false);
    setDetail(incident);
  };

  const closeDetails = () => {
    setDetail(null);
  };

  // ========================================
  // RENDER
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
          title="Incidentes"
          subtitle="Controla daños, pérdidas y faltantes asociados al inventario."
          meta={
            <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 text-[11px] font-medium text-[#405783] shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#267BFA]" />
              Vista de demostración
            </span>
          }
          action={
            <Button
              variant="sidebar"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              Nueva incidencia
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
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3">
          {/* ESTADÍSTICAS */}
          <IncidentsStats />

          {/* PANEL */}
          <section
            aria-label="Listado de incidencias"
            className="
              min-w-0 overflow-hidden
              rounded-[20px]
              border border-white/80
              bg-white/95
              shadow-[0_6px_24px_rgba(31,65,122,0.06)]
              backdrop-blur-md
            "
          >
            {/* FILTROS */}
            <IncidentsToolbar
              query={query}
              onQuery={setQuery}
              type={type}
              onType={setType}
              status={status}
              onStatus={setStatus}
              active={active}
              onClear={clearFilters}
            />

            {/* TABLA */}
            <IncidentsTable
              items={pageItems}
              totalCount={demoIncidents.length}
              filtered={active}
              onClear={clearFilters}
              onDetails={openDetails}
            />

            {/* PAGINACIÓN */}
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
              <span className="tabular-nums">
                {resultLabel}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="icon"
                  aria-label="Página anterior de incidencias"
                  disabled={safePage <= 1}
                  onClick={() =>
                    setPage((previous) =>
                      Math.max(1, previous - 1)
                    )
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <span className="min-w-[100px] text-center font-medium tabular-nums text-[#647794]">
                  Página {safePage} de {totalPages}
                </span>

                <Button
                  variant="icon"
                  aria-label="Página siguiente de incidencias"
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

      {/* NUEVA INCIDENCIA */}
      <IncidentFormDialog
        open={formOpen}
        onClose={closeCreate}
      />

      {/* DETALLES */}
      <IncidentDetailsDialog
        open={detail !== null}
        incident={detail}
        onClose={closeDetails}
      />
    </div>
  );
}
