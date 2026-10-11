import { Search, ChevronDown, X } from "lucide-react";
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

const selectClass =
  "h-9 appearance-none rounded-md border border-border bg-surface pl-3 pr-8 text-sm text-text transition-colors duration-[120ms] hover:border-border-strong focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20";

export function StudentsToolbar({
  query,
  onQuery,
  filter,
  onFilter,
  hasActiveFilters,
  onClear,
}: StudentsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border-soft px-4 py-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary/70" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Buscar por nombre, apellidos o código…"
          aria-label="Buscar estudiante"
          className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-secondary/60 transition-colors duration-[120ms] hover:border-border-strong focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
        />
      </div>

      <div className="relative">
        <select
          value={filter}
          onChange={(event) => onFilter(event.target.value as StudentFilter)}
          aria-label="Filtrar estudiantes"
          className={`${selectClass} min-w-[190px]`}
        >
          <option value="todos">Todos los estudiantes</option>
          <option value="con_prestamos">Con préstamos activos</option>
          <option value="sin_prestamos">Sin préstamos activos</option>
          <option value="con_incidencias">Con incidencias</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary/70" />
      </div>

      {hasActiveFilters && (
        <Button
          variant="tertiary"
          onClick={onClear}
          aria-label="Limpiar filtros de estudiantes"
          className="min-w-0"
        >
          <X className="mr-1 h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
