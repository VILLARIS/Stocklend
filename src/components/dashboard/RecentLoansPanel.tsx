
import {
  Clock3,
  Package,
} from "lucide-react";

import { Badge } from "../ui/Badge";

import {
  DashboardPanel,
  PanelHeader,
} from "./DashboardPanel";

import { formatLocalDate } from "../../utils/formatDate";
import type { RecentLoan } from "../../types/dashboard";

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

type LoanBadgeVariant = "info" | "neutral" | "error";

interface LoanStatus {
  label: string;
  variant: LoanBadgeVariant;
}

function describeEstado(estado: string): LoanStatus {
  switch (estado.trim().toLowerCase()) {
    case "activo":
      return { label: "Activo", variant: "info" };
    case "cerrado":
      return { label: "Cerrado", variant: "neutral" };
    case "anulado":
      return { label: "Anulado", variant: "error" };
    default: {
      const limpio = estado.trim();
      return {
        label:
          limpio === ""
            ? "Desconocido"
            : limpio.charAt(0).toUpperCase() +
              limpio.slice(1),
        variant: "neutral",
      };
    }
  }
}

// ========================================
// PRÉSTAMOS RECIENTES
// ========================================

interface RecentLoansPanelProps {
  prestamos: RecentLoan[];
}

export function RecentLoansPanel({
  prestamos,
}: RecentLoansPanelProps) {
  const recentLoans = prestamos;

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
                loan.estudiante
              );

              const estado = describeEstado(loan.estado);

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
                      title={loan.estudiante}
                    >
                      {loan.estudiante}
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

                        {loan.articulos}{" "}
                        {loan.articulos === 1
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
                        {formatLocalDate(loan.fecha) || loan.fecha}
                      </span>
                    </div>
                  </div>

                  {/* ESTADO */}
                  <div className="shrink-0">
                    <Badge variant={estado.variant}>
                      {estado.label}
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
