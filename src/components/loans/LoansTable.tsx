import { useMemo } from "react";
import { ClipboardList, FilterX, SearchX } from "lucide-react";
import { DataTable, type Column } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { LoanActionsMenu } from "./LoanActionsMenu";
import { formatLoanDate, totalUnidades } from "../../data/demoLoans";
import type { DemoLoan, LoanStatus } from "../../types/loans";

interface LoansTableProps {
  items: DemoLoan[];
  totalCount: number;
  query: string;
  filterActive: boolean;
  onClear: () => void;
  onDetails: (loan: DemoLoan) => void;
}

const statusStyles: Record<LoanStatus, string> = {
  Activo: "border-[#D7E7FF] bg-[#EDF5FF] text-[#2D75DA] before:bg-[#398BFF]",
  Finalizado: "border-[#CFE9D8] bg-[#EDF8F1] text-[#1B8E57] before:bg-[#1FB56C]",
  Vencido: "border-[#F8E0BC] bg-[#FFF7E9] text-[#B87916] before:bg-[#F5AD35]",
  Anulado: "border-[#E4E8EF] bg-[#F4F6F9] text-[#64748B] before:bg-[#99A5B5]",
};

export function LoanStatusBadge({ estado }: { estado: LoanStatus }) {
  return <span className={`inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-[11.5px] font-semibold before:h-2 before:w-2 before:shrink-0 before:rounded-full ${statusStyles[estado]}`}>{estado}</span>;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

export function LoansTable({ items, totalCount, query, filterActive, onClear, onDetails }: LoansTableProps) {
  const columns = useMemo<Column<DemoLoan>[]>(() => [
    { key: "folio", header: "Préstamo", width: "165px", render: (row) => <span className="inline-flex whitespace-nowrap rounded-lg border border-[#DFEAFE] bg-[#F0F6FF] px-2.5 py-1.5 font-mono text-[11.5px] font-semibold text-[#3675C9]">{row.folio}</span> },
    { key: "estudiante", header: "Estudiante", render: (row) => <div className="flex min-w-[190px] items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D9E8FC] bg-[#EAF3FF] text-[11px] font-bold text-[#357AD7]">{initials(row.estudiante)}</span><div className="min-w-0"><p className="truncate text-[12.5px] font-semibold text-[#203659]">{row.estudiante}</p><p className="font-mono text-[10.5px] text-[#8D9CB1]">{row.codigoUniversitario}</p></div></div> },
    { key: "fechaEntrega", header: "Entrega", width: "112px", render: (row) => <span className="whitespace-nowrap text-[12px] tabular-nums text-[#536985]">{formatLoanDate(row.fechaEntrega)}</span> },
    { key: "fechaLimite", header: "Fecha límite", width: "120px", render: (row) => <span className="whitespace-nowrap text-[12px] tabular-nums text-[#536985]">{formatLoanDate(row.fechaLimite)}</span> },
    { key: "items", header: "Unidades", width: "95px", align: "right", render: (row) => <span className="inline-flex min-w-9 justify-center rounded-lg bg-[#EDF3FB] px-2 py-1 font-semibold tabular-nums text-[#46719F]">{row.unidadesPrestadas ?? totalUnidades(row)}</span> },
    { key: "estado", header: "Estado", width: "130px", render: (row) => <LoanStatusBadge estado={row.estado} /> },
    { key: "acciones", header: "Acciones", width: "80px", align: "right", render: (row) => <div className="flex justify-end"><LoanActionsMenu loan={row} onDetails={onDetails} /></div> },
  ], [onDetails]);

  return <DataTable columns={columns} data={items} keyField="id" flat onRowClick={onDetails} empty={<EmptyState icon={totalCount === 0 ? <ClipboardList /> : filterActive ? <FilterX /> : <SearchX />} title={totalCount === 0 ? "Sin préstamos registrados" : "Sin resultados"} description={totalCount === 0 ? "Todavía no hay préstamos registrados." : query.trim() ? "No hay préstamos que coincidan con la búsqueda." : "No hay préstamos con el estado seleccionado."} action={totalCount > 0 ? <Button variant="secondary" onClick={onClear}>Limpiar filtros</Button> : undefined} />} />;
}
