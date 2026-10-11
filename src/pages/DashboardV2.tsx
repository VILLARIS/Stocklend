
import background from "../assets/background/background.png";
import { CalendarDays } from "lucide-react";

import { PageHeader } from "../components/layout/PageHeader";

import { DashboardStats } from "../components/dashboard/DashboardStats";
import { WeeklyLoansPanel } from "../components/dashboard/WeeklyLoansPanel";
import { InventoryStatusPanel } from "../components/dashboard/InventoryStatusPanel";
import { RecentLoansPanel } from "../components/dashboard/RecentLoansPanel";

import { DEMO_MODE } from "../data/demoData";

export function DashboardV2() {
  const todayRaw = new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const today =
    todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  return (
    <div
      className="
        flex min-h-0 min-w-0 flex-1
        flex-col overflow-hidden
        bg-cover bg-center bg-no-repeat
      "
      style={{
        backgroundImage: `url(${background})`,
      }}
    >
      {/* ENCABEZADO PRINCIPAL */}
      <div className="shrink-0">
        <PageHeader
          title="Panel de control"
          subtitle="Resumen general del inventario y préstamos"
          meta={
            <>
              <span
                className="
                  hidden items-center gap-2
                  text-[12px] text-text-secondary
                  @[760px]:inline-flex
                "
              >
                <CalendarDays className="h-4 w-4" />
                {today}
              </span>

              {DEMO_MODE && (
                <span
                  className="
                    inline-flex h-8 items-center gap-2
                    rounded-full border border-white/80
                    bg-white/90 px-3
                    text-[11px] font-medium
                    text-[#405783] shadow-sm
                  "
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#267BFA]" />
                  Vista de demostración
                </span>
              )}
            </>
          }
        />
      </div>

      {/* CONTENIDO DEL DASHBOARD */}
      <main
        className="
          min-h-0 min-w-0 flex-1
          overflow-x-hidden overflow-y-auto
          px-4 pb-3 pt-3
          @[1100px]:px-5
        "
      >
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3">

          {/* CUATRO TARJETAS ESTADÍSTICAS */}
          <DashboardStats />

          {/* GRÁFICOS Y PRÉSTAMOS */}
          <div
            className="
              grid min-w-0 grid-cols-1 gap-3

              @[950px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]
              @[950px]:grid-rows-[minmax(0,0.94fr)_minmax(0,1fr)]
            "
          >
            <WeeklyLoansPanel />

            <InventoryStatusPanel />

            <RecentLoansPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
