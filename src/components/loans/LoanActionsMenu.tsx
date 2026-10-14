import { useEffect, useRef, useState } from "react";
import { Eye, MoreHorizontal } from "lucide-react";
import type { DemoLoan } from "../../types/loans";

interface LoanActionsMenuProps {
  loan: DemoLoan;
  onDetails: (loan: DemoLoan) => void;
}

export function LoanActionsMenu({ loan, onDetails }: LoanActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="relative inline-flex" ref={rootRef} onClick={(event) => event.stopPropagation()}>
      <button type="button" aria-label={`Acciones de ${loan.folio}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((previous) => !previous)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7184A0] transition-colors hover:bg-[#E9F2FF] hover:text-[#287CF3] focus-visible:outline-2 focus-visible:outline-[#398BFF]">
        <MoreHorizontal className="h-[18px] w-[18px]" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-[165px] rounded-xl border border-[#E1EAF5] bg-white p-1.5 shadow-[0_10px_30px_rgba(31,65,122,0.16)]">
          <button role="menuitem" type="button" onClick={() => { setOpen(false); onDetails(loan); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-medium text-[#354D70] hover:bg-[#F0F6FF] hover:text-[#2375E5]">
            <Eye className="h-4 w-4" /> Ver detalles
          </button>
        </div>
      )}
    </div>
  );
}
