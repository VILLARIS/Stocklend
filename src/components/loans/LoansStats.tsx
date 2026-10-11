import { AlertTriangle, CheckCircle2, Handshake, Layers3 } from "lucide-react";
import { StatCardV2 } from "../ui/StatCardV2";
import { loanSummary } from "../../data/demoLoans";

export function LoansStats() {
  return (
    <section aria-label="Resumen de préstamos" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCardV2 value={loanSummary.total} label="Préstamos registrados" hint="Historial general" accent="blue" icon={<Layers3 />} />
      <StatCardV2 value={loanSummary.activos} label="Préstamos activos" hint="Pendientes de devolución" accent="violet" icon={<Handshake />} />
      <StatCardV2 value={loanSummary.finalizados} label="Finalizados" hint="Entregas completadas" accent="green" icon={<CheckCircle2 />} />
      <StatCardV2 value={loanSummary.vencidos} label="Vencidos" hint="Fuera de plazo" accent="orange" icon={<AlertTriangle />} />
    </section>
  );
}
