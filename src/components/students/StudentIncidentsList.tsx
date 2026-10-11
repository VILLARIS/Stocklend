import { ShieldCheck } from "lucide-react";
import { Badge } from "../ui/Badge";
import type {
  IncidentEstado,
  IncidentTipo,
  StudentIncident,
} from "../../data/demoStudents";
import { formatFecha } from "../../data/demoStudents";

interface StudentIncidentsListProps {
  incidents: StudentIncident[];
}

const tipoVariant: Record<IncidentTipo, "error" | "warning"> = {
  Pérdida: "error",
  Daño: "warning",
  Faltante: "warning",
};

const estadoVariant: Record<IncidentEstado, "warning" | "success"> = {
  Abierto: "warning",
  Resuelto: "success",
};

export function StudentIncidentsList({ incidents }: StudentIncidentsListProps) {
  if (incidents.length === 0) {
    return (
      <div className="mt-3 flex items-center gap-2.5 rounded-md border border-dashed border-border-soft bg-[#F7F9FC] px-3 py-4 text-[12.5px] text-text-secondary">
        <ShieldCheck className="h-4 w-4 shrink-0 text-text-secondary/60" />
        Este estudiante no tiene incidencias asociadas.
      </div>
    );
  }

  return (
    <ul className="mt-3 divide-y divide-border-soft overflow-hidden rounded-md border border-border-soft">
      {incidents.map((incident) => (
        <li
          key={incident.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface px-3 py-2.5"
        >
          <span className="font-mono text-[12.5px] text-text">
            {incident.codigo}
          </span>
          <Badge variant={tipoVariant[incident.tipo]}>{incident.tipo}</Badge>
          <span className="min-w-0 flex-1 truncate text-[13px] text-text">
            {incident.articulo}
          </span>
          <span className="tabular-nums text-[12px] text-text-secondary">
            {formatFecha(incident.fecha)}
          </span>
          <Badge variant={estadoVariant[incident.estado]} dot>
            {incident.estado}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
