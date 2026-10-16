// Lógica compartida de posicionamiento y cierre para los menús flotantes que se
// anclan a un botón dentro de contenedores con `overflow-hidden` (tablas de
// Inventario, Préstamos y Devoluciones).

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

    const onWindowChange = () => place();
    const onPointerDown = (event: PointerEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, place]);

  return { open, setOpen, pos, buttonRef, menuRef };
}
