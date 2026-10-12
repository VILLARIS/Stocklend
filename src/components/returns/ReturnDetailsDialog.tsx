
import {
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Info,
  RotateCcw,
} from "lucide-react";

import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { ReturnItemsList } from "./ReturnItemsList";

import { formatLoanDate } from "../../data/demoLoans";

import type {
  ReturnRecord,
  ReturnStatus,
} from "../../data/demoReturns";

interface ReturnDetailsDialogProps {
  open: boolean;
  loan: ReturnRecord | null;
  onClose: () => void;
  onReturn: (loan: ReturnRecord) => void;
}

const statusClass: Record<ReturnStatus, string> = {
  Pendiente:
    "border-[#D8E8FF] bg-[#EDF5FF] text-[#357CDD]",
  Parcial:
    "border-[#E8DFFF] bg-[#F3EEFF] text-[#7B62CE]",
  Completada:
    "border-[#CFE9D8] bg-[#EDF8F1] text-[#1B8E57]",
  Vencida:
    "border-[#F9E2C2] bg-[#FFF4E7] text-[#B87916]",
};

function DetailMetric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#E5EDF6] bg-[#FAFCFF] px-3 py-3">
      <p className="text-[10.5px] font-medium text-[#8799B1]">
        {label}
      </p>

      <p
        className={`mt-1.5 truncate text-[13px] font-semibold tabular-nums ${
          highlight
            ? "text-[#317FE7]"
            : "text-[#2B4266]"
        }`}
        title={String(value)}
      >
        {value}
      </p>
    </div>
  );
}

export function ReturnDetailsDialog({
  open,
  loan,
  onClose,
  onReturn,
}: ReturnDetailsDialogProps) {
  if (!loan) return null;

  const progress =
    loan.total > 0
      ? Math.min(
          100,
          Math.round((loan.devueltas / loan.total) * 100)
        )
      : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detalles de devolución"
      subtitle={`Seguimiento del préstamo ${loan.folio}`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>

          {loan.pendientes > 0 && (
            <Button
              variant="sidebar"
              onClick={() => onReturn(loan)}
            >
              <RotateCcw className="h-4 w-4" />
              Preparar devolución
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* ESTUDIANTE */}
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#DCE9FA] bg-gradient-to-r from-[#F0F6FF] via-[#F6F9FF] to-white px-4 py-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-[#D8E7FB] bg-white text-[#347FDC]">
            <GraduationCap className="h-6 w-6" />
          </div>

          <div className="min-w-0 flex-1">
            <h3
              className="truncate text-[14px] font-bold text-[#243B60]"
              title={loan.estudiante}
            >
              {loan.estudiante}
            </h3>

            <p className="mt-1 font-mono text-[11px] text-[#8292A9]">
              {loan.codigoUniversitario}
            </p>

            <p className="mt-0.5 font-mono text-[10.5px] text-[#8A9BB0]">
              {loan.folio}
            </p>
          </div>

          <span
            className={`inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-[11px] font-semibold ${
              statusClass[loan.estadoDevolucion]
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {loan.estadoDevolucion}
          </span>
        </section>

        {/* DATOS */}
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <DetailMetric
            label="Fecha de entrega"
            value={formatLoanDate(loan.fechaEntrega)}
          />

          <DetailMetric
            label="Fecha límite"
            value={formatLoanDate(loan.fechaLimite)}
          />

          <DetailMetric
            label="Unidades devueltas"
            value={loan.devueltas}
            highlight
          />

          <DetailMetric
            label="Unidades pendientes"
            value={loan.pendientes}
          />
        </section>

        {/* AVANCE */}
        <section className="rounded-xl border border-[#E5EDF6] bg-[#FBFCFF] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[12px] font-semibold text-[#344C70]">
              Progreso de devolución
            </h3>

            <span className="text-[12px] font-bold tabular-nums text-[#317FE7]">
              {progress}%
            </span>
          </div>

          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#E8EFF8]">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${
                progress === 100
                  ? "bg-[#20B77A]"
                  : "bg-[#398BFF]"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        {/* ARTÍCULOS */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EAF3FF] text-[#347FDC]">
              <ClipboardList className="h-[17px] w-[17px]" />
            </div>

            <h3 className="text-[12.5px] font-semibold text-[#334C70]">
              Artículos del préstamo
            </h3>
          </div>

          <ReturnItemsList loan={loan} />
        </section>

        {/* FECHA Y NOTA */}
        {loan.observacion && (
          <div className="rounded-xl border border-[#E5EDF6] bg-[#FBFCFF] px-4 py-3">
            <p className="mb-1.5 flex items-center gap-2 text-[11.5px] font-semibold text-[#456084]">
              <CalendarDays className="h-4 w-4" />
              Observaciones del préstamo
            </p>

            <p className="text-[11.5px] leading-5 text-[#70829E]">
              {loan.observacion}
            </p>
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-xl border border-[#E1EBFA] bg-[#F3F8FF] px-3 py-2.5">
          <Info className="h-4 w-4 shrink-0 text-[#398BFF]" />

          <p className="text-[11px] leading-4 text-[#6D83A3]">
            Información de demostración. Este detalle no
            registra movimientos ni modifica existencias.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
