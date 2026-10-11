import { CalendarDays, GraduationCap, Hash, Info, UserRound } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { LoanItemsList } from "./LoanItemsList";
import { LoanStatusBadge } from "./LoansTable";
import { formatLoanDate, totalUnidades, type DemoLoan } from "../../data/demoLoans";

interface LoanDetailsDialogProps { open: boolean; loan: DemoLoan | null; onClose: () => void }

export function LoanDetailsDialog({ open, loan, onClose }: LoanDetailsDialogProps) {
  if (!loan) return null;
  return (
    <Dialog open={open} onClose={onClose} title="Detalles del préstamo" subtitle={`Información del préstamo ${loan.folio}`} size="lg" footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE9FA] bg-gradient-to-r from-[#F0F6FF] to-white p-4">
          <div><p className="text-[10.5px] font-medium text-[#8294AF]">Folio de préstamo</p><p className="mt-1 font-mono text-[16px] font-bold text-[#264C85]">{loan.folio}</p></div>
          <LoanStatusBadge estado={loan.estado} />
        </div>
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-[#263D61]"><UserRound className="h-4 w-4 text-[#347CE6]" /> Estudiante responsable</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-[#E6EDF6] bg-[#FBFCFF] p-3"><p className="flex items-center gap-1.5 text-[10.5px] text-[#8393A9]"><GraduationCap className="h-3.5 w-3.5" /> Nombre completo</p><p className="mt-1 text-[12.5px] font-semibold text-[#253B5D]">{loan.estudiante}</p></div>
            <div className="rounded-xl border border-[#E6EDF6] bg-[#FBFCFF] p-3"><p className="flex items-center gap-1.5 text-[10.5px] text-[#8393A9]"><Hash className="h-3.5 w-3.5" /> Código universitario</p><p className="mt-1 font-mono text-[12.5px] font-semibold text-[#253B5D]">{loan.codigoUniversitario}</p></div>
          </div>
        </section>
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-[#263D61]"><CalendarDays className="h-4 w-4 text-[#347CE6]" /> Fechas y cantidades</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[{ label: "Fecha de entrega", value: formatLoanDate(loan.fechaEntrega) }, { label: "Fecha límite", value: formatLoanDate(loan.fechaLimite) }, { label: "Total de unidades", value: String(totalUnidades(loan)) }].map((item) => <div key={item.label} className="rounded-xl border border-[#E6EDF6] bg-[#FBFCFF] p-3"><p className="text-[10.5px] text-[#8393A9]">{item.label}</p><p className="mt-1 text-[13px] font-semibold tabular-nums text-[#253B5D]">{item.value}</p></div>)}
          </div>
        </section>
        <section><h3 className="mb-2 text-[12.5px] font-semibold text-[#263D61]">Artículos entregados</h3><LoanItemsList items={loan.items} /></section>
        {loan.observacion && <div className="flex gap-2 rounded-xl border border-[#E1EBFA] bg-[#F3F8FF] p-3 text-[11.5px] text-[#617D9E]"><Info className="h-4 w-4 shrink-0 text-[#347CE6]" /><p>{loan.observacion}</p></div>}
      </div>
    </Dialog>
  );
}
