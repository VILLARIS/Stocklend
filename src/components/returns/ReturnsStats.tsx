
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RotateCcw,
} from "lucide-react";

import { StatCardV2 } from "../ui/StatCardV2";
import type { ReturnSummary } from "../../types/returns";

/**
 * Tarjetas resumen de Devoluciones.
 *
 * Recibe los totales ya calculados por props (como `LoansStats`): mientras el
 * listado no esté disponible llega `null` y las tarjetas no inventan cifras.
 */
export function ReturnsStats({
  summary,
}: {
  summary: ReturnSummary | null;
}) {
  return (
    <div
      className="
        grid grid-cols-1 gap-3
        @[600px]:grid-cols-2
        @[1050px]:grid-cols-4
      "
    >
      <StatCardV2
        value={summary ? summary.pendientes : "—"}
        label="Préstamos por devolver"
        hint="Con unidades pendientes"
        accent="blue"
        icon={<Clock3 />}
      />

      <StatCardV2
        value={summary ? summary.parciales : "—"}
        label="Devoluciones parciales"
        hint="Aún faltan unidades"
        accent="violet"
        icon={<RotateCcw />}
      />

      <StatCardV2
        value={summary ? summary.completadas : "—"}
        label="Devoluciones completas"
        hint="Préstamos ya devueltos"
        accent="green"
        icon={<CheckCircle2 />}
      />

      <StatCardV2
        value={summary ? summary.vencidas : "—"}
        label="Pendientes vencidos"
        hint="Requieren seguimiento"
        accent="orange"
        icon={<AlertTriangle />}
      />
    </div>
  );
}
