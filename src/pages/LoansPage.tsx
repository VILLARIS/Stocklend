import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import background from "../assets/background/background.png";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { LoansStats } from "../components/loans/LoansStats";
import { LoansToolbar, type LoanFilter } from "../components/loans/LoansToolbar";
import { LoansTable } from "../components/loans/LoansTable";
import { LoanFormDialog } from "../components/loans/LoanFormDialog";
import { LoanDetailsDialog } from "../components/loans/LoanDetailsDialog";
import { demoLoans, type DemoLoan } from "../data/demoLoans";

const PAGE_SIZE = 8;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function LoansPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LoanFilter>("todos");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<DemoLoan | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = normalize(query);
    return demoLoans.filter((loan) => {
      const matchesQuery = !term || [loan.folio, loan.estudiante, loan.codigoUniversitario].some((value) => normalize(value).includes(term));
      const matchesStatus = filter === "todos" || loan.estado === filter;
      return matchesQuery && matchesStatus;
    });
  }, [query, filter]);

  useEffect(() => setPage(1), [query, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);
  const resultLabel = filtered.length ? `Mostrando ${from}–${to} de ${filtered.length} préstamos` : "Sin resultados";
  const clear = () => { setQuery(""); setFilter("todos"); };
  const openDetails = (loan: DemoLoan) => { setSelectedLoan(loan); setDetailsOpen(true); };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${background})` }}>
      <div className="shrink-0">
        <PageHeader title="Préstamos" subtitle="Registra y consulta entregas a estudiantes." meta={<span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 text-[11px] font-medium text-[#405783] shadow-sm"><span className="h-1.5 w-1.5 rounded-full bg-[#267BFA]" /> Vista de demostración</span>} action={<Button variant="sidebar" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Nuevo préstamo</Button>} />
      </div>
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 pt-3 @[1100px]:px-5">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3">
          <LoansStats />
          <section aria-label="Listado de préstamos" className="min-w-0 overflow-hidden rounded-[20px] border border-white/80 bg-white/95 shadow-[0_6px_24px_rgba(31,65,122,0.06)] backdrop-blur-md">
            <LoansToolbar query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} hasActiveFilters={Boolean(query.trim()) || filter !== "todos"} onClear={clear} />
            <LoansTable items={pageItems} totalCount={demoLoans.length} query={query} filterActive={filter !== "todos"} onClear={clear} onDetails={openDetails} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E9EEF6] bg-white/70 px-4 py-3 text-[12px] text-[#7385A4]"><span className="tabular-nums">{resultLabel}</span><div className="flex items-center gap-2"><Button variant="icon" aria-label="Página anterior de préstamos" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-[100px] text-center font-medium tabular-nums text-[#647794]">Página {safePage} de {totalPages}</span><Button variant="icon" aria-label="Página siguiente de préstamos" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><ChevronRight className="h-4 w-4" /></Button></div></div>
          </section>
        </div>
      </main>
      <LoanFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
      <LoanDetailsDialog open={detailsOpen} loan={selectedLoan} onClose={() => setDetailsOpen(false)} />
    </div>
  );
}
