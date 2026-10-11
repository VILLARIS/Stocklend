
import { useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Handshake,
  Plus,
  Users,
} from "lucide-react";

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

// RN-13: búsqueda parcial, sin distinguir acentos o mayúsculas.
function normalizar(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function StudentsPage() {
  // Búsqueda y filtros
  const [query, setQuery] = useState("");
  const [filter, setFilter] =
    useState<StudentFilter>("todos");

  const [page, setPage] = useState(1);

  // Formulario
  const [formOpen, setFormOpen] = useState(false);

  const [formMode, setFormMode] =
    useState<StudentFormMode>("create");

  const [editingStudent, setEditingStudent] =
    useState<StudentSummary | null>(null);

  // Detalles
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [detailsStudent, setDetailsStudent] =
    useState<StudentSummary | null>(null);

  const [detailsTab, setDetailsTab] =
    useState<StudentDetailsTab>("general");

  // Acciones
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

  const hasActiveFilters =
    query.trim() !== "" || filter !== "todos";

  // Filtrado
  const filtered = useMemo(() => {
    const term = normalizar(query);

    return studentsWithSummary.filter((student) => {
      const matchesQuery =
        term === "" ||
        normalizar(student.codigoUniversitario).includes(term) ||
        normalizar(student.nombreCompleto).includes(term);

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

  // Reiniciar paginación al filtrar
  useEffect(() => {
    setPage(1);
  }, [query, filter]);

  // Paginación
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

  const summary = studentDirectorySummary;

  return (
    <>
      {/* ENCABEZADO */}
      <PageHeader
        title="Estudiantes"
        subtitle="Gestiona los estudiantes responsables de préstamos."
        meta={
          DEMO_MODE && (
            <span
              className="
                inline-flex h-7 items-center gap-1.5
                rounded-full border border-border-soft
                bg-surface px-3 text-[11px]
                font-medium text-text-secondary
              "
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#828D9E]" />
              Datos de demostración
            </span>
          )
        }
        action={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nuevo estudiante
          </Button>
        }
      />

      {/* CONTENIDO PRINCIPAL */}
      <div
        className="
          min-h-0 flex-1 space-y-4
          overflow-y-auto
          px-5 pb-5 pt-5
          @[1200px]:px-8
        "
      >
        {/* TARJETAS ESTADÍSTICAS */}
        <section
          aria-label="Resumen de estudiantes"
          className="
            grid grid-cols-1 gap-3
            @[600px]:grid-cols-2
            @[1050px]:grid-cols-3
          "
        >
          <StatCardV2
            value={summary.registrados}
            label="Estudiantes registrados"
            hint="En el directorio"
            accent="blue"
            icon={<Users />}
          />

          <StatCardV2
            value={summary.conPrestamosActivos}
            label="Con préstamos activos"
            hint="Con unidades fuera"
            accent="violet"
            icon={<Handshake />}
          />

          <StatCardV2
            value={summary.conIncidencias}
            label="Con incidencias asociadas"
            hint="Responsabilidad atribuida"
            accent="orange"
            icon={<AlertTriangle />}
          />
        </section>

        {/* TABLA DE ESTUDIANTES */}
        <section
          className="
            min-w-0 overflow-hidden
            rounded-2xl border border-white/75
            bg-white/90
            shadow-[0_5px_22px_rgba(31,65,122,0.055)]
            backdrop-blur-md
          "
        >
          <StudentsToolbar
            query={query}
            onQuery={setQuery}
            filter={filter}
            onFilter={setFilter}
            hasActiveFilters={hasActiveFilters}
            onClear={clearAll}
          />

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

          {/* PAGINACIÓN */}
          <div
            className="
              flex flex-wrap items-center
              justify-between gap-3
              border-t border-border-soft
              px-4 py-2.5
              text-[12.5px] text-text-secondary
            "
          >
            <span className="tabular-nums">
              {resultLabel}
            </span>

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

              <span className="tabular-nums">
                Página {safePage} de {totalPages}
              </span>

              <Button
                variant="icon"
                aria-label="Página siguiente de estudiantes"
                disabled={safePage >= totalPages}
                onClick={() =>
                  setPage((value) =>
                    Math.min(totalPages, value + 1)
                  )
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* MODAL NUEVO / EDITAR */}
      <StudentFormDialog
        open={formOpen}
        mode={formMode}
        student={editingStudent ?? undefined}
        onClose={() => setFormOpen(false)}
      />

      {/* MODAL DETALLES / HISTORIAL */}
      <StudentDetailsDialog
        open={detailsOpen}
        student={detailsStudent}
        initialTab={detailsTab}
        onClose={() => setDetailsOpen(false)}
      />
    </>
  );
}
