
import { ChartPie } from "lucide-react";

import {
  InventoryDonutChart,
  type ChartSegment,
} from "../ui/DashboardCharts";

import {
  DashboardPanel,
  PanelHeader,
} from "./DashboardPanel";

// Datos de demostración.
const inventorySegments: ChartSegment[] = [
  {
    label: "Disponible",
    value: 214,
    color: "#45C59A",
  },
  {
    label: "Prestado",
    value: 24,
    color: "#3B8BFF",
  },
  {
    label: "Dañado",
    value: 12,
    color: "#FFBC49",
  },
  {
    label: "Faltante",
    value: 68,
    color: "#FF7280",
  },
];

export function InventoryStatusPanel() {
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
