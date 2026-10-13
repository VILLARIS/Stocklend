
import { useMemo } from "react";
import { Boxes } from "lucide-react";

import { DataTable, type Column } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { getArticleIcon } from "./articleIcon";
import { UnitActionsMenu } from "./UnitActionsMenu";

import type { InventoryUnit } from "../../data/inventoryData";

function Dash() {
  return (
    <span className="text-[13px] text-[#ADB8C8]">
      —
    </span>
  );
}

function UnitThumbnail({ name }: { name: string }) {
  const Icon = getArticleIcon(name);

  return (
    <div
      className="
        flex h-10 w-10 shrink-0
        items-center justify-center
        rounded-xl
        border border-[#E7EDF7]
        bg-gradient-to-br
        from-[#F6F9FE] to-[#EBF2FC]
        text-[#6485B8]
        transition-colors duration-200
        group-hover:border-[#D5E5FC]
        group-hover:bg-[#EAF3FF]
        group-hover:text-[#237EFF]
      "
      aria-hidden="true"
    >
      <Icon className="h-[19px] w-[19px]" strokeWidth={1.7} />
    </div>
  );
}

function UnitStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  const style =
    normalized === "disponible"
      ? {
          container: "border-[#D2ECDD] bg-[#EDF8F1]",
          text: "text-[#188950]",
          dot: "bg-[#20B76D]",
        }
      : normalized === "prestado"
        ? {
            container: "border-[#D7E7FF] bg-[#EDF5FF]",
            text: "text-[#2D75DA]",
            dot: "bg-[#398BFF]",
          }
        : normalized === "dañado" || normalized === "danado"
          ? {
              container: "border-[#F9E3BA] bg-[#FFF7E9]",
              text: "text-[#B87916]",
              dot: "bg-[#F5AD35]",
            }
          : normalized === "faltante"
            ? {
                container: "border-[#FFDDE1] bg-[#FFF0F2]",
                text: "text-[#D94F61]",
                dot: "bg-[#F36D7B]",
              }
            : {
                container: "border-[#E4E9F1] bg-[#F4F6F9]",
                text: "text-[#64748B]",
                dot: "bg-[#9CA9BB]",
              };

  return (
    <span
      className={`
        inline-flex min-h-8 max-w-full
        items-center gap-2
        whitespace-nowrap rounded-xl
        border px-3
        text-[12px] font-semibold
        ${style.container} ${style.text}
      `}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`}
      />
      {status}
    </span>
  );
}

interface UnitsTableProps {
  items: InventoryUnit[];
  filtered: boolean;
  onClear: () => void;
  onDetails: (unit: InventoryUnit) => void;
}

export function UnitsTable({
  items,
  filtered,
  onClear,
  onDetails,
}: UnitsTableProps) {
  const columns = useMemo<Column<InventoryUnit>[]>(
    () => [
      {
        key: "codigo",
        header: "Código de unidad",
        width: "156px",
        render: (row) => (
          <span
            className="
              inline-flex max-w-full items-center
              rounded-lg border border-[#DFEAFE]
              bg-[#F0F6FF] px-2.5 py-1.5
              font-mono text-[11.5px] font-semibold
              text-[#3675C9]
            "
            title={row.codigo}
          >
            {row.codigo}
          </span>
        ),
      },
      {
        key: "articulo",
        header: "Artículo",
        render: (row) => (
          <div className="group flex min-w-0 items-center gap-3 py-0.5">
            <UnitThumbnail name={row.articulo} />

            <span
              className="
                min-w-0 truncate text-[13px]
                font-semibold text-[#203659]
              "
              title={row.articulo}
            >
              {row.articulo}
            </span>
          </div>
        ),
      },
      {
        key: "categoria",
        header: "Categoría",
        width: "148px",
        render: (row) => (
          <span
            className="
              inline-flex max-w-full items-center
              truncate rounded-lg bg-[#E9F2FF]
              px-2.5 py-1
              text-[11px] font-medium text-[#3A76C8]
            "
            title={row.categoria}
          >
            {row.categoria}
          </span>
        ),
      },
      {
        key: "estado",
        header: "Estado",
        width: "145px",
        render: (row) => (
          <UnitStatusBadge status={row.estado} />
        ),
      },
      {
        key: "estudiante",
        header: "Estudiante",
        width: "180px",
        render: (row) =>
          row.estudiante ? (
            <span
              className="
                block max-w-[185px] truncate
                text-[12px] font-medium text-[#344968]
              "
              title={row.estudiante}
            >
              {row.estudiante}
            </span>
          ) : (
            <Dash />
          ),
      },
      {
        key: "prestamo",
        header: "Préstamo",
        width: "145px",
        render: (row) =>
          row.prestamo ? (
            <span
              className="
                font-mono text-[11px]
                font-medium text-[#4475B9]
              "
              title={row.prestamo}
            >
              {row.prestamo}
            </span>
          ) : (
            <Dash />
          ),
      },
      {
        key: "incidente",
        header: "Incidente",
        width: "135px",
        render: (row) =>
          row.incidente ? (
            <span
              className="
                font-mono text-[11px]
                font-medium text-[#D45F65]
              "
              title={row.incidente}
            >
              {row.incidente}
            </span>
          ) : (
            <Dash />
          ),
      },
      {
        key: "acciones",
        header: "Acciones",
        width: "90px",
        align: "right",
        render: (row) => (
          <div className="flex justify-end">
            <UnitActionsMenu
              item={row}
              onDetails={onDetails}
            />
          </div>
        ),
      },
    ],
    [onDetails]
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
            icon={<Boxes />}
            title="Sin unidades"
            description={
              filtered
                ? "Ninguna unidad coincide con la búsqueda o los filtros aplicados."
                : "Ningún artículo tiene control individual, así que todavía no hay unidades que consultar."
            }
            action={
              filtered ? (
                <Button variant="secondary" onClick={onClear}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
