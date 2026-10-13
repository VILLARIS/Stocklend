import {
  MoreHorizontal,
  PackageSearch,
  Pencil,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import type { InventoryCategory } from "../../data/inventoryData";
import { useFloatingMenu } from "./useFloatingMenu";
import { FloatingMenu } from "./FloatingMenu";

interface CategoryActionsMenuProps {
  categoria: InventoryCategory;
  busy?: boolean;
  onViewArticles: (categoria: InventoryCategory) => void;
  onEdit: (categoria: InventoryCategory) => void;
  onToggleActive: (categoria: InventoryCategory) => void;
}

export function CategoryActionsMenu({
  categoria,
  busy = false,
  onViewArticles,
  onEdit,
  onToggleActive,
}: CategoryActionsMenuProps) {
  const { open, setOpen, pos, buttonRef, menuRef } = useFloatingMenu({
    menuWidth: 248,
    estimatedHeight: 250,
  });

  const isActive = categoria.activo !== false;

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

  const itemClass =
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text transition-colors duration-[120ms] hover:bg-[#EEF2F8] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";

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

      <FloatingMenu
        open={open}
        pos={pos}
        menuRef={menuRef}
        label={`Acciones para ${categoria.nombre}`}
        className="fixed z-50 w-[248px] overflow-hidden rounded-md border border-border bg-surface py-1 shadow-card-hover"
      >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect(() => onViewArticles(categoria))}
            className={itemClass}
          >
            <PackageSearch className="h-4 w-4 shrink-0" />
            Ver artículos
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => handleSelect(() => onEdit(categoria))}
            className={itemClass}
          >
            <Pencil className="h-4 w-4 shrink-0" />
            Editar
          </button>

          <div className="my-1 border-t border-border-soft" />
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => handleSelect(() => onToggleActive(categoria))}
            className={itemClass}
          >
            {isActive ? (
              <PowerOff className="h-4 w-4 shrink-0" />
            ) : (
              <Power className="h-4 w-4 shrink-0" />
            )}
            {isActive ? "Desactivar categoría" : "Reactivar categoría"}
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
      </FloatingMenu>
    </>
  );
}
