
import {
  ClipboardList,
  MoreHorizontal,
  RotateCcw,
} from "lucide-react";

import { useFloatingMenu } from "../../hooks/useFloatingMenu";
import { FloatingMenu } from "../ui/FloatingMenu";

import type { ReturnRecord } from "../../types/returns";

interface ReturnActionsMenuProps {
  item: ReturnRecord;
  onDetails: (item: ReturnRecord) => void;
  onReturn: (item: ReturnRecord) => void;
}

export function ReturnActionsMenu({
  item,
  onDetails,
  onReturn,
}: ReturnActionsMenuProps) {
  const { open, setOpen, pos, buttonRef, menuRef } =
    useFloatingMenu({
      menuWidth: 205,
      estimatedHeight: item.pendientes > 0 ? 104 : 56,
    });

  const handleDetails = () => {
    setOpen(false);
    onDetails(item);
  };

  const handleReturn = () => {
    setOpen(false);
    onReturn(item);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title="Opciones"
        aria-label={`Acciones de ${item.folio}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((previous) => !previous);
        }}
        className="
          flex h-8 w-8 items-center justify-center
          rounded-lg text-[#60758F]
          transition-colors duration-200
          hover:bg-[#EAF2FF]
          hover:text-[#267BFA]
          focus-visible:outline-2
          focus-visible:outline-[#398BFF]
        "
      >
        <MoreHorizontal className="h-[18px] w-[18px]" />
      </button>

      <FloatingMenu
        open={open}
        pos={pos}
        menuRef={menuRef}
        label={`Acciones de ${item.folio}`}
        className="
          fixed z-40
          w-[205px] rounded-xl
          border border-[#DFE7F2]
          bg-white p-1.5
          shadow-[0_12px_32px_rgba(24,59,100,0.15)]
        "
      >
        <button
          type="button"
          role="menuitem"
          onClick={handleDetails}
          className="
            flex w-full items-center gap-2.5
            rounded-lg px-3 py-2.5
            text-left text-[12px] font-medium
            text-[#36516F]
            hover:bg-[#F0F6FF]
          "
        >
          <ClipboardList className="h-4 w-4 text-[#7187A7]" />
          Ver detalles
        </button>

        {item.pendientes > 0 && (
          <button
            type="button"
            role="menuitem"
            onClick={handleReturn}
            className="
              flex w-full items-center gap-2.5
              rounded-lg px-3 py-2.5
              text-left text-[12px] font-semibold
              text-[#287BE7]
              hover:bg-[#F0F6FF]
            "
          >
            <RotateCcw className="h-4 w-4" />
            Registrar devolución
          </button>
        )}
      </FloatingMenu>
    </>
  );
}
