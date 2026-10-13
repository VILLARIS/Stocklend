// Resolución del icono de un artículo a partir de su nombre.
// Antes estaba duplicada en InventoryTable.tsx y UnitsTable.tsx; ahora es una
// única fuente. El conjunto de palabras clave es la unión de ambas versiones,
// de modo que ninguna miniatura pierde su icono.

import {
  Blend,
  ChefHat,
  Clipboard,
  CookingPot,
  Microwave,
  Package,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export function getArticleIcon(name: string): LucideIcon {
  const value = name.toLowerCase();

  if (
    value.includes("olla") ||
    value.includes("cacerola") ||
    value.includes("sartén") ||
    value.includes("sarten")
  ) {
    return CookingPot;
  }

  if (
    value.includes("cuchillo") ||
    value.includes("cubierto") ||
    value.includes("tenedor")
  ) {
    return UtensilsCrossed;
  }

  if (value.includes("tabla") || value.includes("bandeja")) {
    return Clipboard;
  }

  if (value.includes("licuadora") || value.includes("batidora")) {
    return Blend;
  }

  if (value.includes("horno") || value.includes("microondas")) {
    return Microwave;
  }

  if (value.includes("chef") || value.includes("cocina")) {
    return ChefHat;
  }

  return Package;
}
