import { useMemo } from "react";
import { Boxes } from "lucide-react";
import { DataTable, type Column } from "../ui/DataTable";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { UnitActionsMenu } from "./UnitActionsMenu";
import type { InventoryUnit } from "../../data/inventoryData";
import { unitStateVariant } from "./unitState";

function Dash() {
  return <span className="text-text-secondary/60">—</span>;
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
        width: "144px",
        mono: true,
      },
      {
        key: "articulo",
        header: "Artículo",
        render: (row) => (
          <span className="text-[13.5px] font-semibold text-text">
            {row.articulo}
          </span>
        ),
      },
      {
        key: "categoria",
        header: "Categoría",
        width: "150px",
        render: (row) => <Badge variant="neutral">{row.categoria}</Badge>,
      },
      {
        key: "estado",
        header: "Estado",
        width: "128px",
        render: (row) => (
          <Badge variant={unitStateVariant[row.estado]} dot>
            {row.estado}
          </Badge>
        ),
      },
      {
        key: "estudiante",
        header: "Estudiante",
        width: "180px",
        render: (row) => row.estudiante ?? <Dash />,
      },
      {
        key: "prestamo",
        header: "Préstamo",
        width: "124px",
        render: (row) =>
          row.prestamo ? (
            <span className="font-mono text-[12px]">{row.prestamo}</span>
          ) : (
            <Dash />
          ),
      },
      {
        key: "incidente",
        header: "Incidente",
        width: "118px",
        render: (row) =>
          row.incidente ? (
            <span className="font-mono text-[12px]">{row.incidente}</span>
          ) : (
            <Dash />
          ),
      },
      {
        key: "acciones",
        header: "Acciones",
        width: "92px",
        align: "right",
        render: (row) => (
          <div className="flex justify-end">
            <UnitActionsMenu item={row} onDetails={onDetails} />
          </div>
        ),
      },
    ],
    [onDetails],
  );

  return (
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
  );
}
