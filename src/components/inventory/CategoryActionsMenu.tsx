import { useCallback, useEffect, useRef, useState } from "react";
import { MoreHorizontal, PackageSearch, Pencil, Trash2 } from "lucide-react";
import type { InventoryCategory } from "../../data/inventoryData";

interface CategoryActionsMenuProps {
  categoria: InventoryCategory;
  onViewArticles: (categoria: InventoryCategory) => void;
  onEdit: (categoria: InventoryCategory) => void;
}

export function CategoryActionsMenu({
  categoria,
  onViewArticles,
  onEdit,
}: CategoryActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 248;
    const estimatedHeight = 196;
    const left = Math.max(
      8,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
    );
    const overflowsBottom =
      rect.bottom + 6 + estimatedHeight > window.innerHeight;
    const top = overflowsBottom
      ? Math.max(8, rect.top - estimatedHeight - 6)
      : rect.bottom + 6;
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onResize = () => place();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, place]);

  const deleteReason =
    categoria.articulos > 0
      ? `Esta categoría tiene ${categoria.articulos} ${
          categoria.articulos === 1 ? "artículo" : "artículos"
        }. Muévelos a otra categoría antes de eliminarla.`
      : "La eliminación estará disponible en una fase posterior.";

  const handleSelect = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Acciones para ${categoria.nombre}`}
        title="Acciones"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
          open
            ? "bg-[#E6EBF2] text-text"
            : "text-text-secondary hover:bg-[#E6EBF2]"
        }`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Acciones para ${categoria.nombre}`}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-[248px] overflow-hidden rounded-md border border-border bg-surface py-1 shadow-card-hover"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect(() => onViewArticles(categoria))}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text transition-colors duration-[120ms] hover:bg-[#EEF2F8] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
          >
            <PackageSearch className="h-4 w-4 shrink-0" />
            Ver artículos
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect(() => onEdit(categoria))}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text transition-colors duration-[120ms] hover:bg-[#EEF2F8] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
          >
            <Pencil className="h-4 w-4 shrink-0" />
            Editar
          </button>

          <div className="my-1 border-t border-border-soft" />
          <p className="px-3 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-text-secondary/80">
            Disponible en fases posteriores
          </p>
          <button
            type="button"
            role="menuitem"
            disabled
            aria-disabled="true"
            className="flex w-full cursor-not-allowed flex-col items-start gap-0.5 px-3 py-2 text-left text-[13px] text-text-secondary/70"
          >
            <span className="flex items-center gap-2.5">
              <Trash2 className="h-4 w-4 shrink-0" />
              Eliminar categoría
            </span>
            <span className="pl-[26px] text-[11px] leading-4 text-text-secondary/80">
              {deleteReason}
            </span>
          </button>
        </div>
      )}
    </>
  );
}
