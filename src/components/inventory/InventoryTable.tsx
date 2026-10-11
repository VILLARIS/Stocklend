import { useMemo } from "react";
import { PackageSearch } from "lucide-react";
import { DataTable, type Column } from "../ui/DataTable";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { RowActionsMenu } from "./RowActionsMenu";
import type { InventoryArticle } from "../../data/inventoryData";

type Accent = "success" | "warning" | "error";

function Quantity({ value, accent }: { value: number; accent?: Accent }) {
  const color =
    value === 0
      ? "text-text-secondary/55"
      : accent === "success"
        ? "text-success"
        : accent === "warning"
          ? "text-warning"
          : accent === "error"
            ? "text-error"
            : "text-text";
  return <span className={`tabular-nums ${color}`}>{value}</span>;
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
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold leading-[18px] text-text">
              {row.nombre}
            </p>
            <p className="font-mono text-[11.5px] leading-4 text-text-secondary">
              {row.codigo ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "categoria",
        header: "Categoría",
        width: "140px",
        render: (row) => <Badge variant="neutral">{row.categoria}</Badge>,
      },
      {
        key: "disponible",
        header: "Disponible",
        width: "94px",
        align: "right",
        render: (row) => <Quantity value={row.disponible} accent="success" />,
      },
      {
        key: "prestado",
        header: "Prestado",
        width: "86px",
        align: "right",
        render: (row) => <Quantity value={row.prestado} />,
      },
      {
        key: "danado",
        header: "Dañado",
        width: "82px",
        align: "right",
        render: (row) => <Quantity value={row.danado} accent="warning" />,
      },
      {
        key: "faltante",
        header: "Faltante",
        width: "84px",
        align: "right",
        render: (row) => <Quantity value={row.faltante} accent="error" />,
      },
      {
        key: "total",
        header: "Total",
        width: "76px",
        align: "right",
        render: (row) => (
          <span className="font-semibold tabular-nums text-text">
            {row.disponible + row.prestado + row.danado + row.faltante}
          </span>
        ),
      },
      {
        key: "estado",
        header: "Estado",
        width: "128px",
        render: (row) => (
          <Badge variant={row.prestable ? "success" : "neutral"} dot>
            {row.prestable ? "Prestable" : "No prestable"}
          </Badge>
        ),
      },
      {
        key: "acciones",
        header: "Acciones",
        width: "92px",
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
  );
}
