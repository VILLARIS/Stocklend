
import { useMemo } from "react";

import {
  FilterX,
  SearchX,
  Users,
} from "lucide-react";

import { DataTable, type Column } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { StudentActionsMenu } from "./StudentActionsMenu";
import { initials } from "../../utils/initials";

import type { StudentSummary } from "../../types/students";

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
  onToggleActive: (student: StudentSummary) => void;
  busy?: boolean;
}

// ========================================
// AVATAR DEL ESTUDIANTE
// ========================================

function StudentAvatar({
  nombres,
  apellidos,
}: {
  nombres: string;
  apellidos: string;
}) {
  return (
    <span
      aria-hidden="true"
      className="
        flex h-10 w-10 shrink-0
        items-center justify-center
        rounded-[13px]

        border border-[#DAE8FC]
        bg-gradient-to-br
        from-[#EEF5FF] to-[#DFECFF]

        text-[12px] font-bold
        tracking-wide text-[#347AD7]

        shadow-[0_2px_6px_rgba(42,103,189,0.06)]
      "
    >
      {initials(nombres, apellidos)}
    </span>
  );
}

// ========================================
// ESTADO DEL ESTUDIANTE
// ========================================

function StudentStatus({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`
        inline-flex h-8 items-center
        gap-2 whitespace-nowrap
        rounded-xl border px-3

        text-[12px] font-semibold

        ${
          active
            ? "border-[#CFE9D8] bg-[#EDF8F1] text-[#1B8E57]"
            : "border-[#E4E8EF] bg-[#F4F6F9] text-[#64748B]"
        }
      `}
    >
      <span
        className={`
          h-2 w-2 shrink-0 rounded-full

          ${
            active
              ? "bg-[#1FB56C]"
              : "bg-[#99A5B5]"
          }
        `}
      />

      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

// ========================================
// INDICADORES NUMÉRICOS
// ========================================

function LoansCount({ value }: { value: number }) {
  return (
    <span
      className={`
        inline-flex min-w-[36px]
        items-center justify-center
        rounded-lg px-2.5 py-1

        text-[12px] font-semibold
        tabular-nums

        ${
          value > 0
            ? "bg-[#EAF2FF] text-[#3478D5]"
            : "bg-[#F3F5F8] text-[#9AA7B8]"
        }
      `}
    >
      {value}
    </span>
  );
}

function IncidentsCount({
  value,
}: {
  value: number;
}) {
  return (
    <span
      className={`
        inline-flex min-w-[36px]
        items-center justify-center
        gap-1.5 rounded-lg
        px-2.5 py-1

        text-[12px] font-semibold
        tabular-nums

        ${
          value > 0
            ? "bg-[#FFF0F2] text-[#D65367]"
            : "bg-[#F3F5F8] text-[#9AA7B8]"
        }
      `}
    >
      {value > 0 && (
        <span className="h-1.5 w-1.5 rounded-full bg-[#E76B7C]" />
      )}

      {value}
    </span>
  );
}

// ========================================
// TABLA PRINCIPAL
// ========================================

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
  onToggleActive,
  busy,
}: StudentsTableProps) {
  const columns = useMemo<Column<StudentSummary>[]>(
    () => [
      {
        key: "codigoUniversitario",
        header: "Código universitario",
        width: "190px",
        render: (row) => (
          <span
            className="
              inline-flex items-center
              whitespace-nowrap
              rounded-lg
              border border-[#DFEAFE]
              bg-[#F0F6FF]
              px-2.5 py-1.5

              font-mono text-[11.5px]
              font-semibold text-[#3675C9]
            "
          >
            {row.codigoUniversitario}
          </span>
        ),
      },
      {
        key: "nombreCompleto",
        header: "Estudiante",
        render: (row) => (
          <div className="flex min-w-[200px] items-center gap-3 py-0.5">
            <StudentAvatar
              nombres={row.nombres}
              apellidos={row.apellidos}
            />

            <div className="min-w-0">
              <p
                className="
                  truncate text-[13px]
                  font-semibold leading-[19px]
                  text-[#203659]
                "
                title={row.nombreCompleto}
              >
                {row.nombreCompleto}
              </p>

              <p
                className="
                  mt-0.5 text-[11px]
                  leading-4 text-[#8999B0]
                "
              >
                {row.activo
                  ? "Estudiante registrado"
                  : "Registro inactivo"}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "prestamosActivos",
        header: "Préstamos activos",
        width: "165px",
        align: "right",
        render: (row) => (
          <LoansCount value={row.prestamosActivos} />
        ),
      },
      {
        key: "incidencias",
        header: "Incidencias",
        width: "135px",
        align: "right",
        render: (row) => (
          <IncidentsCount value={row.incidencias} />
        ),
      },
      {
        key: "estado",
        header: "Estado",
        width: "135px",
        render: (row) => (
          <StudentStatus active={row.activo} />
        ),
      },
      {
        key: "acciones",
        header: "Acciones",
        width: "95px",
        align: "right",
        render: (row) => (
          <div className="flex justify-end">
            <StudentActionsMenu
              student={row}
              busy={busy}
              onDetails={onDetails}
              onEdit={onEdit}
              onHistory={onHistory}
              onToggleActive={onToggleActive}
            />
          </div>
        ),
      },
    ],
    [onDetails, onEdit, onHistory, onToggleActive, busy]
  );

  return (
    <div className="min-w-0">
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
                <Button
                  variant="secondary"
                  onClick={onClearFilters}
                >
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
                <Button
                  variant="secondary"
                  onClick={onClearQuery}
                >
                  Quitar búsqueda
                </Button>
              }
            />
          )
        }
      />
    </div>
  );
}
