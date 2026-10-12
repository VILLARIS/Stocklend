
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Eye,
  MoreHorizontal,
} from "lucide-react";

import type { DemoIncident } from "../../data/demoIncidents";

interface IncidentActionsMenuProps {
  incident: DemoIncident;
  onDetails: (incident: DemoIncident) => void;
}

export function IncidentActionsMenu({
  incident,
  onDetails,
}: IncidentActionsMenuProps) {
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
    onDetails(incident);
  };

  return (
    <div
      ref={menuRef}
      className="relative inline-block"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        title="Acciones"
        aria-label={`Acciones de ${incident.codigo}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((previous) => !previous)}
        className="
          flex h-8 w-8 items-center justify-center
          rounded-lg text-[#617794]
          transition-colors duration-200
          hover:bg-[#EAF2FF]
          hover:text-[#267BFA]
        "
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="
            absolute right-0 top-9 z-30
            w-40 rounded-xl
            border border-[#DFE7F2]
            bg-white p-1.5
            shadow-[0_12px_28px_rgba(24,59,100,0.16)]
          "
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleDetails}
            className="
              flex w-full items-center gap-2
              rounded-lg px-3 py-2
              text-left text-[12px] font-medium
              text-[#37516E]
              hover:bg-[#F0F6FF]
            "
          >
            <Eye className="h-4 w-4" />
            Ver detalles
          </button>
        </div>
      )}
    </div>
  );
}
