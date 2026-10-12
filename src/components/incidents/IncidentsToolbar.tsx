
import {
  ChevronDown,
  Filter,
  Search,
  X,
} from "lucide-react";

import { Button } from "../ui/Button";

import type {
  IncidentStatus,
  IncidentType,
} from "../../data/demoIncidents";

export type IncidentTypeFilter =
  | "todos"
  | IncidentType;

export type IncidentStatusFilter =
  | "todos"
  | IncidentStatus;

interface IncidentsToolbarProps {
  query: string;
  onQuery: (value: string) => void;
  type: IncidentTypeFilter;
  onType: (value: IncidentTypeFilter) => void;
  status: IncidentStatusFilter;
  onStatus: (value: IncidentStatusFilter) => void;
  onClear: () => void;
  active: boolean;
}

const inputClass = `
  h-10 w-full rounded-[10px]
  border border-[#DFE7F2]
  bg-white text-[12px] text-[#334B6B]
  outline-none
  transition-[border-color,box-shadow] duration-200
  hover:border-[#B8CEEA]
  focus:border-[#398BFF]
  focus:ring-2 focus:ring-[#398BFF]/10
`;

export function IncidentsToolbar({
  query,
  onQuery,
  type,
  onType,
  status,
  onStatus,
  onClear,
  active,
}: IncidentsToolbarProps) {
  return (
    <div
      className="
        flex min-w-0 flex-wrap items-center gap-2.5
        border-b border-[#E7EEF7]
        bg-white/80 px-4 py-3
      "
    >
      {/* BUSCADOR */}
      <div className="relative min-w-[225px] flex-1">
        <Search
          className="
            pointer-events-none absolute
            left-3 top-1/2 h-4 w-4
            -translate-y-1/2 text-[#8C9BB2]
          "
        />

        <input
          type="search"
          aria-label="Buscar incidencias"
          placeholder="Buscar código, artículo o responsable..."
          value={query}
          onChange={(event) =>
            onQuery(event.target.value)
          }
          className={`
            ${inputClass}
            pl-10 pr-3
            placeholder:text-[#9AA8BC]
          `}
        />
      </div>

      {/* FILTRO POR TIPO */}
      <div className="relative w-[185px] max-w-full">
        <Filter
          className="
            pointer-events-none absolute
            left-3 top-1/2 h-4 w-4
            -translate-y-1/2 text-[#68809F]
          "
        />

        <select
          aria-label="Filtrar por tipo"
          value={type}
          onChange={(event) =>
            onType(event.target.value as IncidentTypeFilter)
          }
          className={`
            ${inputClass}
            appearance-none pl-9 pr-8
          `}
        >
          <option value="todos">Todos los tipos</option>
          <option value="Daño">Daño</option>
          <option value="Pérdida">Pérdida</option>
          <option value="Faltante">Faltante</option>
        </select>

        <ChevronDown
          className="
            pointer-events-none absolute
            right-3 top-1/2 h-4 w-4
            -translate-y-1/2 text-[#8394AC]
          "
        />
      </div>

      {/* FILTRO POR ESTADO */}
      <div className="relative w-[185px] max-w-full">
        <select
          aria-label="Filtrar por estado"
          value={status}
          onChange={(event) =>
            onStatus(event.target.value as IncidentStatusFilter)
          }
          className={`
            ${inputClass}
            appearance-none pl-3 pr-8
          `}
        >
          <option value="todos">Todos los estados</option>
          <option value="Abierto">Abierto</option>
          <option value="En revisión">En revisión</option>
          <option value="Resuelto">Resuelto</option>
        </select>

        <ChevronDown
          className="
            pointer-events-none absolute
            right-3 top-1/2 h-4 w-4
            -translate-y-1/2 text-[#8394AC]
          "
        />
      </div>

      {/* LIMPIAR */}
      {active && (
        <Button
          variant="tertiary"
          onClick={onClear}
          aria-label="Limpiar filtros de incidencias"
          className="h-10 min-w-0 gap-1.5 text-[#347CE6]"
        >
          <X className="h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
