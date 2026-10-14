import { AlertTriangle, CheckCircle2, Handshake, Layers3 } from "lucide-react";
import { StatCardV2 } from "../ui/StatCardV2";
import type { LoanSummary } from "../../types/loans";

/**
 * Tarjetas resumen de Préstamos. Recibe los totales reales por props.
 *
 * Mientras las estadísticas cargan (o si falló la consulta) llega `null` y las
 * tarjetas muestran "—" en lugar de cifras inventadas.
 */
export function LoansStats({ summary }: { summary: LoanSummary | null }) {
  return (
    <section aria-label="Resumen de préstamos" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCardV2 value={summary ? summary.total : "—"} label="Préstamos registrados" hint="Historial general" accent="blue" icon={<Layers3 />} />
      <StatCardV2 value={summary ? summary.activos : "—"} label="Préstamos activos" hint="Pendientes de devolución" accent="violet" icon={<Handshake />} />
      <StatCardV2 value={summary ? summary.finalizados : "—"} label="Finalizados" hint="Entregas completadas" accent="green" icon={<CheckCircle2 />} />
      <StatCardV2 value={summary ? summary.vencidos : "—"} label="Vencidos" hint="Fuera de plazo" accent="orange" icon={<AlertTriangle />} />
    </section>
  );
}
