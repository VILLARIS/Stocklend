import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Plus,
} from "lucide-react";
import background from "../assets/background/background.png";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { LoansStats } from "../components/loans/LoansStats";
import { LoansToolbar, type LoanFilter } from "../components/loans/LoansToolbar";
import { LoansTable } from "../components/loans/LoansTable";
import { LoanFormDialog } from "../components/loans/LoanFormDialog";
import { LoanDetailsDialog } from "../components/loans/LoanDetailsDialog";
import {
  ResourceError,
  ResourceLoading,
} from "../components/students/StudentsResourceState";
import {
  useLoanMutations,
  useLoansDirectory,
  useLoanStats,
} from "../hooks/useLoans";
import { useStudentsDirectory } from "../hooks/useStudents";
import {
  useInventoryArticles,
  useInventoryUnits,
} from "../hooks/useInventory";
import { adaptLoans, adaptLoanStats } from "../services/loansAdapters";
import { adaptDirectory } from "../services/studentsAdapters";
import { normalizeText } from "../utils/normalize";
import type { DemoLoan } from "../types/loans";
import type { StudentSummary } from "../types/students";
import type {
  LoanInventorySource,
  LoanResourceStatus,
  LoanStudentSource,
} from "../types/loansForm";
import type { RegistrarPrestamoArgs } from "../services/loans";

const PAGE_SIZE = 8;

export function LoansPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LoanFilter>("todos");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<DemoLoan | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Datos reales (SQLite) a través de los hooks de la Etapa C.
  const directory = useLoansDirectory();
  const stats = useLoanStats();

  // Fuentes del formulario: estudiantes y artículos/unidades reales.
  const studentsDir = useStudentsDirectory();
  const inventoryArticles = useInventoryArticles();
  const inventoryUnits = useInventoryUnits();

  const mutations = useLoanMutations();

  const loans: DemoLoan[] = useMemo(
    () => (directory.data ? adaptLoans(directory.data) : []),
    [directory.data],
  );

  const summary = useMemo(
    () => (stats.data ? adaptLoanStats(stats.data) : null),
    [stats.data],
  );

  const students: StudentSummary[] = useMemo(
    () =>
      studentsDir.data
        ? adaptDirectory(studentsDir.data).sort((a, b) =>
            a.apellidos.localeCompare(b.apellidos, "es"),
          )
        : [],
    [studentsDir.data],
  );

  const studentSource: LoanStudentSource = {
    students,
    status: studentsDir.status,
    error: studentsDir.error,
    onRetry: studentsDir.refetch,
  };

  const inventoryStatus: LoanResourceStatus =
    inventoryArticles.status === "error" || inventoryUnits.status === "error"
      ? "error"
      : inventoryArticles.status === "success" &&
          inventoryUnits.status === "success"
        ? "success"
        : "loading";

  const inventorySource: LoanInventorySource = {
    articles: inventoryArticles.data ?? [],
    units: inventoryUnits.data ?? [],
    status: inventoryStatus,
    error: inventoryArticles.error ?? inventoryUnits.error,
    onRetry: () => {
      inventoryArticles.refetch();
      inventoryUnits.refetch();
    },
  };

  const filtered = useMemo(() => {
    const term = normalizeText(query);
    return loans.filter((loan) => {
      const matchesQuery = !term || [loan.folio, loan.estudiante, loan.codigoUniversitario].some((value) => normalizeText(value).includes(term));
      const matchesStatus = filter === "todos" || loan.estado === filter;
      return matchesQuery && matchesStatus;
    });
  }, [loans, query, filter]);

  useEffect(() => setPage(1), [query, filter]);

  // El aviso de éxito se descarta solo.
  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);
  const resultLabel = filtered.length ? `Mostrando ${from}–${to} de ${filtered.length} préstamos` : "Sin resultados";
  const clear = () => { setQuery(""); setFilter("todos"); };
  const openDetails = (loan: DemoLoan) => { setSelectedLoan(loan); setDetailsOpen(true); };

  // Refresca estudiantes e inventario antes de abrir: el formulario muestra las
  // existencias reales en el momento de preparar la entrega.
  const openForm = () => {
    mutations.clearError();
    setNotice(null);
    studentsDir.refetch();
    inventoryArticles.refetch();
    inventoryUnits.refetch();
    setFormOpen(true);
  };

  const handleRegister = async (datos: RegistrarPrestamoArgs) => {
    const creado = await mutations.registrar(datos);
    if (creado === null) return;

    setFormOpen(false);
    directory.refetch();
    stats.refetch();
    studentsDir.refetch();
    inventoryArticles.refetch();
    inventoryUnits.refetch();

    setNotice(
      `Préstamo ${creado.folio} registrado: ${creado.unidades_prestadas} ${
        creado.unidades_prestadas === 1 ? "unidad" : "unidades"
      }.`,
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${background})` }}>
      <div className="shrink-0">
        <PageHeader title="Préstamos" subtitle="Consulta las entregas de artículos a estudiantes." meta={<span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 text-[11px] font-medium text-[#405783] shadow-sm"><span className="h-1.5 w-1.5 rounded-full bg-[#267BFA]" /> Datos de la base local</span>} action={<Button variant="sidebar" onClick={openForm}><Plus className="h-4 w-4" /> Nuevo préstamo</Button>} />
      </div>
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 pt-3 @[1100px]:px-5">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3">
          <LoansStats summary={summary} />

          {stats.status === "error" && (
            <div role="alert" className="flex flex-wrap items-center gap-2.5 rounded-[16px] border border-[#F3C9CC] bg-[#FDECEE] px-4 py-2.5 text-[12px] font-medium text-[#B23540]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">{stats.error ?? "No se pudieron cargar las estadísticas de préstamos."}</span>
              <Button variant="secondary" onClick={stats.refetch}>Reintentar</Button>
            </div>
          )}

          <section aria-label="Listado de préstamos" className="min-w-0 overflow-hidden rounded-[20px] border border-white/80 bg-white/95 shadow-[0_6px_24px_rgba(31,65,122,0.06)]">
            <LoansToolbar query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} hasActiveFilters={query.trim() !== "" || filter !== "todos"} onClear={clear} />

            {notice !== null && (
              <div role="status" className="flex items-center gap-2 border-b border-[#CDEBDD] bg-[#EAF9F2] px-4 py-2 text-[12px] font-medium text-[#0F7B54]">
                <CircleCheck className="h-4 w-4 shrink-0" />
                {notice}
              </div>
            )}

            {directory.status === "loading" ? (
              <ResourceLoading />
            ) : directory.status === "error" ? (
              <ResourceError message={directory.error ?? "No se pudo cargar la lista de préstamos."} onRetry={directory.refetch} />
            ) : (
              <>
                <LoansTable items={pageItems} totalCount={loans.length} query={query} filterActive={filter !== "todos"} onClear={clear} onDetails={openDetails} />
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E9EEF6] bg-white/70 px-4 py-3 text-[12px] text-[#7385A4]"><span className="tabular-nums">{resultLabel}</span><div className="flex items-center gap-2"><Button variant="icon" aria-label="Página anterior de préstamos" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-[100px] text-center font-medium tabular-nums text-[#647794]">Página {safePage} de {totalPages}</span><Button variant="icon" aria-label="Página siguiente de préstamos" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><ChevronRight className="h-4 w-4" /></Button></div></div>
              </>
            )}
          </section>
        </div>
      </main>
      <LoanFormDialog
        open={formOpen}
        students={studentSource}
        inventory={inventorySource}
        saving={mutations.saving}
        serverError={mutations.error}
        onClose={() => setFormOpen(false)}
        onSubmit={handleRegister}
      />
      <LoanDetailsDialog open={detailsOpen} loan={selectedLoan} onClose={() => setDetailsOpen(false)} />
    </div>
  );
}
