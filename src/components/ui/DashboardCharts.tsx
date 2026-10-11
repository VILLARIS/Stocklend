
export interface ChartPoint {
  label: string;
  value: number;
}

export interface ChartSegment {
  label: string;
  value: number;
  color: string;
}

export { WeeklyLoansChart } from "../dashboard/charts/WeeklyLoansChart";

export { InventoryDonutChart } from "../dashboard/charts/InventoryDonutChart";

export { CategoryBarChart } from "../dashboard/charts/CategoryBarChart";
