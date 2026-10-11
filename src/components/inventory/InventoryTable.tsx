import { useMemo } from "react";
import {
  PackageSearch,
  CookingPot,
  UtensilsCrossed,
  ChefHat,
  CookingPot as PanIcon,
  Clipboard,
  Blend,
  Microwave,
  Package,
  type LucideIcon,
} from "lucide-react";

import { DataTable, type Column } from "../ui/DataTable";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { RowActionsMenu } from "./RowActionsMenu";

import type { InventoryArticle } from "../../data/inventoryData";

type Accent = "success" | "warning" | "error";

function Quantity({
  value,
  accent,
}: {
  value: number;
  accent?: Accent;
}) {
  const color =
    value === 0
      ? "text-[#A4AFBF]"
      : accent === "success"
        ? "text-[#17965C]"
        : accent === "warning"
          ? "text-[#D78312]"
          : accent === "error"
            ? "text-[#E43F50]"
            : "text-[#273856]";

  return (
    <span className={`text-[13px] font-medium tabular-nums ${color}`}>
      {value}
    </span>
  );
}

function getArticleIcon(name: string): LucideIcon {
  const normalized = name.toLowerCase();

  if (normalized.includes("olla") || normalized.includes("cacerola")) {
    return CookingPot;
  }

  if (normalized.includes("cuchillo") || normalized.includes("cubierto")) {
    return UtensilsCrossed;
  }

  if (normalized.includes("sartén") || normalized.includes("sarten")) {
    return PanIcon;
  }

  if (normalized.includes("tabla") || normalized.includes("bandeja")) {
    return Clipboard;
  }

  if (normalized.includes("licuadora") || normalized.includes("batidora")) {
    return Blend;
  }

  if (normalized.includes("horno") || normalized.includes("microondas")) {
    return Microwave;
  }

  if (normalized.includes("chef") || normalized.includes("cocina")) {
    return ChefHat;
  }

  return Package;
}

function ArticleThumbnail({
  name,
}: {
  name: string;
}) {
  const Icon = getArticleIcon(name);

  return (
    <div
      className="
        flex h-10 w-10 shrink-0 items-center justify-center
        rounded-xl border border-[#E9EEF6]
        bg-gradient-to-br from-[#F5F8FD] to-[#EBF2FC]
        text-[#6483B4]
        transition-all duration-200
        group-hover:border-[#DCE9FD]
        group-hover:from-[#EAF3FF]
        group-hover:to-[#DDEBFF]
        group-hover:text-[#267BFA]
      "
      aria-hidden="true"
    >
      <Icon className="h-[19px] w-[19px]" strokeWidth={1.7} />
    </div>
  );
}

function AvailabilityBadge({
  prestable,
}: {
  prestable: boolean;
}) {
  if (prestable) {
    return (
      <span
        className="
          inline-flex h-8 items-center gap-2 whitespace-nowrap
          rounded-xl border border-[#CFE9D8]
          bg-[#EDF8F1] px-3
          text-[12px] font-semibold text-[#1B8E57]
        "
      >
        <span className="h-2 w-2 rounded-full bg-[#1FB56C]" />
        Prestable
      </span>
    );
  }

  return (
    <span
      className="
        inline-flex h-8 items-center gap-2 whitespace-nowrap
        rounded-xl border border-[#E4E8EF]
        bg-[#F4F6F9] px-3
        text-[12px] font-semibold text-[#5D6C81]
      "
    >
      <span className="h-2 w-2 rounded-full bg-[#99A5B5]" />
      No prestable
    </span>
  );
}

interface InventoryTableProps {
  items: InventoryArticle[];
  filtered: boolean;
  activeCategory?: string | null;
  onClear: () => void;
  onEdit: (item: InventoryArticle) => void;
  onDetails: (item: InventoryArticle) => void;
}

export function InventoryTable({
  items,
  filtered,
  activeCategory = null,
  onClear,
  onEdit,
  onDetails,
}: InventoryTableProps) {
  const columns = useMemo<Column<InventoryArticle>[]>(
    () => [
      {
        key: "nombre",
        header: "Artículo",
        render: (row) => (
          <div className="group flex min-w-0 items-center gap-3 py-0.5">
            <ArticleThumbnail name={row.nombre} />

            <div className="min-w-0">
              <p
                className="truncate text-[13px] font-semibold leading-5 text-[#1D3155]"
                title={row.nombre}
              >
                {row.nombre}
              </p>

              <p
                className="mt-0.5 truncate font-mono text-[10.5px] leading-4 text-[#8796AD]"
                title={row.codigo ?? ""}
              >
                {row.codigo ?? "—"}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "categoria",
        header: "Categoría",
        width: "145px",
        render: (row) => (
          <span
            className="
              inline-flex max-w-full items-center truncate
              rounded-lg bg-[#E9F2FF] px-2.5 py-1
              text-[11px] font-medium text-[#3A76C8]
            "
            title={row.categoria}
          >
            {row.categoria}
          </span>
        ),
      },
      {
        key: "disponible",
        header: "Disponible",
        width: "95px",
        align: "right",
        render: (row) => (
          <Quantity value={row.disponible} accent="success" />
        ),
      },
      {
        key: "prestado",
        header: "Prestado",
        width: "88px",
        align: "right",
        render: (row) => <Quantity value={row.prestado} />,
      },
      {
        key: "danado",
        header: "Dañado",
        width: "82px",
        align: "right",
        render: (row) => (
          <Quantity value={row.danado} accent="warning" />
        ),
      },
      {
        key: "faltante",
        header: "Faltante",
        width: "84px",
        align: "right",
        render: (row) => (
          <Quantity value={row.faltante} accent="error" />
        ),
      },
      {
        key: "total",
        header: "Total",
        width: "76px",
        align: "right",
        render: (row) => (
          <span className="text-[13px] font-bold tabular-nums text-[#14284E]">
            {row.disponible + row.prestado + row.danado + row.faltante}
          </span>
        ),
      },
      {
        key: "estado",
        header: "Estado",
        width: "156px",
        render: (row) => <AvailabilityBadge prestable={row.prestable} />,
      },
      {
        key: "acciones",
        header: "Acciones",
        width: "86px",
        align: "right",
        render: (row) => (
          <div className="flex justify-end">
            <RowActionsMenu
              item={row}
              onEdit={onEdit}
              onDetails={onDetails}
            />
          </div>
        ),
      },
    ],
    [onEdit, onDetails],
  );

  return (
    <div className="min-w-0">
      <DataTable
        columns={columns}
        data={items}
        keyField="id"
        flat
        empty={
          <EmptyState
            icon={<PackageSearch />}
            title={
              activeCategory
                ? `No hay artículos en «${activeCategory}»`
                : filtered
                  ? "Sin coincidencias"
                  : "No hay artículos"
            }
            description={
              activeCategory
                ? "Esta categoría todavía no tiene artículos asociados."
                : filtered
                  ? "Ningún artículo coincide con la búsqueda o los filtros aplicados."
                  : "Todavía no se ha registrado ningún artículo en el inventario."
            }
            action={
              activeCategory || filtered ? (
                <Button variant="secondary" onClick={onClear}>
                  {activeCategory ? "Limpiar filtro" : "Limpiar filtros"}
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}