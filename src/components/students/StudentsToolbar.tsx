
import {
  Search,
  ChevronDown,
  X,
  Filter,
} from "lucide-react";

import { Button } from "../ui/Button";

export type StudentFilter =
  | "todos"
  | "con_prestamos"
  | "sin_prestamos"
  | "con_incidencias";

interface StudentsToolbarProps {
  query: string;
  onQuery: (value: string) => void;
  filter: StudentFilter;
  onFilter: (value: StudentFilter) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
}

const selectClass = `
  h-[40px] w-full
  appearance-none
  rounded-[9px]

  border border-[#DFE7F2]
  bg-white

  pl-10 pr-9

  text-[12px] font-medium
  text-[#374B69]

  shadow-[0_1px_3px_rgba(35,70,120,0.02)]

  transition-[border-color,box-shadow]
  duration-200

  hover:border-[#B8CEEA]

  focus:border-[#398BFF]
  focus:outline-none
  focus:ring-2
  focus:ring-[#398BFF]/10
`;

export function StudentsToolbar({
  query,
  onQuery,
  filter,
  onFilter,
  hasActiveFilters,
  onClear,
}: StudentsToolbarProps) {
  return (
    <div
      className="
        flex min-w-0 flex-wrap
        items-center gap-2.5

        border-b border-[#E7EEF7]
        bg-white/80

        px-4 py-3
      "
    >
      {/* =====================================
          BUSCADOR
      ===================================== */}

      <div className="relative min-w-[210px] flex-1">
        <Search
          className="
            pointer-events-none
            absolute left-3 top-1/2
            h-[17px] w-[17px]
            -translate-y-1/2
            text-[#8C9BB2]
          "
        />

        <input
          type="search"
          value={query}
          onChange={(event) =>
            onQuery(event.target.value)
          }
          placeholder="Buscar por nombre, apellidos o código..."
          aria-label="Buscar estudiante"
          className="
            h-[40px] w-full
            rounded-[9px]

            border border-[#DFE7F2]
            bg-white

            pl-10 pr-3

            text-[12px]
            text-[#283C5C]

            placeholder:text-[#9AA6B8]

            shadow-[0_1px_3px_rgba(35,70,120,0.02)]

            transition-[border-color,box-shadow]
            duration-200

            hover:border-[#B8CEEA]

            focus:border-[#398BFF]
            focus:outline-none
            focus:ring-2
            focus:ring-[#398BFF]/10
          "
        />
      </div>

      {/* =====================================
          FILTRO
      ===================================== */}

      <div className="relative w-[225px] max-w-full shrink-0">
        <Filter
          className="
            pointer-events-none
            absolute left-3 top-1/2
            h-4 w-4
            -translate-y-1/2
            text-[#68809F]
          "
        />

        <select
          value={filter}
          onChange={(event) =>
            onFilter(
              event.target.value as StudentFilter
            )
          }
          aria-label="Filtrar estudiantes"
          className={selectClass}
        >
          <option value="todos">
            Todos los estudiantes
          </option>

          <option value="con_prestamos">
            Con préstamos activos
          </option>

          <option value="sin_prestamos">
            Sin préstamos activos
          </option>

          <option value="con_incidencias">
            Con incidencias
          </option>
        </select>

        <ChevronDown
          className="
            pointer-events-none
            absolute right-3 top-1/2
            h-4 w-4
            -translate-y-1/2
            text-[#8394AC]
          "
        />
      </div>

      {/* =====================================
          LIMPIAR FILTROS
      ===================================== */}

      {hasActiveFilters && (
        <Button
          variant="tertiary"
          onClick={onClear}
          aria-label="Limpiar filtros de estudiantes"
          className="
            h-[40px] min-w-0
            gap-1.5 whitespace-nowrap
            text-[#347CE6]
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
