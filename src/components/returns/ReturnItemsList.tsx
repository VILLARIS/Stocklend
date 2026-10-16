
import {
  CheckCircle2,
  Package,
} from "lucide-react";

import type { ReturnRecord } from "../../types/returns";

interface ReturnItemsListProps {
  loan: ReturnRecord;
}

export function ReturnItemsList({
  loan,
}: ReturnItemsListProps) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[#E4ECF7] bg-white">
      <div className="overflow-x-auto">
        <div className="min-w-[470px]">
          <div
            className="
              grid grid-cols-[minmax(0,1fr)_72px_80px_80px]
              gap-2 border-b border-[#E9EEF6]
              bg-[#F8FAFE] px-3 py-3
              text-[10.5px] font-semibold
              text-[#7186A3]
            "
          >
            <span>Artículo</span>
            <span className="text-center">Total</span>
            <span className="text-center">Devuelto</span>
            <span className="text-center">Pendiente</span>
          </div>

          {loan.items.map((item) => {
            const remaining = Math.max(
              0,
              item.cantidad - item.devueltas
            );

            return (
              <div
                key={item.id}
                className="
                  grid grid-cols-[minmax(0,1fr)_72px_80px_80px]
                  items-center gap-2
                  border-b border-[#E9EEF6]
                  bg-white px-3 py-3
                  transition-colors
                  last:border-0
                  hover:bg-[#F8FBFF]
                "
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      remaining === 0
                        ? "bg-[#EAF8F0] text-[#1E9D69]"
                        : "bg-[#EDF5FF] text-[#4585D7]"
                    }`}
                  >
                    {remaining === 0 ? (
                      <CheckCircle2 className="h-[17px] w-[17px]" />
                    ) : (
                      <Package className="h-[17px] w-[17px]" />
                    )}
                  </div>

                  <span
                    className="min-w-0 truncate text-[12px] font-semibold text-[#294363]"
                    title={item.nombre}
                  >
                    {item.nombre}
                  </span>
                </div>

                <span className="text-center text-[12px] font-semibold tabular-nums text-[#4D607B]">
                  {item.cantidad}
                </span>

                <span className="text-center text-[12px] font-semibold tabular-nums text-[#1B9B66]">
                  {item.devueltas}
                </span>

                <span
                  className={`text-center text-[12px] font-semibold tabular-nums ${
                    remaining > 0
                      ? "text-[#C48222]"
                      : "text-[#9AA9B9]"
                  }`}
                >
                  {remaining}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#E9EEF6] bg-[#F8FAFE] px-4 py-3">
        <span className="text-[11.5px] font-semibold text-[#586F90]">
          Total del préstamo
        </span>

        <span className="text-[12px] font-semibold tabular-nums text-[#3178D5]">
          {loan.devueltas} de {loan.total} devueltas
        </span>
      </div>
    </div>
  );
}
