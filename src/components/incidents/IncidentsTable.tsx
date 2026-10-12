
import {
  AlertTriangle,
  SearchX,
} from "lucide-react";

import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";

import { IncidentActionsMenu } from "./IncidentActionsMenu";

import {
  IncidentTypeBadge,
  IncidentStatusBadge,
} from "./IncidentBadges";

import {
  formatIncidentDate,
  type DemoIncident,
} from "../../data/demoIncidents";

interface IncidentsTableProps {
  items: DemoIncident[];
  totalCount: number;
  filtered: boolean;
  onClear: () => void;
  onDetails: (incident: DemoIncident) => void;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

export function IncidentsTable({
  items,
  totalCount,
  filtered,
  onClear,
  onDetails,
}: IncidentsTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={
          totalCount === 0
            ? <AlertTriangle />
            : <SearchX />
        }
        title={
          totalCount === 0
            ? "Sin incidencias registradas"
            : "Sin resultados"
        }
        description={
          totalCount === 0
            ? "Todavía no hay incidencias en esta vista de demostración."
            : "No hay incidencias que coincidan con los filtros."
        }
        action={
          filtered ? (
            <Button
              variant="secondary"
              onClick={onClear}
            >
              Limpiar filtros
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-left text-[12px]">
        <thead className="bg-[#FAFCFF] text-[11px] font-semibold text-[#7386A4]">
          <tr className="border-b border-[#E5ECF6]">
            <th className="px-4 py-3">Código</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Artículo</th>
            <th className="px-4 py-3">Responsable</th>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3 text-right">
              Acciones
            </th>
          </tr>
        </thead>

        <tbody>
          {items.map((incident, index) => (
            <tr
              key={incident.id}
              tabIndex={0}
              onClick={() => onDetails(incident)}
              onKeyDown={(event) => {
                if (
                  event.target !== event.currentTarget
                ) {
                  return;
                }

                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();
                  onDetails(incident);
                }
              }}
              className={`
                cursor-pointer
                border-b border-[#E9EEF6]
                transition-colors duration-200
                last:border-0
                hover:bg-[#F0F6FF]
                focus-visible:outline
                focus-visible:outline-2
                focus-visible:outline-[#398BFF]
                ${
                  index % 2 === 0
                    ? "bg-white"
                    : "bg-[#FCFDFF]"
                }
              `}
            >
              {/* CÓDIGO */}
              <td className="px-4 py-3">
                <span
                  className="
                    whitespace-nowrap rounded-lg
                    border border-[#DFEAFE]
                    bg-[#F0F6FF] px-2.5 py-1.5
                    font-mono font-semibold
                    text-[#3675C9]
                  "
                >
                  {incident.codigo}
                </span>
              </td>

              {/* TIPO */}
              <td className="px-4 py-3">
                <IncidentTypeBadge
                  type={incident.tipo}
                />
              </td>

              {/* ARTÍCULO */}
              <td className="px-4 py-3 font-semibold text-[#233A5B]">
                {incident.articulo}
              </td>

              {/* RESPONSABLE */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="
                      flex h-8 w-8 shrink-0
                      items-center justify-center
                      rounded-xl bg-[#EAF2FF]
                      text-[10px] font-semibold
                      text-[#3D80D7]
                    "
                  >
                    {initials(incident.estudiante)}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#314766]">
                      {incident.estudiante}
                    </p>

                    <p className="font-mono text-[10px] text-[#94A1B4]">
                      {incident.codigoUniversitario}
                    </p>
                  </div>
                </div>
              </td>

              {/* FECHA */}
              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[#637895]">
                {formatIncidentDate(incident.fecha)}
              </td>

              {/* ESTADO */}
              <td className="px-4 py-3">
                <IncidentStatusBadge
                  status={incident.estado}
                />
              </td>

              {/* ACCIONES */}
              <td className="px-4 py-3 text-right">
                <IncidentActionsMenu
                  incident={incident}
                  onDetails={onDetails}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
