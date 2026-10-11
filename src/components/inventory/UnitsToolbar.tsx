import { Search, ChevronDown, X } from "lucide-react";
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

const selectClass =
  "h-9 appearance-none rounded-md border border-border bg-surface pl-3 pr-8 text-sm text-text transition-colors duration-[120ms] hover:border-border-strong focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20";

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
    <div className="flex flex-wrap items-center gap-2 border-b border-border-soft px-4 py-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary/70" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Buscar por código de unidad o artículo…"
          aria-label="Buscar unidades"
          className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-secondary/60 transition-colors duration-[120ms] hover:border-border-strong focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
        />
      </div>

      <div className="relative">
        <select
          value={categoria}
          onChange={(event) => onCategoria(event.target.value)}
          aria-label="Filtrar unidades por categoría"
          className={`${selectClass} min-w-[168px]`}
        >
          <option value="todas">Todas las categorías</option>
          {categorias.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary/70" />
      </div>

      <div className="relative">
        <select
          value={estado}
          onChange={(event) => onEstado(event.target.value as UnitStateFilter)}
          aria-label="Filtrar unidades por estado"
          className={`${selectClass} min-w-[168px]`}
        >
          <option value="todos">Todos los estados</option>
          {UNIT_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary/70" />
      </div>

      {hasActiveFilters && (
        <Button
          variant="tertiary"
          onClick={onClear}
          aria-label="Limpiar filtros de unidades"
          className="min-w-0"
        >
          <X className="mr-1 h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
