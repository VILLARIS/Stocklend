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

// Los menús usan `position: fixed` con coordenadas de viewport obtenidas de
// getBoundingClientRect(). Si se renderizan en línea, cualquier ancestro con
// `backdrop-filter`, `filter` o `transform` pasa a ser su bloque contenedor y
// además los recorta si tiene `overflow: hidden` -> el menú aparece recortado o
// fuera de sitio. Se renderizan en un portal sobre <body> para que "fixed" sea
// relativo al viewport y no queden recortados por la tabla.
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
