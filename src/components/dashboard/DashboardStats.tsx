
import {
  Box,
  Layers3,
  CircleCheck,
  ArrowRightLeft,
} from "lucide-react";

import { StatCardV2 } from "../ui/StatCardV2";
import { demoStats } from "../../data/demoData";

const visualStats = {
  articles: {
    icon: <Box />,
    accent: "blue" as const,
    change: "12%",
    changeText: "+15 este mes",
    direction: "up" as const,
    positive: true,
    chartData: [10, 12, 19, 17, 22, 27, 37],
  },

  units: {
    icon: <Layers3 />,
    accent: "violet" as const,
    change: "6%",
    changeText: "+18 desde el mes pasado",
    direction: "up" as const,
    positive: true,
    chartData: [11, 16, 21, 20, 28, 29, 39],
  },

  available: {
    icon: <CircleCheck />,
    accent: "green" as const,
    change: "8%",
    changeText: "+16 desde el mes pasado",
    direction: "up" as const,
    positive: true,
    chartData: [12, 14, 23, 21, 20, 29, 37],
  },

  loaned: {
    icon: <ArrowRightLeft />,
    accent: "orange" as const,
    change: "20%",
    changeText: "-6 desde el mes pasado",
    direction: "down" as const,
    positive: false,
    chartData: [36, 33, 25, 24, 27, 17, 12],
  },
};

export function DashboardStats() {
  return (
    <section
      aria-label="Resumen del inventario"
      className="
        grid min-w-0 grid-cols-1 gap-3
        @[560px]:grid-cols-2
        @[960px]:grid-cols-4
      "
    >
      {demoStats.map((stat) => {
        const visual =
          visualStats[stat.key as keyof typeof visualStats];

        if (!visual) return null;

        return (
          <StatCardV2
            key={stat.key}
            value={stat.value}
            label={stat.label}
            icon={visual.icon}
            accent={visual.accent}
            change={visual.change}
            changeText={visual.changeText}
            direction={visual.direction}
            positive={visual.positive}
            chartData={visual.chartData}
          />
        );
      })}
    </section>
  );
}
