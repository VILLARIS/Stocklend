import { ChevronDown, Filter, Search, X } from "lucide-react";
import { Button } from "../ui/Button";
import type { LoanStatus } from "../../types/loans";

export type LoanFilter = "todos" | LoanStatus;

interface LoansToolbarProps {
  query: string;
  onQuery: (value: string) => void;
  filter: LoanFilter;
  onFilter: (value: LoanFilter) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
}

const inputClass = "h-10 w-full rounded-[10px] border border-[#DFE7F2] bg-white text-[12.5px] text-[#283C5C] outline-none transition-colors placeholder:text-[#9AA6B8] hover:border-[#B8CEEA] focus:border-[#398BFF] focus:ring-2 focus:ring-[#398BFF]/10";

export function LoansToolbar({ query, onQuery, filter, onFilter, hasActiveFilters, onClear }: LoansToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-[#E7EEF7] bg-white/80 px-4 py-3">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8496B1]" />
        <input type="search" aria-label="Buscar préstamos" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Buscar por folio, estudiante o código universitario..." className={`${inputClass} pl-10 pr-3`} />
      </div>
      <div className="relative w-[210px] max-w-full shrink-0">
        <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7187A5]" />
        <select aria-label="Filtrar préstamos por estado" value={filter} onChange={(event) => onFilter(event.target.value as LoanFilter)} className={`${inputClass} appearance-none pl-10 pr-9`}>
          <option value="todos">Todos los estados</option>
          <option value="Activo">Activos</option>
          <option value="Finalizado">Finalizados</option>
          <option value="Vencido">Vencidos</option>
          <option value="Anulado">Anulados</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8293AB]" />
      </div>
      {hasActiveFilters && (
        <Button variant="tertiary" onClick={onClear} aria-label="Limpiar filtros de préstamos" className="h-10 gap-1.5 whitespace-nowrap text-[#347CE6]">
          <X className="h-4 w-4" /> Limpiar
        </Button>
      )}
    </div>
  );
}
