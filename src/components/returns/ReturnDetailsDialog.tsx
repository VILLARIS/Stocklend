import {
  CalendarDays,
  ClipboardList,
  GraduationCap,
  History,
  Info,
  RotateCcw,
} from "lucide-react";

import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { ReturnItemsList } from "./ReturnItemsList";
import { RETURN_STATUS_STYLES } from "./ReturnStatusBadge";
import {
  ResourceError,
  ResourceLoading,
} from "../students/StudentsResourceState";

import { formatLoanDate, formatLocalDate } from "../../utils/formatDate";

import { useReturnDetails, useReturnHistory } from "../../hooks/useReturns";
import {
  adaptReturnDetail,
  adaptReturnHistory,
} from "../../services/returnsAdapters";

import type { ReturnRecord } from "../../types/returns";

interface ReturnDetailsDialogProps {
  open: boolean;
  loan: ReturnRecord | null;
  onClose: () => void;
  onReturn: (loan: ReturnRecord) => void;
}

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
      <p className="text-[10.5px] font-medium text-[#8799B1]">{label}</p>

      <p
        className={`mt-1.5 truncate text-[13px] font-semibold tabular-nums ${
          highlight ? "text-[#317FE7]" : "text-[#2B4266]"
        }`}
        title={String(value)}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Detalle de una devolución.
 *
 * El detalle y el historial reales se consultan solo cuando hay un préstamo
 * seleccionado: el componente interno se monta con el préstamo ya disponible,
 * así que el modal cerrado nunca consulta nada.
 */
export function ReturnDetailsDialog({
  open,
  loan,
  onClose,
  onReturn,
}: ReturnDetailsDialogProps) {
  if (!loan) return null;

  return (
    <ReturnDetailsContent
      key={loan.id}
      open={open}
      loan={loan}
      onClose={onClose}
      onReturn={onReturn}
    />
  );
}

function ReturnDetailsContent({
  open,
  loan,
  onClose,
  onReturn,
}: ReturnDetailsDialogProps & { loan: ReturnRecord }) {
  const details = useReturnDetails(Number(loan.id));
  const history = useReturnHistory(Number(loan.id));

  // Solo se acepta el detalle cuyo id coincide con el préstamo seleccionado.
  const realDetail =
    details.data && String(details.data.id) === String(loan.id)
      ? adaptReturnDetail(details.data)
      : null;

  // La cabecera usa el detalle real cuando está disponible; mientras carga,
  // se apoya en la fila seleccionada (mismo préstamo).
  const header = realDetail ?? loan;

  const realHistory = history.data ? adaptReturnHistory(history.data) : [];

  const progress =
    header.total > 0
      ? Math.min(100, Math.round((header.devueltas / header.total) * 100))
      : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detalles de devolución"
      subtitle={`Seguimiento del préstamo ${header.folio}`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>

          {header.pendientes > 0 && (
            <Button variant="sidebar" onClick={() => onReturn(header)}>
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
              title={header.estudiante}
            >
              {header.estudiante}
            </h3>

            <p className="mt-1 font-mono text-[11px] text-[#8292A9]">
              {header.codigoUniversitario}
            </p>

            <p className="mt-0.5 font-mono text-[10.5px] text-[#8A9BB0]">
              {header.folio}
            </p>
          </div>

          <span
            className={`inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-[11px] font-semibold ${
              RETURN_STATUS_STYLES[header.estadoDevolucion].container
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {header.estadoDevolucion}
          </span>
        </section>

        {/* DATOS */}
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <DetailMetric
            label="Fecha de entrega"
            value={formatLoanDate(header.fechaEntrega)}
          />

          <DetailMetric
            label="Fecha límite"
            value={formatLoanDate(header.fechaLimite)}
          />

          <DetailMetric
            label="Unidades devueltas"
            value={header.devueltas}
            highlight
          />

          <DetailMetric
            label="Unidades pendientes"
            value={header.pendientes}
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

          <div className="mt-2 flex items-center gap-3">
            <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-[#E9EFF7]">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${
                  progress === 100 ? "bg-[#20B77A]" : "bg-[#398BFF]"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-[#4D607B]">
              {header.devueltas} de {header.total} devueltas
            </span>
          </div>
        </section>

        {/* ARTÍCULOS (requiere el detalle real) */}
          {details.status === "error" ? (
            <ResourceError
              message={
                details.error ?? "No se pudo cargar el detalle del préstamo."
              }
              onRetry={details.refetch}
            />
          ) : realDetail === null || details.status === "loading" ? (
            <ResourceLoading />
          ) : (
            <section>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EAF3FF] text-[#287FF0]">
                <ClipboardList className="h-[17px] w-[17px]" />
              </div>

              <h3 className="text-[12.5px] font-semibold text-[#253D61]">
                Artículos del préstamo
              </h3>
            </div>

            <ReturnItemsList loan={realDetail} />
          </section>
        )}

        {/* HISTORIAL DE DEVOLUCIONES */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EAF3FF] text-[#287FF0]">
              <History className="h-[17px] w-[17px]" />
            </div>

            <h3 className="text-[12.5px] font-semibold text-[#253D61]">
              Devoluciones registradas
            </h3>
          </div>

          {history.status === "error" ? (
            <ResourceError
              message={
                history.error ??
                "No se pudo cargar el historial de devoluciones."
              }
              onRetry={history.refetch}
            />
          ) : history.status === "loading" ? (
            <ResourceLoading />
          ) : realHistory.length === 0 ? (
            <p className="rounded-xl border border-[#E5EDF6] bg-[#FBFCFF] px-3 py-3 text-[11.5px] text-[#8293AA]">
              Sin devoluciones registradas todavía.
            </p>
          ) : (
            <div className="space-y-2">
              {realHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-[#E5EDF6] bg-[#FBFCFF] px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#2B4266]">
                      <CalendarDays className="h-3.5 w-3.5 text-[#347CE6]" />
                      {formatLocalDate(entry.fechaDevolucion)}
                    </span>

                    <span className="text-[10.5px] font-medium tabular-nums text-[#8293AA]">
                      {entry.devueltas} devueltas ·{" "}
                      {entry.danadas} dañadas · {entry.perdidas} perdidas
                    </span>
                  </div>

                  {entry.items.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {entry.items.map((item, index) => (
                        <li
                          key={`${entry.id}-${item.prestamoDetalleId}-${index}`}
                          className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5C7291]"
                        >
                          <span className="min-w-0 truncate">
                            {item.articulo}
                          </span>

                          <span className="shrink-0 tabular-nums">
                            {item.devueltas} dev.
                            {item.danadas > 0 ? ` · ${item.danadas} dañ.` : ""}
                            {item.perdidas > 0 ? ` · ${item.perdidas} pérd.` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {entry.observaciones && (
                    <p className="mt-1.5 text-[10.5px] text-[#8293AA]">
                      {entry.observaciones}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* NOTA */}
        <div className="flex items-start gap-2.5 rounded-xl border border-[#E1EBFA] bg-[#F3F8FF] px-3 py-2.5">
          <Info className="h-4 w-4 shrink-0 text-[#398BFF]" />

          <p className="text-[11px] leading-4 text-[#6D83A3]">
            Datos de la base local. Este detalle no registra movimientos ni
            modifica existencias.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
