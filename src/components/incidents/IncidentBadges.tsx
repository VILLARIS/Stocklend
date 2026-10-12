
import {
  AlertTriangle,
  PackageX,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type {
  IncidentStatus,
  IncidentType,
} from "../../data/demoIncidents";

const typeStyles: Record<
  IncidentType,
  {
    icon: LucideIcon;
    className: string;
  }
> = {
  Daño: {
    icon: Wrench,
    className: "bg-[#FFF0F2] text-[#D65367]",
  },
  Pérdida: {
    icon: PackageX,
    className: "bg-[#FFF0F2] text-[#D65367]",
  },
  Faltante: {
    icon: AlertTriangle,
    className: "bg-[#F2EEFF] text-[#7B62CE]",
  },
};

const statusStyles: Record<IncidentStatus, string> = {
  Abierto:
    "border-[#F9E2C2] bg-[#FFF5E9] text-[#B87916]",
  "En revisión":
    "border-[#D8E8FF] bg-[#EDF5FF] text-[#3479DA]",
  Resuelto:
    "border-[#CFE9D8] bg-[#EDF8F1] text-[#1B8E57]",
};

export function IncidentTypeBadge({
  type,
}: {
  type: IncidentType;
}) {
  const style = typeStyles[type];
  const Icon = style.icon;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        whitespace-nowrap rounded-lg
        px-2.5 py-1
        text-[11.5px] font-semibold
        ${style.className}
      `}
    >
      <Icon
        className="h-3.5 w-3.5"
        aria-hidden="true"
      />
      {type}
    </span>
  );
}

export function IncidentStatusBadge({
  status,
}: {
  status: IncidentStatus;
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-2
        whitespace-nowrap rounded-xl
        border px-3 py-1.5
        text-[11.5px] font-semibold
        ${statusStyles[status]}
      `}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
