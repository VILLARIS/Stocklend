
import { useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Handshake,
  Plus,
  Users,
} from "lucide-react";

import background from "../assets/background/background.png";

import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { StatCardV2 } from "../components/ui/StatCardV2";

import {
  StudentsToolbar,
  type StudentFilter,
} from "../components/students/StudentsToolbar";

import { StudentsTable } from "../components/students/StudentsTable";

import {
  StudentFormDialog,
  type StudentFormMode,
} from "../components/students/StudentFormDialog";

import {
  StudentDetailsDialog,
  type StudentDetailsTab,
} from "../components/students/StudentDetailsDialog";

import { DEMO_MODE } from "../data/demoData";

import {
  studentDirectorySummary,
  studentsWithSummary,
  type StudentSummary,
} from "../data/demoStudents";

const PAGE_SIZE = 8;

// ========================================
// BÚSQUEDA SIN TILDES NI MAYÚSCULAS
// ========================================

function normalizar(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// ========================================
// ESTUDIANTES
// ========================================

export function StudentsPage() {
  // ----------------------------------------
  // BÚSQUEDA Y FILTROS
  // ----------------------------------------

  const [query, setQuery] = useState("");
  const [filter, setFilter] =
    useState<StudentFilter>("todos");

  const [page, setPage] = useState(1);

  // ----------------------------------------
  // MODAL DE FORMULARIO
  // ----------------------------------------

  const [formOpen, setFormOpen] = useState(false);

  const [formMode, setFormMode] =
    useState<StudentFormMode>("create");

  const [editingStudent, setEditingStudent] =
    useState<StudentSummary | null>(null);

  // ----------------------------------------
  // MODAL DE DETALLES
  // ----------------------------------------

  const [detailsOpen, setDetailsOpen] =
    useState(false);

  const [detailsStudent, setDetailsStudent] =
    useState<StudentSummary | null>(null);

  const [detailsTab, setDetailsTab] =
    useState<StudentDetailsTab>("general");

  // ========================================
  // ACCIONES
  // ========================================

  const openCreate = () => {
    setFormMode("create");
    setEditingStudent(null);
    setFormOpen(true);
  };

  const openEdit = (student: StudentSummary) => {
    setFormMode("edit");
    setEditingStudent(student);
    setFormOpen(true);
  };

  const openDetails = (student: StudentSummary) => {
    setDetailsStudent(student);
    setDetailsTab("general");
    setDetailsOpen(true);
  };

  const openHistory = (student: StudentSummary) => {
    setDetailsStudent(student);
    setDetailsTab("historial");
    setDetailsOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
  };

  // ========================================
  // FILTRADO
  // ========================================

  const hasActiveFilters =
    query.trim() !== "" || filter !== "todos";

  const filtered = useMemo(() => {
    const term = normalizar(query);

    return studentsWithSummary.filter((student) => {
      const matchesQuery =
        term === "" ||
        normalizar(
          student.codigoUniversitario
        ).includes(term) ||
        normalizar(
          student.nombreCompleto
        ).includes(term);

      const matchesFilter =
        filter === "todos"
          ? true
          : filter === "con_prestamos"
            ? student.prestamosActivos > 0
            : filter === "sin_prestamos"
              ? student.prestamosActivos === 0
              : student.incidencias > 0;

      return matchesQuery && matchesFilter;
    });
  }, [query, filter]);

  // Reiniciar página cuando cambian los filtros.
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
      : `Mostrando ${from}–${to} de ${filtered.length} ${
          filtered.length === 1
            ? "estudiante"
            : "estudiantes"
        }`;

  // ========================================
  // LIMPIAR FILTROS
  // ========================================

  const clearAll = () => {
    setQuery("");
    setFilter("todos");
  };

  const clearQuery = () => {
    setQuery("");
  };

  const clearFilter = () => {
    setFilter("todos");
  };

  // ========================================
  // ESTADÍSTICAS
  // ========================================

  const summary = studentDirectorySummary;

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
      {/* =====================================
          ENCABEZADO PRINCIPAL
      ===================================== */}

      <div className="shrink-0">
        <PageHeader
          title="Estudiantes"
          subtitle="Gestiona los estudiantes responsables de préstamos."
          meta={
            DEMO_MODE && (
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
                    rounded-full bg-[#267BFA]
                  "
                />

                Vista de demostración
              </span>
            )
          }
          action={
            <Button
              variant="sidebar"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              Nuevo estudiante
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
            mx-auto flex w-full max-w-[1800px]
            flex-col gap-3
          "
        >
          {/* =====================================
              TARJETAS ESTADÍSTICAS
          ===================================== */}

          <section
            aria-label="Resumen de estudiantes"
            className="
              grid min-w-0 grid-cols-1 gap-3
              @[600px]:grid-cols-2
              @[1050px]:grid-cols-3
            "
          >
            {/* ESTUDIANTES REGISTRADOS */}
            <StatCardV2
              value={summary.registrados}
              label="Estudiantes registrados"
              hint="En el directorio"
              accent="blue"
              icon={<Users />}
            />

            {/* CON PRÉSTAMOS ACTIVOS */}
            <StatCardV2
              value={summary.conPrestamosActivos}
              label="Con préstamos activos"
              hint="Con unidades fuera"
              accent="violet"
              icon={<Handshake />}
            />

            {/* CON INCIDENCIAS */}
            <StatCardV2
              value={summary.conIncidencias}
              label="Con incidencias asociadas"
              hint="Responsabilidad atribuida"
              accent="orange"
              icon={<AlertTriangle />}
            />
          </section>

          {/* =====================================
              PANEL DE ESTUDIANTES
          ===================================== */}

          <section
            aria-label="Directorio de estudiantes"
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
            <StudentsToolbar
              query={query}
              onQuery={setQuery}
              filter={filter}
              onFilter={setFilter}
              hasActiveFilters={hasActiveFilters}
              onClear={clearAll}
            />

            {/* TABLA */}
            <StudentsTable
              items={pageItems}
              totalCount={studentsWithSummary.length}
              query={query}
              filterActive={filter !== "todos"}
              onClearFilters={clearFilter}
              onClearQuery={clearQuery}
              onDetails={openDetails}
              onEdit={openEdit}
              onHistory={openHistory}
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
              {/* CONTADOR */}
              <span className="tabular-nums">
                {resultLabel}
              </span>

              {/* NAVEGACIÓN */}
              <div className="flex items-center gap-2">
                <Button
                  variant="icon"
                  aria-label="Página anterior de estudiantes"
                  disabled={safePage <= 1}
                  onClick={() =>
                    setPage((value) =>
                      Math.max(1, value - 1)
                    )
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <span
                  className="
                    min-w-[100px] text-center
                    font-medium tabular-nums
                    text-[#647794]
                  "
                >
                  Página {safePage} de {totalPages}
                </span>

                <Button
                  variant="icon"
                  aria-label="Página siguiente de estudiantes"
                  disabled={safePage >= totalPages}
                  onClick={() =>
                    setPage((value) =>
                      Math.min(
                        totalPages,
                        value + 1
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
          MODAL NUEVO / EDITAR
      ===================================== */}

      <StudentFormDialog
        open={formOpen}
        mode={formMode}
        student={editingStudent ?? undefined}
        onClose={closeForm}
      />

      {/* =====================================
          MODAL DETALLES / HISTORIAL
      ===================================== */}

      <StudentDetailsDialog
        open={detailsOpen}
        student={detailsStudent}
        initialTab={detailsTab}
        onClose={closeDetails}
      />
    </div>
  );
}
