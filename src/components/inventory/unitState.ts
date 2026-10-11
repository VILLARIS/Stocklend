import type { UnitState } from "../../data/inventoryData";

export type BadgeVariant = "success" | "warning" | "error" | "neutral" | "info";

export const UNIT_STATES: UnitState[] = [
  "Disponible",
  "Prestada",
  "Dañada",
  "Faltante",
  "Baja",
];

export const unitStateVariant: Record<UnitState, BadgeVariant> = {
  Disponible: "success",
  Prestada: "info",
  Dañada: "warning",
  Faltante: "error",
  Baja: "neutral",
};
