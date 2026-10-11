import { useMemo } from "react";
import { History } from "lucide-react";
import { DataTable, type Column } from "../ui/DataTable";
import { Badge } from "../ui/Badge";
import type { LoanEstado, StudentLoan } from "../../data/demoStudents";
import { formatFecha } from "../../data/demoStudents";

interface StudentHistoryTableProps {
  loans: StudentLoan[];
}

const estadoVariant: Record<
  LoanEstado,
  "info" | "success" | "neutral"
> = {
  Activo: "info",
  Cerrado: "success",
  Anulado: "neutral",
};

export function StudentHistoryTable({ loans }: StudentHistoryTableProps) {
  const columns = useMemo<Column<StudentLoan>[]>(
    () => [
      {
        key: "folio",
        header: "Préstamo",
        width: "160px",
        mono: true,
        render: (row) => (
          <span className="text-[12.5px] text-text">{row.folio}</span>
        ),
      },
      {
        key: "fecha",
        header: "Fecha de entrega",
        width: "128px",
        render: (row) => (
          <span className="tabular-nums text-text">{formatFecha(row.fecha)}</span>
        ),
      },
      {
        key: "fechaLimite",
        header: "Fecha límite",
        width: "120px",
        render: (row) =>
          row.fechaLimite ? (
            <span className="tabular-nums text-text">
              {formatFecha(row.fechaLimite)}
            </span>
          ) : (
            <span className="text-text-secondary/70">—</span>
          ),
      },
      {
        key: "unidades",
        header: "Artículos",
        width: "92px",
        align: "right",
        render: (row) => <span className="font-semibold">{row.unidades}</span>,
      },
      {
        key: "estado",
        header: "Estado",
        width: "104px",
        render: (row) => (
          <Badge variant={estadoVariant[row.estado]} dot>
            {row.estado}
          </Badge>
        ),
      },
    ],
    [],
  );

  if (loans.length === 0) {
    return (
      <div className="mt-3 flex items-center gap-2.5 rounded-md border border-dashed border-border-soft bg-[#F7F9FC] px-3 py-4 text-[12.5px] text-text-secondary">
        <History className="h-4 w-4 shrink-0 text-text-secondary/60" />
        Este estudiante no tiene préstamos registrados.
      </div>
    );
  }

  return (
    <div className="mt-3">
      <DataTable columns={columns} data={loans} keyField="id" />
    </div>
  );
}
