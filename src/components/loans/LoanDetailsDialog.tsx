import { CalendarDays, GraduationCap, Hash, Info, UserRound } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { LoanItemsList } from "./LoanItemsList";
import { LoanStatusBadge } from "./LoansTable";
import {
  ResourceError,
  ResourceLoading,
} from "../students/StudentsResourceState";
import { formatLoanDate, totalUnidades } from "../../data/demoLoans";
import { adaptLoanDetail } from "../../services/loansAdapters";
import { useLoanDetails } from "../../hooks/useLoans";
import type { DemoLoan } from "../../types/loans";

interface LoanDetailsDialogProps { open: boolean; loan: DemoLoan | null; onClose: () => void }

/** Muestra "Sin fecha límite" cuando el préstamo no tiene vencimiento. */
function formatDeadline(value: string | null): string {
  return value === null || value === "" ? "Sin fecha límite" : formatLoanDate(value);
}

export function LoanDetailsDialog({ open, loan, onClose }: LoanDetailsDialogProps) {
  // El detalle real (con sus renglones) se consulta al abrir el modal. El hook
  // queda en `idle` y no consulta nada si no hay un préstamo válido.
  const details = useLoanDetails(loan ? Number(loan.id) : null);

  if (!loan) return null;

  // Solo se acepta la respuesta cuyo id coincide con el préstamo seleccionado:
  // así nunca se muestra el detalle del préstamo anterior mientras carga el
  // nuevo.
  const detail =
    details.data && String(details.data.id) === String(loan.id)
      ? adaptLoanDetail(details.data)
      : null;

  const isLoading =
    details.status === "loading" || (details.status !== "error" && detail === null);

  // La cabecera usa el detalle real cuando está disponible; mientras carga,
  // se apoya en la fila seleccionada (mismo préstamo, nunca el anterior).
  const header = detail ?? loan;

  return (
    <Dialog open={open} onClose={onClose} title="Detalles del préstamo" subtitle={`Información del préstamo ${header.folio}`} size="lg" footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE9FA] bg-gradient-to-r from-[#F0F6FF] to-white p-4">
          <div><p className="text-[10.5px] font-medium text-[#8294AF]">Folio de préstamo</p><p className="mt-1 font-mono text-[16px] font-bold text-[#264C85]">{header.folio}</p></div>
          <LoanStatusBadge estado={header.estado} />
        </div>

        {details.status === "error" ? (
          <ResourceError message={details.error ?? "No se pudo cargar el detalle del préstamo."} onRetry={details.refetch} />
        ) : isLoading || detail === null ? (
          <ResourceLoading />
        ) : (
          <>
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-[#263D61]"><UserRound className="h-4 w-4 text-[#347CE6]" /> Estudiante responsable</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-[#E6EDF6] bg-[#FBFCFF] p-3"><p className="flex items-center gap-1.5 text-[10.5px] text-[#8393A9]"><GraduationCap className="h-3.5 w-3.5" /> Nombre completo</p><p className="mt-1 text-[12.5px] font-semibold text-[#253B5D]">{detail.estudiante}</p></div>
                <div className="rounded-xl border border-[#E6EDF6] bg-[#FBFCFF] p-3"><p className="flex items-center gap-1.5 text-[10.5px] text-[#8393A9]"><Hash className="h-3.5 w-3.5" /> Código universitario</p><p className="mt-1 font-mono text-[12.5px] font-semibold text-[#253B5D]">{detail.codigoUniversitario}</p></div>
              </div>
            </section>
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-[#263D61]"><CalendarDays className="h-4 w-4 text-[#347CE6]" /> Fechas y cantidades</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[{ label: "Fecha de entrega", value: formatLoanDate(detail.fechaEntrega) }, { label: "Fecha límite", value: formatDeadline(detail.fechaLimite) }, { label: "Total de unidades", value: String(detail.unidadesPrestadas ?? totalUnidades(detail)) }].map((item) => <div key={item.label} className="rounded-xl border border-[#E6EDF6] bg-[#FBFCFF] p-3"><p className="text-[10.5px] text-[#8393A9]">{item.label}</p><p className="mt-1 text-[13px] font-semibold tabular-nums text-[#253B5D]">{item.value}</p></div>)}
              </div>
            </section>
            <section><h3 className="mb-2 text-[12.5px] font-semibold text-[#263D61]">Artículos entregados</h3><LoanItemsList items={detail.items} /></section>
            {detail.observacion && <div className="flex gap-2 rounded-xl border border-[#E1EBFA] bg-[#F3F8FF] p-3 text-[11.5px] text-[#617D9E]"><Info className="h-4 w-4 shrink-0 text-[#347CE6]" /><p>{detail.observacion}</p></div>}
          </>
        )}
      </div>
    </Dialog>
  );
}
