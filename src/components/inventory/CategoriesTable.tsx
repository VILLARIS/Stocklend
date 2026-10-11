
import { useMemo } from "react";

import {
  FolderPlus,
  Tags,
  CookingPot,
  Plug,
  Utensils,
  Wine,
  Wrench,
  Package,
  type LucideIcon,
} from "lucide-react";

import { DataTable, type Column } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { CategoryActionsMenu } from "./CategoryActionsMenu";

import type { InventoryCategory } from "../../data/inventoryData";

// ========================================
// ICONOS DE CATEGORÍAS
// ========================================

function getCategoryIcon(name: string): LucideIcon {
  const value = name.toLowerCase();

  if (value.includes("utensilio")) {
    return CookingPot;
  }

  if (
    value.includes("electrodoméstico") ||
    value.includes("electrodomestico")
  ) {
    return Plug;
  }

  if (value.includes("menaje")) {
    return Utensils;
  }

  if (
    value.includes("cristalería") ||
    value.includes("cristaleria")
  ) {
    return Wine;
  }

  if (value.includes("herramienta")) {
    return Wrench;
  }

  return Package;
}

function CategoryThumbnail({ name }: { name: string }) {
  const Icon = getCategoryIcon(name);

  return (
    <div
      className="
        flex h-10 w-10 shrink-0
        items-center justify-center rounded-xl
        border border-[#DDEBFF]
        bg-gradient-to-br
        from-[#F0F6FF] to-[#E8F1FF]
        text-[#4381D7]
        transition-colors duration-200
        group-hover:border-[#C8DEFF]
        group-hover:bg-[#DFEDFF]
      "
      aria-hidden="true"
    >
      <Icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
    </div>
  );
}

// ========================================
// PROPIEDADES
// ========================================

interface CategoriesTableProps {
  items: InventoryCategory[];
  filtered: boolean;
  onClear: () => void;
  onNew: () => void;
  onViewArticles: (categoria: InventoryCategory) => void;
  onEdit: (categoria: InventoryCategory) => void;
}

// ========================================
// TABLA DE CATEGORÍAS
// ========================================

export function CategoriesTable({
  items,
  filtered,
  onClear,
  onNew,
  onViewArticles,
  onEdit,
}: CategoriesTableProps) {
  const columns = useMemo<Column<InventoryCategory>[]>(
    () => [
      {
        key: "nombre",
        header: "Categoría",
        width: "270px",
        render: (row) => (
          <div className="group flex min-w-0 items-center gap-3 py-0.5">
            <CategoryThumbnail name={row.nombre} />

            <span
              className="
                min-w-0 truncate
                text-[13px] font-semibold
                text-[#1D3155]
              "
              title={row.nombre}
            >
              {row.nombre}
            </span>
          </div>
        ),
      },
      {
        key: "descripcion",
        header: "Descripción",
        render: (row) =>
          row.descripcion ? (
            <span
              className="
                block max-w-full truncate
                text-[12.5px] leading-5
                text-[#657790]
              "
              title={row.descripcion}
            >
              {row.descripcion}
            </span>
          ) : (
            <span className="text-[13px] text-[#A7B2C1]">
              —
            </span>
          ),
      },
      {
        key: "articulos",
        header: "Artículos",
        width: "135px",
        align: "right",
        render: (row) => (
          <span
            className={`
              inline-flex min-w-[36px] items-center
              justify-center rounded-lg px-2.5 py-1
              text-[12px] font-semibold tabular-nums
              ${
                row.articulos === 0
                  ? "bg-[#F2F4F8] text-[#9AA7B8]"
                  : "bg-[#E9F2FF] text-[#3478D5]"
              }
            `}
          >
            {row.articulos}
          </span>
        ),
      },
      {
        key: "acciones",
        header: "Acciones",
        width: "95px",
        align: "right",
        render: (row) => (
          <div className="flex justify-end">
            <CategoryActionsMenu
              categoria={row}
              onViewArticles={onViewArticles}
              onEdit={onEdit}
            />
          </div>
        ),
      },
    ],
    [onViewArticles, onEdit]
  );

  return (
    <div className="min-w-0">
      <DataTable
        columns={columns}
        data={items}
        keyField="id"
        flat
        empty={
          filtered ? (
            <EmptyState
              icon={<Tags />}
              title="Sin resultados"
              description="Ninguna categoría coincide con la búsqueda."
              action={
                <Button variant="secondary" onClick={onClear}>
                  Limpiar búsqueda
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<FolderPlus />}
              title="Sin categorías"
              description="Todavía no hay categorías registradas. Crea la primera para organizar los artículos del inventario."
              action={
                <Button onClick={onNew}>
                  Nueva categoría
                </Button>
              }
            />
          )
        }
      />
    </div>
  );
}
