import { Package } from "lucide-react";
import type { LoanItem } from "../../types/loans";

export function LoanItemsList({ items }: { items: LoanItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E5ECF6] bg-white">
      <div className="grid grid-cols-[1fr_85px_85px] gap-2 bg-[#F8FAFE] px-4 py-2.5 text-[11px] font-semibold text-[#7586A0]">
        <span>Artículo</span><span className="text-right">Cantidad</span><span className="text-right">Devueltas</span>
      </div>
      {items.map((item) => (
        <div key={item.id} className="grid grid-cols-[1fr_85px_85px] items-center gap-2 border-t border-[#EDF1F7] px-4 py-3 text-[12px]">
          <span className="flex min-w-0 items-center gap-2 font-semibold text-[#2C4262]"><Package className="h-4 w-4 shrink-0 text-[#6697D9]" /><span className="truncate" title={item.nombre}>{item.nombre}</span></span>
          <span className="text-right font-semibold tabular-nums text-[#425878]">{item.cantidad}</span>
          <span className="text-right font-semibold tabular-nums text-[#1B8E57]">{item.devueltas}</span>
        </div>
      ))}
    </div>
  );
}
