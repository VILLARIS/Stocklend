
import {
  ChevronDown,
  Filter,
  Search,
  X,
} from "lucide-react";

import { Button } from "../ui/Button";
import type { ReturnStatus } from "../../data/demoReturns";

export type ReturnFilter = "todos" | ReturnStatus;

interface ReturnsToolbarProps {
  query: string;
  onQuery: (value: string) => void;
  filter: ReturnFilter;
  onFilter: (value: ReturnFilter) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
}

const fieldClass = `
  h-10 w-full appearance-none
  rounded-[10px]
  border border-[#DFE7F2]
  bg-white
  text-[12px] text-[#334B6B]
  outline-none
  transition-[border-color,box-shadow] duration-200
  hover:border-[#B8CEEA]
  focus:border-[#398BFF]
  focus:ring-2 focus:ring-[#398BFF]/10
`;

export function ReturnsToolbar({
  query,
  onQuery,
  filter,
  onFilter,
  hasActiveFilters,
  onClear,
}: ReturnsToolbarProps) {
  return (
    <div
      className="
        flex min-w-0 flex-wrap items-center gap-2.5
        border-b border-[#E7EEF7]
        bg-white/80 px-4 py-3
      "
    >
      <div className="relative min-w-[210px] flex-1">
        <Search
          className="
            pointer-events-none absolute left-3 top-1/2
            h-[17px] w-[17px] -translate-y-1/2
            text-[#8C9BB2]
          "
        />

        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Buscar por préstamo, estudiante o código..."
          aria-label="Buscar devoluciones"
          className={`${fieldClass} pl-10 pr-3 placeholder:text-[#9AA8BC]`}
        />
      </div>

      <div className="relative w-[220px] max-w-full shrink-0">
        <Filter
          className="
            pointer-events-none absolute left-3 top-1/2
            h-4 w-4 -translate-y-1/2 text-[#68809F]
          "
        />

        <select
          value={filter}
          onChange={(event) =>
            onFilter(event.target.value as ReturnFilter)
          }
          aria-label="Filtrar devoluciones por estado"
          className={`${fieldClass} pl-10 pr-9`}
        >
          <option value="todos">Todos los estados</option>
          <option value="Pendiente">Pendientes</option>
          <option value="Parcial">Parciales</option>
          <option value="Completada">Completadas</option>
          <option value="Vencida">Vencidas</option>
        </select>

        <ChevronDown
          className="
            pointer-events-none absolute right-3 top-1/2
            h-4 w-4 -translate-y-1/2 text-[#8394AC]
          "
        />
      </div>

      {hasActiveFilters && (
        <Button
          variant="tertiary"
          onClick={onClear}
          aria-label="Limpiar filtros de devoluciones"
          className="
            h-10 min-w-0 gap-1.5
            whitespace-nowrap text-[#347CE6]
            hover:bg-[#EDF5FF]
          "
        >
          <X className="h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
