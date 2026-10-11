import type { ReactNode } from "react";
import { CalendarClock, ShieldCheck } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import type { InventoryUnit } from "../../data/inventoryData";
import { unitStateVariant } from "./unitState";

interface UnitDetailsDialogProps {
  open: boolean;
  unit: InventoryUnit | null;
  onClose: () => void;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-[12.5px] text-text-secondary">{label}</dt>
      <dd className="text-right text-[13px] text-text">{children}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] font-medium text-text">{children}</p>;
}

function EmptyBlock({
  icon,
  text,
}: {
  icon: ReactNode;
  text: string;
}) {
  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-md border border-dashed border-border-soft bg-[#F7F9FC] px-3 py-2.5 text-[12.5px] text-text-secondary">
      <span className="shrink-0 text-text-secondary/60 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      {text}
    </div>
  );
}

function loanEmptyMessage(unit: InventoryUnit): string {
  if (unit.estado === "Disponible") {
    return "Esta unidad está en el almacén. No tiene préstamo asociado.";
  }
  if (unit.estado === "Baja") {
    return "Unidad dada de baja. No tiene préstamo asociado.";
  }
  return "Esta unidad no está prestada. No tiene préstamo asociado.";
}

export function UnitDetailsDialog({
  open,
  unit,
  onClose,
}: UnitDetailsDialogProps) {
  if (!unit) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detalle de unidad"
      subtitle={`${unit.codigo} · ${unit.articulo}`}
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <section>
        <SectionTitle>Identificación</SectionTitle>
        <dl className="mt-1 divide-y divide-border-soft">
          <DetailRow label="Código de unidad">
            <span className="font-mono text-[12.5px]">{unit.codigo}</span>
          </DetailRow>
          <DetailRow label="Artículo">{unit.articulo}</DetailRow>
          <DetailRow label="Categoría">
            <Badge variant="neutral">{unit.categoria}</Badge>
          </DetailRow>
          <DetailRow label="Estado">
            <Badge variant={unitStateVariant[unit.estado]} dot>
              {unit.estado}
            </Badge>
          </DetailRow>
        </dl>
      </section>

      <section className="mt-4">
        <SectionTitle>Préstamo actual</SectionTitle>
        {unit.estado === "Prestada" && unit.prestamo ? (
          <dl className="mt-1 divide-y divide-border-soft">
            <DetailRow label="Estudiante">{unit.estudiante ?? "—"}</DetailRow>
            <DetailRow label="Folio del préstamo">
              <span className="font-mono text-[12.5px]">{unit.prestamo}</span>
            </DetailRow>
            <DetailRow label="Fecha de préstamo">
              {unit.prestamoFecha ?? "—"}
            </DetailRow>
            <DetailRow label="Estado del préstamo">
              <Badge variant="info" dot>
                {unit.prestamoEstado ?? "Activo"}
              </Badge>
            </DetailRow>
          </dl>
        ) : (
          <EmptyBlock icon={<CalendarClock />} text={loanEmptyMessage(unit)} />
        )}
      </section>

      <section className="mt-4">
        <SectionTitle>Incidencias</SectionTitle>
        {unit.incidente ? (
          <dl className="mt-1 divide-y divide-border-soft">
            <DetailRow label="Referencia">
              <span className="font-mono text-[12.5px]">{unit.incidente}</span>
            </DetailRow>
            <DetailRow label="Tipo">{unit.incidenteTipo ?? "—"}</DetailRow>
            <DetailRow label="Estado">
              <Badge
                variant={unit.incidenteEstado === "Resuelto" ? "success" : "warning"}
                dot
              >
                {unit.incidenteEstado ?? "Abierto"}
              </Badge>
            </DetailRow>
          </dl>
        ) : (
          <EmptyBlock
            icon={<ShieldCheck />}
            text="Sin incidencias registradas."
          />
        )}
      </section>
    </Dialog>
  );
}
