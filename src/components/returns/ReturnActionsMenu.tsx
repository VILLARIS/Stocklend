
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ClipboardList,
  MoreHorizontal,
  RotateCcw,
} from "lucide-react";

import type { ReturnRecord } from "../../data/demoReturns";

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
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open]);

  const handleDetails = () => {
    setOpen(false);
    onDetails(item);
  };

  const handleReturn = () => {
    setOpen(false);
    onReturn(item);
  };

  return (
    <div
      ref={menuRef}
      className="relative"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        title="Opciones"
        aria-label={`Acciones de ${item.folio}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
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

      {open && (
        <div
          role="menu"
          className="
            absolute right-0 top-9 z-40
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
        </div>
      )}
    </div>
  );
}
