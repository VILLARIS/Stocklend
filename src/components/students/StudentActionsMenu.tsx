import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Eye, Pencil, History, Power, PowerOff } from "lucide-react";
import type { StudentSummary } from "../../types/students";

interface StudentActionsMenuProps {
  student: StudentSummary;
  busy?: boolean;
  onDetails: (student: StudentSummary) => void;
  onEdit: (student: StudentSummary) => void;
  onHistory: (student: StudentSummary) => void;
  onToggleActive: (student: StudentSummary) => void;
}

export function StudentActionsMenu({
  student,
  busy = false,
  onDetails,
  onEdit,
  onHistory,
  onToggleActive,
}: StudentActionsMenuProps) {
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
    const menuWidth = 236;
    const estimatedHeight = 148;
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

  const actions = [
    { label: "Ver detalles", icon: Eye, run: () => onDetails(student), disabled: false },
    { label: "Editar estudiante", icon: Pencil, run: () => onEdit(student), disabled: false },
    {
      label: "Ver historial de préstamos",
      icon: History,
      run: () => onHistory(student),
      disabled: false,
    },
    {
      label: student.activo ? "Desactivar estudiante" : "Reactivar estudiante",
      icon: student.activo ? PowerOff : Power,
      run: () => onToggleActive(student),
      disabled: busy,
    },
  ];

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Acciones para ${student.nombreCompleto}`}
        title="Acciones"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
          open
            ? "bg-[#E6EBF2] text-text"
            : "text-text-secondary hover:bg-[#E6EBF2]"
        }`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Acciones para ${student.nombreCompleto}`}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-50 w-[240px] overflow-hidden rounded-md border border-border bg-surface py-1 shadow-card-hover"
          >
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  onClick={() => {
                    setOpen(false);
                    action.run();
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text transition-colors duration-[120ms] hover:bg-[#EEF2F8] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {action.label}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
