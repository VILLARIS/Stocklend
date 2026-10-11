
import {
  AlertTriangle,
  CalendarDays,
  PackageX,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type {
  IncidentEstado,
  IncidentTipo,
  StudentIncident,
} from "../../data/demoStudents";

import { formatFecha } from "../../data/demoStudents";

interface StudentIncidentsListProps {
  incidents: StudentIncident[];
}

const typeStyles: Record<
  IncidentTipo,
  {
    icon: LucideIcon;
    iconColor: string;
    iconBackground: string;
    badge: string;
  }
> = {
  Pérdida: {
    icon: PackageX,
    iconColor: "text-[#D95C70]",
    iconBackground: "bg-[#FFF0F2]",
    badge:
      "border-[#F7DCE2] bg-[#FFF0F2] text-[#D65367]",
  },
  Daño: {
    icon: Wrench,
    iconColor: "text-[#CE8A29]",
    iconBackground: "bg-[#FFF6E8]",
    badge:
      "border-[#F5E3C4] bg-[#FFF7EB] text-[#B87916]",
  },
  Faltante: {
    icon: AlertTriangle,
    iconColor: "text-[#CE8A29]",
    iconBackground: "bg-[#FFF6E8]",
    badge:
      "border-[#F5E3C4] bg-[#FFF7EB] text-[#B87916]",
  },
};

const stateStyles: Record<
  IncidentEstado,
  {
    container: string;
    dot: string;
  }
> = {
  Abierto: {
    container:
      "border-[#F5E3C4] bg-[#FFF7EB] text-[#B87916]",
    dot: "bg-[#F5AD35]",
  },
  Resuelto: {
    container:
      "border-[#CFE9D8] bg-[#EDF8F1] text-[#1B8E57]",
    dot: "bg-[#1FB56C]",
  },
};

function IncidentTypeBadge({
  type,
}: {
  type: IncidentTipo;
}) {
  return (
    <span
      className={`
        inline-flex items-center
        whitespace-nowrap rounded-lg
        border px-2.5 py-1
        text-[10.5px] font-semibold
        ${typeStyles[type].badge}
      `}
    >
      {type}
    </span>
  );
}

function IncidentStateBadge({
  state,
}: {
  state: IncidentEstado;
}) {
  const styles = stateStyles[state];

  return (
    <span
      className={`
        inline-flex h-8 items-center
        gap-2 whitespace-nowrap
        rounded-xl border px-3
        text-[11.5px] font-semibold
        ${styles.container}
      `}
    >
      <span
        className={`
          h-2 w-2 shrink-0 rounded-full
          ${styles.dot}
        `}
      />
      {state}
    </span>
  );
}

export function StudentIncidentsList({
  incidents,
}: StudentIncidentsListProps) {
  if (incidents.length === 0) {
    return (
      <div
        className="
          flex min-h-[145px] flex-col
          items-center justify-center gap-2.5
          px-4 py-6 text-center
        "
      >
        <div
          className="
            flex h-11 w-11 items-center
            justify-center rounded-2xl
            bg-[#EDF8F1] text-[#29A570]
          "
        >
          <ShieldCheck
            className="h-5 w-5"
            strokeWidth={1.8}
          />
        </div>

        <p className="text-[12.5px] font-semibold text-[#344B6D]">
          Sin incidencias asociadas
        </p>

        <p className="max-w-[310px] text-[11.5px] leading-5 text-[#8A99B0]">
          Este estudiante no tiene pérdidas,
          daños ni faltantes registrados.
        </p>
      </div>
    );
  }

  return (
    <ul className="min-w-0 divide-y divide-[#E9EEF6]">
      {incidents.map((incident) => {
        const style = typeStyles[incident.tipo];
        const Icon = style.icon;

        return (
          <li
            key={incident.id}
            className="
              flex min-w-0 flex-wrap
              items-center gap-3
              bg-white px-4 py-3
              transition-colors duration-200
              hover:bg-[#F4F8FF]
            "
          >
            {/* ICONO */}
            <div
              aria-hidden="true"
              className={`
                flex h-10 w-10 shrink-0
                items-center justify-center
                rounded-xl ${style.iconBackground}
                ${style.iconColor}
              `}
            >
              <Icon
                className="h-[19px] w-[19px]"
                strokeWidth={1.8}
              />
            </div>

            {/* ARTÍCULO Y CÓDIGO */}
            <div className="min-w-[140px] flex-1">
              <p
                className="
                  truncate text-[12.5px]
                  font-semibold text-[#243A5B]
                "
                title={incident.articulo}
              >
                {incident.articulo}
              </p>

              <span
                className="
                  mt-1 inline-flex items-center
                  rounded-md bg-[#F0F5FC]
                  px-2 py-0.5
                  font-mono text-[10.5px]
                  text-[#6280A6]
                "
              >
                {incident.codigo}
              </span>
            </div>

            {/* TIPO */}
            <IncidentTypeBadge type={incident.tipo} />

            {/* FECHA */}
            <span
              className="
                inline-flex items-center gap-1.5
                whitespace-nowrap
                text-[11.5px] tabular-nums
                text-[#8393A9]
              "
            >
              <CalendarDays
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
              {formatFecha(incident.fecha)}
            </span>

            {/* ESTADO */}
            <IncidentStateBadge
              state={incident.estado}
            />
          </li>
        );
      })}
    </ul>
  );
}
