
import { type ReactNode } from "react";
import {
  Box,
  Layers3,
  CircleCheck,
  ArrowRightLeft,
} from "lucide-react";

import {
  StatCardV2,
  type StatAccent,
} from "../ui/StatCardV2";
import type { DashboardStats as PanelStats } from "../../types/dashboard";

interface StatCardConfig {
  key: string;
  label: string;
  hint: string;
  icon: ReactNode;
  accent: StatAccent;
  value: number;
}

interface DashboardStatsProps {
  stats: PanelStats;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const cards: StatCardConfig[] = [
    {
      key: "articles",
      label: "Artículos registrados",
      hint: "Artículos activos del inventario",
      icon: <Box />,
      accent: "blue",
      value: stats.articulos_activos,
    },
    {
      key: "units",
      label: "Unidades en existencia",
      hint: "Total de unidades registradas",
      icon: <Layers3 />,
      accent: "violet",
      value: stats.unidades_totales,
    },
    {
      key: "available",
      label: "Disponibles para prestar",
      hint: "Unidades listas para préstamo",
      icon: <CircleCheck />,
      accent: "green",
      value: stats.unidades_disponibles,
    },
    {
      key: "loaned",
      label: "Prestadas a estudiantes",
      hint: "Unidades actualmente en préstamo",
      icon: <ArrowRightLeft />,
      accent: "orange",
      value: stats.unidades_prestadas,
    },
  ];

  return (
    <section
      aria-label="Resumen del inventario"
      className="
        grid min-w-0 grid-cols-1 gap-3
        @[560px]:grid-cols-2
        @[960px]:grid-cols-4
      "
    >
      {cards.map((card) => (
        <StatCardV2
          key={card.key}
          value={card.value}
          label={card.label}
          icon={card.icon}
          accent={card.accent}
          hint={card.hint}
        />
      ))}
    </section>
  );
}
