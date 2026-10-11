
import {
  Search,
  ChevronDown,
  X,
  Tags,
  Filter,
} from "lucide-react";

import { Button } from "../ui/Button";
import type { UnitState } from "../../data/inventoryData";
import { UNIT_STATES } from "./unitState";

export type UnitStateFilter = "todos" | UnitState;

interface UnitsToolbarProps {
  query: string;
  onQuery: (value: string) => void;
  categoria: string;
  onCategoria: (value: string) => void;
  estado: UnitStateFilter;
  onEstado: (value: UnitStateFilter) => void;
  categorias: string[];
  hasActiveFilters: boolean;
  onClear: () => void;
}

const selectClass = `
  h-[40px] w-full appearance-none
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
  focus:ring-2 focus:ring-[#398BFF]/10
`;

export function UnitsToolbar({
  query,
  onQuery,
  categoria,
  onCategoria,
  estado,
  onEstado,
  categorias,
  hasActiveFilters,
  onClear,
}: UnitsToolbarProps) {
  return (
    <div
      className="
        flex min-w-0 flex-wrap items-center
        gap-2.5 border-b border-[#E7EEF7]
        bg-white/80 px-4 py-3
      "
    >
      {/* BÚSQUEDA */}
      <div className="relative min-w-[210px] flex-1">
        <Search
          className="
            pointer-events-none absolute
            left-3 top-1/2 h-[17px] w-[17px]
            -translate-y-1/2 text-[#8C9BB2]
          "
        />

        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Buscar por código de unidad o artículo..."
          aria-label="Buscar unidades"
          className="
            h-[40px] w-full rounded-[9px]
            border border-[#DFE7F2]
            bg-white pl-10 pr-3
            text-[12px] text-[#283C5C]
            placeholder:text-[#9AA6B8]
            shadow-[0_1px_3px_rgba(35,70,120,0.02)]
            transition-[border-color,box-shadow]
            duration-200
            hover:border-[#B8CEEA]
            focus:border-[#398BFF]
            focus:outline-none
            focus:ring-2 focus:ring-[#398BFF]/10
          "
        />
      </div>

      {/* CATEGORÍA */}
      <div className="relative w-[205px] max-w-full shrink-0">
        <Tags
          className="
            pointer-events-none absolute
            left-3 top-1/2 h-[16px] w-[16px]
            -translate-y-1/2 text-[#68809F]
          "
        />

        <select
          value={categoria}
          onChange={(event) =>
            onCategoria(event.target.value)
          }
          aria-label="Filtrar unidades por categoría"
          className={selectClass}
        >
          <option value="todas">
            Todas las categorías
          </option>

          {categorias.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <ChevronDown
          className="
            pointer-events-none absolute
            right-3 top-1/2 h-4 w-4
            -translate-y-1/2 text-[#8394AC]
          "
        />
      </div>

      {/* ESTADO */}
      <div className="relative w-[205px] max-w-full shrink-0">
        <Filter
          className="
            pointer-events-none absolute
            left-3 top-1/2 h-[16px] w-[16px]
            -translate-y-1/2 text-[#68809F]
          "
        />

        <select
          value={estado}
          onChange={(event) =>
            onEstado(event.target.value as UnitStateFilter)
          }
          aria-label="Filtrar unidades por estado"
          className={selectClass}
        >
          <option value="todos">
            Todos los estados
          </option>

          {UNIT_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>

        <ChevronDown
          className="
            pointer-events-none absolute
            right-3 top-1/2 h-4 w-4
            -translate-y-1/2 text-[#8394AC]
          "
        />
      </div>

      {/* LIMPIAR FILTROS */}
      {hasActiveFilters && (
        <Button
          variant="tertiary"
          onClick={onClear}
          aria-label="Limpiar filtros de unidades"
          className="
            h-[40px] gap-1.5 whitespace-nowrap
            text-[#347CE6] hover:bg-[#EDF5FF]
          "
        >
          <X className="h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
