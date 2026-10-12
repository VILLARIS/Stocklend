
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
} from "lucide-react";

import { StatCardV2 } from "../ui/StatCardV2";
import { incidentsSummary } from "../../data/demoIncidents";

export function IncidentsStats() {
  return (
    <section
      aria-label="Resumen de incidencias"
      className="
        grid grid-cols-1 gap-3
        @[600px]:grid-cols-2
        @[1050px]:grid-cols-4
      "
    >
      <StatCardV2
        value={incidentsSummary.total}
        label="Incidencias registradas"
        hint="Casos en el historial"
        accent="blue"
        icon={<ClipboardList />}
      />

      <StatCardV2
        value={incidentsSummary.abiertas}
        label="Incidencias abiertas"
        hint="Pendientes de atención"
        accent="orange"
        icon={<AlertTriangle />}
      />

      <StatCardV2
        value={incidentsSummary.revision}
        label="En revisión"
        hint="Casos en seguimiento"
        accent="violet"
        icon={<Clock3 />}
      />

      <StatCardV2
        value={incidentsSummary.resueltas}
        label="Resueltas"
        hint="Casos cerrados"
        accent="green"
        icon={<CheckCircle2 />}
      />
    </section>
  );
}
