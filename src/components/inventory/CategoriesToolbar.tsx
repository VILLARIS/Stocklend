import { Search, Plus } from "lucide-react";
import { Button } from "../ui/Button";

interface CategoriesToolbarProps {
  query: string;
  onQuery: (value: string) => void;
  resultCount: number;
  totalCount: number;
  onNew: () => void;
}

export function CategoriesToolbar({
  query,
  onQuery,
  resultCount,
  totalCount,
  onNew,
}: CategoriesToolbarProps) {
  const hasQuery = query.trim() !== "";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary/70" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Buscar categoría por nombre…"
          aria-label="Buscar categoría"
          className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-secondary/60 transition-colors duration-[120ms] hover:border-border-strong focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
        />
      </div>

      <p
        aria-live="polite"
        className="shrink-0 text-[12.5px] tabular-nums text-text-secondary"
      >
        {hasActiveCount(resultCount, totalCount, hasQuery)}
      </p>

      <Button onClick={onNew} className="shrink-0">
        <Plus className="h-4 w-4" />
        Nueva categoría
      </Button>
    </div>
  );
}

function hasActiveCount(
  resultCount: number,
  totalCount: number,
  filtered: boolean,
): string {
  const label = (value: number) =>
    value === 1 ? "1 categoría" : `${value} categorías`;
  return filtered
    ? `${resultCount} de ${label(totalCount)}`
    : label(totalCount);
}
