import { useMemo } from "react";
import { FilterX, SearchX, Users } from "lucide-react";
import { DataTable, type Column } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { StudentActionsMenu } from "./StudentActionsMenu";
import type { StudentSummary } from "../../data/demoStudents";

interface StudentsTableProps {
  items: StudentSummary[];
  totalCount: number;
  query: string;
  filterActive: boolean;
  onClearFilters: () => void;
  onClearQuery: () => void;
  onDetails: (student: StudentSummary) => void;
  onEdit: (student: StudentSummary) => void;
  onHistory: (student: StudentSummary) => void;
}

function initials(nombres: string, apellidos: string): string {
  const first = nombres.trim().charAt(0);
  const second = apellidos.trim().charAt(0);
  return `${first}${second}`.toUpperCase();
}

export function StudentsTable({
  items,
  totalCount,
  query,
  filterActive,
  onClearFilters,
  onClearQuery,
  onDetails,
  onEdit,
  onHistory,
}: StudentsTableProps) {
  const columns = useMemo<Column<StudentSummary>[]>(
    () => [
      {
        key: "codigoUniversitario",
        header: "Código",
        width: "156px",
        mono: true,
        render: (row) => (
          <span className="text-[13px] text-text">
            {row.codigoUniversitario}
          </span>
        ),
      },
      {
        key: "nombreCompleto",
        header: "Estudiante",
        render: (row) => (
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[12px] font-semibold text-brand"
            >
              {initials(row.nombres, row.apellidos)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold leading-[18px] text-text">
                {row.nombreCompleto}
              </p>
              <p className="text-[11.5px] leading-4 text-text-secondary">
                {row.activo ? "Activo" : "Inactivo"}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "prestamosActivos",
        header: "Préstamos activos",
        width: "128px",
        align: "right",
        render: (row) => (
          <span
            className={`tabular-nums ${
              row.prestamosActivos === 0
                ? "text-text-secondary/45"
                : "font-semibold text-text"
            }`}
          >
            {row.prestamosActivos}
          </span>
        ),
      },
      {
        key: "incidencias",
        header: "Incidencias",
        width: "112px",
        align: "right",
        render: (row) =>
          row.incidencias === 0 ? (
            <span className="tabular-nums text-text-secondary/45">0</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-error">
              <span className="h-1.5 w-1.5 rounded-full bg-error" />
              {row.incidencias}
            </span>
          ),
      },
      {
        key: "estado",
        header: "Estado",
        width: "112px",
        render: (row) => (
          <Badge variant={row.activo ? "success" : "neutral"} dot>
            {row.activo ? "Activo" : "Inactivo"}
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
            <StudentActionsMenu
              student={row}
              onDetails={onDetails}
              onEdit={onEdit}
              onHistory={onHistory}
            />
          </div>
        ),
      },
    ],
    [onDetails, onEdit, onHistory],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      keyField="id"
      flat
      onRowClick={onDetails}
      empty={
        totalCount === 0 ? (
          <EmptyState
            icon={<Users />}
            title="Sin estudiantes"
            description="Todavía no hay estudiantes registrados en el directorio."
          />
        ) : filterActive ? (
          <EmptyState
            icon={<FilterX />}
            title="Sin coincidencias"
            description="Ningún estudiante cumple los filtros seleccionados."
            action={
              <Button variant="secondary" onClick={onClearFilters}>
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<SearchX />}
            title={`Ningún estudiante coincide con «${query.trim()}»`}
            description="Revisa la escritura o busca por el código universitario."
            action={
              <Button variant="secondary" onClick={onClearQuery}>
                Quitar búsqueda
              </Button>
            }
          />
        )
      }
    />
  );
}
