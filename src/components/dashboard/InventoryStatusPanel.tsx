
import { ChartPie } from "lucide-react";

import { InventoryDonutChart } from "./charts/InventoryDonutChart";
import type { ChartSegment } from "./charts/types";

import type { InventoryDistribution } from "../../types/dashboard";

import {
  DashboardPanel,
  PanelHeader,
} from "./DashboardPanel";

interface InventoryStatusPanelProps {
  distribucion: InventoryDistribution;
}

export function InventoryStatusPanel({
  distribucion,
}: InventoryStatusPanelProps) {
  const inventorySegments: ChartSegment[] = [
    {
      label: "Disponible",
      value: distribucion.disponible,
      color: "#45C59A",
    },
    {
      label: "Prestado",
      value: distribucion.prestado,
      color: "#3B8BFF",
    },
    {
      label: "Dañado",
      value: distribucion.danado,
      color: "#FFBC49",
    },
    {
      label: "Faltante",
      value: distribucion.faltante,
      color: "#FF7280",
    },
  ];

  return (
    <DashboardPanel className="min-h-[190px]">
      {/* ENCABEZADO */}
      <PanelHeader
        title="Estado del inventario"
        subtitle="Distribución de unidades por estado"
        icon={<ChartPie />}
      />

      {/* GRÁFICO DE DONA INTERACTIVO */}
      <div
        className="
          mt-2 min-h-0 min-w-0 flex-1
        "
      >
        <InventoryDonutChart
          data={inventorySegments}
        />
      </div>
    </DashboardPanel>
  );
}
