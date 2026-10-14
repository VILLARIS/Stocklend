import { type ReactNode } from "react";

interface SectionTitleProps {
  icon: ReactNode;
  title: string;
  description?: string;
}

/** Encabezado de sección del formulario de préstamo (icono + título + ayuda). */
export function SectionTitle({ icon, title, description }: SectionTitleProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#EAF3FF] text-[#287FF0]">
        {icon}
      </div>

      <div className="min-w-0">
        <h3 className="text-[12.5px] font-semibold text-[#253D61]">{title}</h3>

        {description && (
          <p className="mt-0.5 text-[10.5px] leading-4 text-[#8293AA]">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
