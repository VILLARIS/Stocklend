import { useCallback, useEffect, useRef, useState } from "react";
import {
  MoreHorizontal,
  Pencil,
  Eye,
  SlidersHorizontal,
  Boxes,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import type { InventoryArticle } from "../../data/inventoryData";

interface Action {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  onSelect?: () => void;
}

interface RowActionsMenuProps {
  item: InventoryArticle;
  onEdit: (item: InventoryArticle) => void;
  onDetails: (item: InventoryArticle) => void;
}

export function RowActionsMenu({ item, onEdit, onDetails }: RowActionsMenuProps) {
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
    const menuWidth = 224;
    const estimatedHeight = 236;
    const left = Math.max(
      8,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
    );
    const overflowsBottom = rect.bottom + 6 + estimatedHeight > window.innerHeight;
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

  const actions: Action[] = [
    { label: "Ver detalles", icon: Eye, onSelect: () => onDetails(item) },
    { label: "Editar artículo", icon: Pencil, onSelect: () => onEdit(item) },
    {
      label: item.controlIndividual ? "Ver unidades" : "Ajustar existencias",
      icon: item.controlIndividual ? Boxes : SlidersHorizontal,
      disabled: true,
    },
    { label: "Registrar incidente", icon: AlertTriangle, disabled: true },
  ];

  const activeItems = actions.filter((action) => !action.disabled);
  const pendingItems = actions.filter((action) => action.disabled);

  const handleSelect = (action: Action) => {
    action.onSelect?.();
    setOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Acciones para ${item.nombre}`}
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
          aria-label={`Acciones para ${item.nombre}`}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-56 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-card-hover"
        >
          {activeItems.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(action)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text transition-colors duration-[120ms] hover:bg-[#EEF2F8] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {action.label}
              </button>
            );
          })}

          {pendingItems.length > 0 && (
            <>
              <div className="my-1 border-t border-border-soft" />
              <p className="px-3 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-text-secondary/80">
                Disponible en fases posteriores
              </p>
              {pendingItems.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    role="menuitem"
                    disabled
                    title="Disponible en una fase posterior"
                    className="flex w-full cursor-not-allowed items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-secondary/70"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {action.label}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </>
  );
}
