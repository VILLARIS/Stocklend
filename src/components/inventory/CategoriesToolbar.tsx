
import { Search, Plus } from "lucide-react";
import { Button } from "../ui/Button";

interface CategoriesToolbarProps {
  query: string;
  onQuery: (value: string) => void;
  resultCount: number;
  totalCount: number;
  onNew: () => void;
}

function formatCategoryCount(
  resultCount: number,
  totalCount: number,
  filtered: boolean
): string {
  const label = (value: number) =>
    value === 1
      ? "1 categoría"
      : `${value} categorías`;

  return filtered
    ? `${resultCount} de ${label(totalCount)}`
    : label(totalCount);
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
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      {/* BUSCADOR */}
      <div className="relative min-w-[210px] flex-1">
        <Search
          className="
            pointer-events-none absolute
            left-3 top-1/2
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
          placeholder="Buscar categoría por nombre..."
          aria-label="Buscar categoría"
          className="
            h-[40px] w-full
            rounded-[9px]
            border border-[#DFE7F2]
            bg-white pl-10 pr-3
            text-[12px]
            text-[#283C5C]
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

      {/* CONTADOR */}
      <span
        aria-live="polite"
        className="
          shrink-0 whitespace-nowrap
          text-[12px] font-medium
          tabular-nums text-[#7385A1]
        "
      >
        {formatCategoryCount(
          resultCount,
          totalCount,
          hasQuery
        )}
      </span>

      {/* NUEVA CATEGORÍA */}
      <Button
        variant="sidebar"
        onClick={onNew}
        className="shrink-0 whitespace-nowrap"
      >
        <Plus className="h-4 w-4" />
        Nueva categoría
      </Button>
    </div>
  );
}
