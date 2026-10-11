
import {
  Clock3,
  Package,
} from "lucide-react";

import { Badge } from "../ui/Badge";

import {
  DashboardPanel,
  PanelHeader,
} from "./DashboardPanel";

import {
  demoRecentLoans,
} from "../../data/demoData";

// ========================================
// UTILIDADES
// ========================================

function getInitials(fullName: string): string {
  const words = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  return words
    .slice(0, 2)
    .map((word) =>
      word.charAt(0).toUpperCase()
    )
    .join("");
}

// ========================================
// PRÉSTAMOS RECIENTES
// ========================================

export function RecentLoansPanel() {
  const recentLoans = demoRecentLoans.slice(0, 4);

  return (
    <DashboardPanel className="min-h-[190px]">
      {/* ENCABEZADO */}
      <PanelHeader
        title="Préstamos recientes"
        subtitle="Últimas entregas registradas"
        icon={<Clock3 />}
      />

      {/* CONTENIDO */}
      <div className="mt-2 min-w-0 flex-1">

        {/* ESTADO VACÍO */}
        {recentLoans.length === 0 ? (
          <div
            className="
              flex h-full flex-col
              items-center justify-center
              py-5 text-center
            "
          >
            <div
              className="
                flex h-10 w-10
                items-center justify-center
                rounded-xl
                bg-[#EDF5FF]
                text-[#347EED]
              "
            >
              <Package className="h-5 w-5" />
            </div>

            <p
              className="
                mt-2 text-[12px]
                font-medium text-[#344B70]
              "
            >
              Aún no hay préstamos
            </p>

            <p
              className="
                mt-1 text-[11px]
                text-[#8391AA]
              "
            >
              Las últimas entregas aparecerán aquí.
            </p>
          </div>
        ) : (
          /* LISTADO */
          <div className="flex flex-col">
            {recentLoans.map((loan) => {
              const initials = getInitials(
                loan.student
              );

              return (
                <div
                  key={loan.id}
                  className="
                    group flex min-w-0
                    items-center gap-3
                    rounded-xl
                    border-b border-[#EDF1F7]
                    px-2 py-2

                    transition-colors
                    duration-200 ease-out

                    hover:bg-[#F1F7FF]
                    last:border-b-0
                  "
                >
                  {/* AVATAR */}
                  <div
                    className="
                      flex h-9 w-9 shrink-0
                      items-center justify-center
                      rounded-full
                      bg-[#E9F2FF]
                      text-[12px] font-semibold
                      text-[#3677D5]

                      transition-colors
                      duration-200

                      group-hover:bg-[#DDEBFF]
                    "
                  >
                    {initials}
                  </div>

                  {/* INFORMACIÓN PRINCIPAL */}
                  <div className="min-w-0 flex-1">
                    <p
                      className="
                        truncate text-[12px]
                        font-semibold
                        text-[#20365B]
                      "
                      title={loan.student}
                    >
                      {loan.student}
                    </p>

                    {/* DETALLES DEL PRÉSTAMO */}
                    <div
                      className="
                        mt-1 flex min-w-0
                        flex-wrap items-center
                        gap-x-1.5 gap-y-0.5
                      "
                    >
                      {/* CÓDIGO */}
                      <span
                        className="
                          truncate font-mono
                          text-[10px]
                          text-[#8796AD]
                        "
                        title={loan.folio}
                      >
                        {loan.folio}
                      </span>

                      <span className="text-[10px] text-[#B4C0D0]">
                        ·
                      </span>

                      {/* ARTÍCULOS */}
                      <span
                        className="
                          inline-flex
                          items-center gap-1
                          whitespace-nowrap
                          text-[10px]
                          text-[#7185A4]
                        "
                      >
                        <Package className="h-3 w-3" />

                        {loan.items}{" "}
                        {loan.items === 1
                          ? "art."
                          : "arts."}
                      </span>

                      <span className="text-[10px] text-[#B4C0D0]">
                        ·
                      </span>

                      {/* FECHA */}
                      <span
                        className="
                          whitespace-nowrap
                          text-[10px]
                          text-[#8796AD]
                        "
                      >
                        {loan.date}
                      </span>
                    </div>
                  </div>

                  {/* ESTADO */}
                  <div className="shrink-0">
                    <Badge
                      variant={
                        loan.status === "Activo"
                          ? "info"
                          : loan.status === "Cerrado"
                            ? "neutral"
                            : "error"
                      }
                    >
                      {loan.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardPanel>
  );
}
