import { useMemo } from "react";
import { FolderPlus, Tags } from "lucide-react";
import { DataTable, type Column } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { CategoryActionsMenu } from "./CategoryActionsMenu";
import type { InventoryCategory } from "../../data/inventoryData";

interface CategoriesTableProps {
  items: InventoryCategory[];
  filtered: boolean;
  onClear: () => void;
  onNew: () => void;
  onViewArticles: (categoria: InventoryCategory) => void;
  onEdit: (categoria: InventoryCategory) => void;
}

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
        width: "220px",
        render: (row) => (
          <span className="text-[13.5px] font-semibold text-text">
            {row.nombre}
          </span>
        ),
      },
      {
        key: "descripcion",
        header: "Descripción",
        render: (row) =>
          row.descripcion ? (
            <span className="text-[13px] text-text-secondary">
              {row.descripcion}
            </span>
          ) : (
            <span className="text-[13px] text-text-secondary/50">—</span>
          ),
      },
      {
        key: "articulos",
        header: "Artículos",
        width: "104px",
        align: "right",
        render: (row) => (
          <span
            className={`tabular-nums ${
              row.articulos === 0 ? "text-text-secondary/55" : "text-text"
            }`}
          >
            {row.articulos}
          </span>
        ),
      },
      {
        key: "acciones",
        header: "Acciones",
        width: "92px",
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
    [onViewArticles, onEdit],
  );

  return (
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
            action={<Button onClick={onNew}>Nueva categoría</Button>}
          />
        )
      }
    />
  );
}
