
import background from "../assets/background/background.png";
import { AlertTriangle, CalendarDays, RefreshCw } from "lucide-react";

import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";

import { DashboardStats } from "../components/dashboard/DashboardStats";
import { WeeklyLoansPanel } from "../components/dashboard/WeeklyLoansPanel";
import { InventoryStatusPanel } from "../components/dashboard/InventoryStatusPanel";
import { RecentLoansPanel } from "../components/dashboard/RecentLoansPanel";

import { useDashboard } from "../hooks/useDashboard";

function DashboardSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-[1800px] flex-col gap-3"
      aria-busy="true"
      aria-label="Cargando el panel"
    >
      <section
        className="
          grid min-w-0 grid-cols-1 gap-3
          @[560px]:grid-cols-2
          @[960px]:grid-cols-4
        "
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="
              flex min-h-[132px] min-w-0
              animate-pulse flex-col justify-between
              rounded-[18px]
              border border-white/80
              bg-white/70
              px-4 py-3.5
              shadow-[0_5px_20px_rgba(27,61,114,0.055)]
            "
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-[#E7F1FF]" />
              <div className="h-7 w-20 rounded-md bg-[#E7F1FF]" />
            </div>

            <div className="mt-2 h-4 w-32 rounded bg-[#EDF2FA]" />
            <div className="mt-2 h-3 w-40 rounded bg-[#F1F5FB]" />
          </div>
        ))}
      </section>

      <div
        className="
          grid min-w-0 grid-cols-1 gap-3
          @[950px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]
          @[950px]:grid-rows-[minmax(0,0.94fr)_minmax(0,1fr)]
        "
      >
        <div
          className="
            min-h-[320px] animate-pulse rounded-[20px]
            border border-white/80 bg-white/70 p-4
            shadow-[0_5px_20px_rgba(27,61,114,0.055)]
            @[950px]:row-span-2 @[950px]:min-h-[390px]
          "
        />
        <div
          className="
            min-h-[190px] animate-pulse rounded-[20px]
            border border-white/80 bg-white/70 p-4
            shadow-[0_5px_20px_rgba(27,61,114,0.055)]
          "
        />
        <div
          className="
            min-h-[190px] animate-pulse rounded-[20px]
            border border-white/80 bg-white/70 p-4
            shadow-[0_5px_20px_rgba(27,61,114,0.055)]
          "
        />
      </div>
    </div>
  );
}

interface ErrorStateProps {
  message: string | null;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      className="
        mx-auto flex w-full max-w-[1800px]
        items-center justify-center py-10
      "
      role="alert"
    >
      <div
        className="
          flex w-full max-w-md flex-col items-center
          gap-3 rounded-[20px]
          border border-white/80 bg-white/90
          px-6 py-8 text-center
          shadow-[0_5px_20px_rgba(27,61,114,0.055)]
          backdrop-blur-md
        "
      >
        <div
          className="
            flex h-12 w-12 items-center justify-center
            rounded-2xl bg-error-tint text-error
          "
        >
          <AlertTriangle className="h-6 w-6" />
        </div>

        <h2 className="text-[15px] font-semibold text-text">
          No se pudo cargar el panel
        </h2>

        <p className="text-[13px] leading-5 text-text-secondary">
          {message ?? "Ocurrió un error inesperado."}
        </p>

        <Button onClick={onRetry} className="mt-1">
          <RefreshCw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
      </div>
    </div>
  );
}

export function DashboardV2() {
  const todayRaw = new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const today =
    todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  const { data, status, error, refetch } = useDashboard();

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
          }
        />
      </div>

      {/* CONTENIDO DEL DASHBOARD */}
      <main
        className="
          min-h-0 min-w-0 flex-1
          overflow-y-auto
          px-4 py-4
        "
      >
        {status === "error" ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : data === null ? (
          <DashboardSkeleton />
        ) : (
          <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3">
            {/* TARJETAS DE ESTADÍSTICAS */}
            <DashboardStats stats={data.estadisticas} />

            {/* PANELES */}
            <div
              className="
                grid min-w-0 grid-cols-1 gap-3
                @[950px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]
                @[950px]:grid-rows-[minmax(0,0.94fr)_minmax(0,1fr)]
              "
            >
              <WeeklyLoansPanel
                actividad={data.actividad_semanal}
              />

              <InventoryStatusPanel
                distribucion={data.distribucion_inventario}
              />

              <RecentLoansPanel
                prestamos={data.prestamos_recientes}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
