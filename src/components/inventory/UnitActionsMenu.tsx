import { useEffect, useRef, useState } from "react";
import {
  MoreHorizontal,
  Eye,
  AlertTriangle,
  History,
  type LucideIcon,
} from "lucide-react";
import type { InventoryUnit } from "../../data/inventoryData";

interface Action {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  onSelect?: () => void;
}

interface UnitActionsMenuProps {
  item: InventoryUnit;
  onDetails: (item: InventoryUnit) => void;
}

export function UnitActionsMenu({ item, onDetails }: UnitActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const menuHeight = 132;
      const openUp = rect.bottom + menuHeight > window.innerHeight - 8;
      setPos({
        top: openUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
        left: Math.max(8, rect.right - 224),
      });
    }

    const onDocPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const actions: Action[] = [
    { label: "Ver detalles", icon: Eye, onSelect: () => onDetails(item) },
    { label: "Registrar incidente", icon: AlertTriangle, disabled: true },
    { label: "Ver historial de la unidad", icon: History, disabled: true },
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
        aria-label={`Acciones para la unidad ${item.codigo}`}
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
          aria-label={`Acciones para la unidad ${item.codigo}`}
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
