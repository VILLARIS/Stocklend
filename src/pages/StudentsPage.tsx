import { useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Handshake,
  Plus,
  Users,
} from "lucide-react";

import background from "../assets/background/background.png";

import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { StatCardV2 } from "../components/ui/StatCardV2";

import {
  StudentsToolbar,
  type StudentFilter,
} from "../components/students/StudentsToolbar";

import { StudentsTable } from "../components/students/StudentsTable";

import {
  StudentFormDialog,
  type StudentFormMode,
  type StudentFormValues,
} from "../components/students/StudentFormDialog";

import {
  StudentDetailsDialog,
  type StudentDetailsTab,
} from "../components/students/StudentDetailsDialog";

import {
  ResourceError,
  ResourceLoading,
} from "../components/students/StudentsResourceState";

import {
  useStudentMutations,
  useStudentsDirectory,
  useStudentStats,
} from "../hooks/useStudents";

import {
  adaptDirectory,
  adaptDirectoryStats,
} from "../services/studentsAdapters";

import type { StudentSummary } from "../types/students";

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

  // ----------------------------------------
  // ESCRITURAS (registro, edición, estado)
  // ----------------------------------------

  const mutations = useStudentMutations();

  const [notice, setNotice] = useState<string | null>(null);

  const [pendingToggle, setPendingToggle] =
    useState<StudentSummary | null>(null);

  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // ========================================
  // DATOS REALES (SQLite)
  // ========================================

  const directory = useStudentsDirectory();
  const stats = useStudentStats();

  const students: StudentSummary[] = useMemo(
    () =>
      directory.data
        ? adaptDirectory(directory.data).sort((a, b) =>
            a.apellidos.localeCompare(b.apellidos, "es"),
          )
        : [],
    [directory.data],
  );

  const summary = useMemo(
    () => (stats.data ? adaptDirectoryStats(stats.data) : null),
    [stats.data],
  );

  // ========================================
  // ACCIONES
  // ========================================

  const openCreate = () => {
    mutations.clearError();
    setNotice(null);
    setFormMode("create");
    setEditingStudent(null);
    setFormOpen(true);
  };

  const openEdit = (student: StudentSummary) => {
    mutations.clearError();
    setNotice(null);
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

  const refreshDirectory = () => {
    directory.refetch();
    stats.refetch();
  };

  const handleFormSubmit = async (values: StudentFormValues) => {
    const ok =
      formMode === "edit" && editingStudent !== null
        ? await mutations.actualizar(
            Number(editingStudent.id),
            values.codigo,
            values.nombres,
            values.apellidos,
          )
        : await mutations.crear(
            values.codigo,
            values.nombres,
            values.apellidos,
          );

    if (!ok) return;

    const nombreCompleto = `${values.nombres} ${values.apellidos}`;
    setFormOpen(false);
    setEditingStudent(null);
    refreshDirectory();
    setNotice(
      formMode === "edit"
        ? `Estudiante «${nombreCompleto}» actualizado.`
        : `Estudiante «${nombreCompleto}» registrado.`,
    );
  };

  const handleToggle = async (student: StudentSummary) => {
    mutations.clearError();
    setNotice(null);

    if (!student.activo) {
      const ok = await mutations.cambiarEstado(Number(student.id), true);
      if (!ok) return;
      refreshDirectory();
      setNotice(`Estudiante «${student.nombreCompleto}» reactivado.`);
      return;
    }

    setPendingToggle(student);
  };

  const confirmToggle = async () => {
    if (pendingToggle === null) return;
    const ok = await mutations.cambiarEstado(
      Number(pendingToggle.id),
      false,
    );
    if (!ok) return;
    setPendingToggle(null);
    refreshDirectory();
    setNotice(
      `Estudiante «${pendingToggle.nombreCompleto}» desactivado.`,
    );
  };

  // ========================================
  // FILTRADO
  // ========================================

  const hasActiveFilters =
    query.trim() !== "" || filter !== "todos";

  const filtered = useMemo(() => {
    const term = normalizar(query);

    return students.filter((student) => {
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
  }, [students, query, filter]);

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
              value={summary ? summary.registrados : "—"}
              label="Estudiantes registrados"
              hint="En el directorio"
              accent="blue"
              icon={<Users />}
            />

            {/* CON PRÉSTAMOS ACTIVOS */}
            <StatCardV2
              value={
                summary ? summary.conPrestamosActivos : "—"
              }
              label="Con préstamos activos"
              hint="Con unidades activas"
              accent="violet"
              icon={<Handshake />}
            />

            {/* CON INCIDENCIAS */}
            <StatCardV2
              value={summary ? summary.conIncidencias : "—"}
              label="Con incidencias"
              hint="Con responsabilidad atribuida"
              accent="orange"
              icon={<AlertTriangle />}
            />
          </section>

          {/* =====================================
              AVISO DE ESTADÍSTICAS
          ===================================== */}

          {stats.status === "error" && (
            <div
              role="alert"
              className="
                flex flex-wrap items-center gap-2.5
                rounded-[16px] border border-[#F3C9CC]
                bg-[#FDECEE] px-4 py-2.5
                text-[12px] font-medium text-[#B23540]
              "
            >
              <AlertCircle className="h-4 w-4 shrink-0" />

              <span className="min-w-0 flex-1">
                {stats.error ??
                  "No se pudieron cargar las estadísticas."}
              </span>

              <Button
                variant="secondary"
                onClick={stats.refetch}
              >
                Reintentar
              </Button>
            </div>
          )}

          {/* =====================================
              PANEL DE ESTUDIANTES
          ===================================== */}

          <section
            className="
              min-w-0 overflow-hidden
              rounded-[20px]
              border border-white/80
              bg-white/90
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

            {notice !== null && (
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
                {notice}
              </div>
            )}

            {mutations.error !== null &&
              !formOpen &&
              pendingToggle === null && (
                <div
                  role="alert"
                  className="
                    flex flex-wrap items-center gap-2.5
                    border-b border-[#F3C9CC]
                    bg-[#FDECEE]
                    px-4 py-2.5
                    text-[12px] font-medium text-[#B23540]
                  "
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />

                  <span className="min-w-0 flex-1">
                    {mutations.error}
                  </span>

                  <Button
                    variant="secondary"
                    onClick={mutations.clearError}
                  >
                    Descartar
                  </Button>
                </div>
              )}

            {directory.status === "loading" ? (
              <ResourceLoading />
            ) : directory.status === "error" ? (
              <ResourceError
                message={
                  directory.error ??
                  "No se pudo cargar el directorio de estudiantes."
                }
                onRetry={directory.refetch}
              />
            ) : (
              <>
                {/* TABLA */}
                <StudentsTable
                  items={pageItems}
                  totalCount={filtered.length}
                  query={query}
                  filterActive={filter !== "todos"}
                  onClearFilters={clearFilter}
                  onClearQuery={clearQuery}
                  onDetails={openDetails}
                  onEdit={openEdit}
                  onHistory={openHistory}
                  onToggleActive={handleToggle}
                  busy={mutations.saving}
                />

                {/* =============================
                    PAGINACIÓN
                ============================= */}

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
              </>
            )}
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
        students={students}
        saving={mutations.saving}
        serverError={formOpen ? mutations.error : null}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
      />

      {/* =====================================
          MODAL DE DETALLES
      ===================================== */}

      <StudentDetailsDialog
        open={detailsOpen}
        student={detailsStudent}
        initialTab={detailsTab}
        onClose={closeDetails}
      />

      {/* =====================================
          CONFIRMAR DESACTIVACIÓN
      ===================================== */}

      {pendingToggle !== null && (
        <Dialog
          open
          onClose={() => {
            if (!mutations.saving) setPendingToggle(null);
          }}
          title="Desactivar estudiante"
          subtitle="El estudiante dejará de aparecer como disponible para nuevos préstamos."
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                disabled={mutations.saving}
                onClick={() => setPendingToggle(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={mutations.saving}
                onClick={() => void confirmToggle()}
              >
                {mutations.saving ? "Desactivando…" : "Desactivar"}
              </Button>
            </>
          }
        >
          <p className="text-[13px] leading-6 text-[#435F92]">
            ¿Seguro que quieres desactivar a
            <strong className="text-[#1D3155]"> «{pendingToggle.nombreCompleto}»</strong>?
          </p>
          <p className="mt-2 text-[12px] leading-5 text-[#7385A4]">
            No se elimina ningún registro ni su historial. Solo dejará de
            contarse como estudiante activo del directorio.
          </p>

          {mutations.error !== null && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-1.5 text-[12px] text-[#B23540]"
            >
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{mutations.error}</span>
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
}
