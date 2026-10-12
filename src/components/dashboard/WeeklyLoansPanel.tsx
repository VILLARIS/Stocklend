
import { ChartNoAxesCombined } from "lucide-react";

import { WeeklyLoansChart } from "./charts/WeeklyLoansChart";
import type { ChartPoint } from "./charts/types";

import type { WeeklyActivityDay } from "../../types/dashboard";

import {
  DashboardPanel,
  PanelHeader,
} from "./DashboardPanel";

interface WeeklyLoansPanelProps {
  actividad: WeeklyActivityDay[];
}

export function WeeklyLoansPanel({
  actividad,
}: WeeklyLoansPanelProps) {
  const weeklyLoans: ChartPoint[] = actividad.map((dia) => ({
    label: dia.etiqueta,
    value: dia.prestamos,
  }));

  const weeklyTotal = weeklyLoans.reduce(
    (sum, day) => sum + day.value,
    0
  );

  const weeklyAverage =
    weeklyLoans.length > 0
      ? weeklyTotal / weeklyLoans.length
      : 0;

  const busiestDay =
    weeklyTotal > 0
      ? weeklyLoans.reduce((masActivo, dia) =>
          dia.value > masActivo.value ? dia : masActivo
        )
      : null;

  return (
    <DashboardPanel
      className="
        min-h-[320px]
        @[950px]:row-span-2
        @[950px]:min-h-[390px]
      "
    >
      {/* ENCABEZADO */}
      <PanelHeader
        title="Préstamos por semana"
        subtitle="Actividad registrada durante los últimos 7 días"
        icon={<ChartNoAxesCombined />}
        action={
          <span
            className="
              rounded-lg border border-[#E4ECF7]
              bg-[#F4F8FF] px-2.5 py-1
              text-[11px] font-medium
              text-[#54749F]
            "
          >
            Últimos 7 días
          </span>
        }
      />

      {/* TOTAL DE PRÉSTAMOS */}
      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        <strong
          className="
            text-[31px] font-bold leading-none
            tracking-tight tabular-nums
            text-[#132651]
          "
        >
          {weeklyTotal}
        </strong>

        <span className="text-[11px] text-[#7585A1]">
          préstamos registrados esta semana
        </span>
      </div>

      {/* GRÁFICO */}
      <div
        className="
          mt-2 h-[195px]
          min-h-0 min-w-0 flex-1
        "
      >
        <WeeklyLoansChart data={weeklyLoans} />
      </div>

      {/* RESUMEN INFERIOR */}
      <div
        className="
          mt-2 grid grid-cols-2 gap-3
          border-t border-[#E8EEF7]
          pt-2.5
        "
      >
        {/* PROMEDIO */}
        <div className="min-w-0">
          <p className="text-[10px] text-[#8290A9]">
            Promedio diario
          </p>

          <p
            className="
              mt-1 text-[15px]
              font-semibold tabular-nums
              text-[#182B52]
            "
          >
            {weeklyAverage.toFixed(1)}

            <span
              className="
                ml-1 text-[10px]
                font-normal text-[#8290A9]
              "
            >
              préstamos
            </span>
          </p>
        </div>

        {/* DÍA DE MAYOR ACTIVIDAD */}
        <div className="min-w-0">
          <p className="text-[10px] text-[#8290A9]">
            Día con más actividad
          </p>

          <p
            className="
              mt-1 text-[15px]
              font-semibold text-[#182B52]
            "
          >
            {busiestDay?.label ?? "—"}

            <span
              className="
                ml-2 text-[10px]
                font-normal text-[#8290A9]
              "
            >
              {busiestDay?.value ?? 0} préstamos
            </span>
          </p>
        </div>
      </div>
    </DashboardPanel>
  );
}
