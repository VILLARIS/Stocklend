
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RotateCcw,
} from "lucide-react";

import { StatCardV2 } from "../ui/StatCardV2";
import { returnsSummary } from "../../data/demoReturns";

export function ReturnsStats() {
  return (
    <div
      className="
        grid grid-cols-1 gap-3
        @[600px]:grid-cols-2
        @[1050px]:grid-cols-4
      "
    >
      <StatCardV2
        value={returnsSummary.pendientes}
        label="Préstamos por devolver"
        hint="Con unidades pendientes"
        accent="blue"
        icon={<Clock3 />}
      />

      <StatCardV2
        value={returnsSummary.parciales}
        label="Devoluciones parciales"
        hint="Aún faltan unidades"
        accent="violet"
        icon={<RotateCcw />}
      />

      <StatCardV2
        value={returnsSummary.completadas}
        label="Devoluciones completas"
        hint="Préstamos ya devueltos"
        accent="green"
        icon={<CheckCircle2 />}
      />

      <StatCardV2
        value={returnsSummary.vencidas}
        label="Pendientes vencidos"
        hint="Requieren seguimiento"
        accent="orange"
        icon={<AlertTriangle />}
      />
    </div>
  );
}
