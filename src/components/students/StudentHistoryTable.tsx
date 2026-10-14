
import { useMemo } from "react";
import {
  CalendarDays,
  History,
  Package,
} from "lucide-react";

import { DataTable, type Column } from "../ui/DataTable";

import type {
  LoanEstado,
  StudentLoan,
} from "../../types/students";

import { formatLocalDate } from "../../utils/formatDate";

interface StudentHistoryTableProps {
  loans: StudentLoan[];
}

const statusStyles: Record<
  LoanEstado,
  {
    container: string;
    dot: string;
  }
> = {
  Activo: {
    container:
      "border-[#D7E7FF] bg-[#EDF5FF] text-[#2D75DA]",
    dot: "bg-[#398BFF]",
  },
  Cerrado: {
    container:
      "border-[#CFE9D8] bg-[#EDF8F1] text-[#1B8E57]",
    dot: "bg-[#1FB56C]",
  },
  Anulado: {
    container:
      "border-[#E4E8EF] bg-[#F4F6F9] text-[#64748B]",
    dot: "bg-[#99A5B5]",
  },
};

function LoanStatus({
  status,
}: {
  status: LoanEstado;
}) {
  const styles = statusStyles[status];

  return (
    <span
      className={`
        inline-flex h-8 items-center
        gap-2 whitespace-nowrap
        rounded-xl border px-3
        text-[11.5px] font-semibold
        ${styles.container}
      `}
    >
      <span
        className={`
          h-2 w-2 shrink-0 rounded-full
          ${styles.dot}
        `}
      />
      {status}
    </span>
  );
}

function DateValue({
  date,
  muted = false,
}: {
  date: string;
  muted?: boolean;
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-2
        whitespace-nowrap text-[12px]
        tabular-nums
        ${
          muted
            ? "text-[#8292A8]"
            : "font-medium text-[#405778]"
        }
      `}
    >
      <CalendarDays
        className="h-3.5 w-3.5 shrink-0 text-[#A1B0C4]"
        aria-hidden="true"
      />
      {formatLocalDate(date)}
    </span>
  );
}

export function StudentHistoryTable({
  loans,
}: StudentHistoryTableProps) {
  const columns = useMemo<Column<StudentLoan>[]>(
    () => [
      {
        key: "folio",
        header: "Préstamo",
        width: "160px",
        render: (row) => (
          <span
            className="
              inline-flex items-center
              whitespace-nowrap rounded-lg
              border border-[#DFEAFE]
              bg-[#F0F6FF] px-2.5 py-1.5
              font-mono text-[11.5px]
              font-semibold text-[#3675C9]
            "
          >
            {row.folio}
          </span>
        ),
      },
      {
        key: "fecha",
        header: "Fecha de entrega",
        width: "160px",
        render: (row) => (
          <DateValue date={row.fecha} />
        ),
      },
      {
        key: "fechaLimite",
        header: "Fecha límite",
        width: "155px",
        render: (row) =>
          row.fechaLimite ? (
            <DateValue date={row.fechaLimite} muted />
          ) : (
            <span className="text-[12px] text-[#A4B0C1]">
              —
            </span>
          ),
      },
      {
        key: "unidades",
        header: "Artículos",
        width: "100px",
        align: "right",
        render: (row) => (
          <span
            className="
              inline-flex min-w-9
              items-center justify-center gap-1.5
              rounded-lg bg-[#F0F4FA]
              px-2.5 py-1.5
              text-[11.5px] font-semibold
              tabular-nums text-[#496484]
            "
          >
            <Package className="h-3 w-3" aria-hidden="true" />
            {row.unidades}
          </span>
        ),
      },
      {
        key: "estado",
        header: "Estado",
        width: "125px",
        render: (row) => (
          <LoanStatus status={row.estado} />
        ),
      },
    ],
    []
  );

  if (loans.length === 0) {
    return (
      <div
        className="
          flex min-h-[145px] flex-col
          items-center justify-center gap-2.5
          px-4 py-6 text-center
        "
      >
        <div
          className="
            flex h-11 w-11 items-center
            justify-center rounded-2xl
            bg-[#EDF5FF] text-[#5792DD]
          "
        >
          <History
            className="h-5 w-5"
            strokeWidth={1.8}
          />
        </div>

        <p className="text-[12.5px] font-semibold text-[#344B6D]">
          Sin préstamos registrados
        </p>

        <p className="max-w-[300px] text-[11.5px] leading-5 text-[#8A99B0]">
          Este estudiante todavía no tiene préstamos
          en su historial.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <DataTable
        columns={columns}
        data={loans}
        keyField="id"
        flat
      />
    </div>
  );
}
