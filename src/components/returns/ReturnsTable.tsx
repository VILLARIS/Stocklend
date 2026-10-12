
import { useMemo } from "react";

import {
  RotateCcw,
  SearchX,
} from "lucide-react";

import {
  DataTable,
  type Column,
} from "../ui/DataTable";

import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { ReturnActionsMenu } from "./ReturnActionsMenu";

import { formatLoanDate } from "../../data/demoLoans";

import type {
  ReturnRecord,
  ReturnStatus,
} from "../../data/demoReturns";

interface ReturnsTableProps {
  items: ReturnRecord[];
  totalCount: number;
  filtered: boolean;
  onClear: () => void;
  onDetails: (loan: ReturnRecord) => void;
  onReturn: (loan: ReturnRecord) => void;
}

const statusStyles: Record<
  ReturnStatus,
  { container: string; dot: string }
> = {
  Pendiente: {
    container:
      "border-[#D8E8FF] bg-[#EDF5FF] text-[#357CDD]",
    dot: "bg-[#398BFF]",
  },
  Parcial: {
    container:
      "border-[#E8DFFF] bg-[#F3EEFF] text-[#7B62CE]",
    dot: "bg-[#8D74E5]",
  },
  Completada: {
    container:
      "border-[#CFE9D8] bg-[#EDF8F1] text-[#1B8E57]",
    dot: "bg-[#1FB56C]",
  },
  Vencida: {
    container:
      "border-[#F9E2C2] bg-[#FFF4E7] text-[#B87916]",
    dot: "bg-[#F5AD35]",
  },
};

function ReturnStatusBadge({
  status,
}: {
  status: ReturnStatus;
}) {
  const styles = statusStyles[status];

  return (
    <span
      className={`
        inline-flex h-8 items-center gap-2
        whitespace-nowrap rounded-xl border px-3
        text-[11.5px] font-semibold
        ${styles.container}
      `}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`}
      />
      {status}
    </span>
  );
}

function ReturnProgress({
  returned,
  total,
}: {
  returned: number;
  total: number;
}) {
  const percent =
    total > 0
      ? Math.min(100, Math.round((returned / total) * 100))
      : 0;

  return (
    <div className="min-w-[120px]">
      <div className="mb-1.5 flex items-center gap-1 text-[12px] font-semibold tabular-nums text-[#345174]">
        <span>{returned}</span>
        <span className="text-[#A6B3C3]">/</span>
        <span>{total}</span>
      </div>

      <div className="h-[6px] w-[125px] max-w-full overflow-hidden rounded-full bg-[#E9EFF7]">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            percent === 100 ? "bg-[#20B77A]" : "bg-[#398BFF]"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function ReturnsTable({
  items,
  totalCount,
  filtered,
  onClear,
  onDetails,
  onReturn,
}: ReturnsTableProps) {
  const columns = useMemo<Column<ReturnRecord>[]>(
    () => [
      {
        key: "folio",
        header: "Préstamo",
        width: "162px",
        render: (row) => (
          <span className="inline-flex items-center whitespace-nowrap rounded-lg border border-[#DFEAFE] bg-[#F0F6FF] px-2.5 py-1.5 font-mono text-[11.5px] font-semibold text-[#3675C9]">
            {row.folio}
          </span>
        ),
      },
      {
        key: "estudiante",
        header: "Estudiante",
        render: (row) => (
          <div className="min-w-[175px]">
            <p
              className="truncate text-[13px] font-semibold text-[#203659]"
              title={row.estudiante}
            >
              {row.estudiante}
            </p>

            <p className="mt-0.5 font-mono text-[10.5px] text-[#8A9BB0]">
              {row.codigoUniversitario}
            </p>
          </div>
        ),
      },
      {
        key: "fechaEntrega",
        header: "Entrega",
        width: "115px",
        render: (row) => (
          <span className="whitespace-nowrap text-[12px] tabular-nums text-[#5C7291]">
            {formatLoanDate(row.fechaEntrega)}
          </span>
        ),
      },
      {
        key: "fechaLimite",
        header: "Fecha límite",
        width: "125px",
        render: (row) => (
          <span
            className={`whitespace-nowrap text-[12px] tabular-nums ${
              row.estadoDevolucion === "Vencida"
                ? "font-semibold text-[#C48222]"
                : "text-[#5C7291]"
            }`}
          >
            {formatLoanDate(row.fechaLimite)}
          </span>
        ),
      },
      {
        key: "avance",
        header: "Devueltas / total",
        width: "164px",
        render: (row) => (
          <ReturnProgress
            returned={row.devueltas}
            total={row.total}
          />
        ),
      },
      {
        key: "estadoDevolucion",
        header: "Estado",
        width: "135px",
        render: (row) => (
          <ReturnStatusBadge status={row.estadoDevolucion} />
        ),
      },
      {
        key: "acciones",
        header: "Acciones",
        width: "85px",
        align: "right",
        render: (row) => (
          <div className="flex justify-end">
            <ReturnActionsMenu
              item={row}
              onDetails={onDetails}
              onReturn={onReturn}
            />
          </div>
        ),
      },
    ],
    [onDetails, onReturn]
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      keyField="id"
      flat
      onRowClick={onDetails}
      empty={
        <EmptyState
          icon={
            totalCount === 0 ? (
              <RotateCcw />
            ) : (
              <SearchX />
            )
          }
          title={
            totalCount === 0
              ? "Sin devoluciones"
              : "Sin resultados"
          }
          description={
            totalCount === 0
              ? "Todavía no hay préstamos en los datos de demostración."
              : "No se encontraron devoluciones con esos criterios."
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
