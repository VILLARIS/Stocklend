import { type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

interface FloatingMenuPosition {
  top: number;
  left: number;
}

interface FloatingMenuProps {
  open: boolean;
  pos: FloatingMenuPosition;
  menuRef: RefObject<HTMLDivElement | null>;
  label: string;
  className: string;
  children: ReactNode;
}

/**
 * Menú flotante anclado a un botón y dibujado en un portal.
 *
 * Las tablas viven dentro de contenedores con `overflow-hidden` (y a veces
 * `backdrop-blur`), que recortarían un menú posicionado de forma absoluta. Al
 * montarse en `document.body` con posición `fixed`, el menú no se recorta.
 */
export function FloatingMenu({
  open,
  pos,
  menuRef,
  label,
  className,
  children,
}: FloatingMenuProps) {
  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      style={{ top: pos.top, left: pos.left }}
      className={className}
    >
      {children}
    </div>,
    document.body,
  );
}
