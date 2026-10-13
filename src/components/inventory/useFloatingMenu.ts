// Lógica compartida de posicionamiento y cierre para los menús flotantes de la
// tabla de inventario. Antes estaba duplicada en RowActionsMenu, UnitActionsMenu
// y CategoryActionsMenu.

import { useCallback, useEffect, useRef, useState } from "react";

interface FloatingMenuOptions {
  menuWidth: number;
  estimatedHeight: number;
}

export function useFloatingMenu({
  menuWidth,
  estimatedHeight,
}: FloatingMenuOptions) {
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
  }, [menuWidth, estimatedHeight]);

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

  return { open, setOpen, pos, buttonRef, menuRef };
}
