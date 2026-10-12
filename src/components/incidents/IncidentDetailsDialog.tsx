
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Package,
  type LucideIcon,
} from "lucide-react";

import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";

import {
  IncidentStatusBadge,
  IncidentTypeBadge,
} from "./IncidentBadges";

import {
  formatIncidentDate,
  type DemoIncident,
} from "../../data/demoIncidents";

interface IncidentDetailsDialogProps {
  open: boolean;
  incident: DemoIncident | null;
  onClose: () => void;
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#E5EDF6] bg-[#FBFCFF] p-3">
      <p className="flex items-center gap-2 text-[11px] text-[#8899AE]">
        <Icon className="h-4 w-4" />
        {label}
      </p>

      <p className="mt-1.5 break-words text-[12px] font-semibold text-[#304766]">
        {value}
      </p>
    </div>
  );
}

export function IncidentDetailsDialog({
  open,
  incident,
  onClose,
}: IncidentDetailsDialogProps) {
  if (!incident) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detalles de incidencia"
      subtitle={`Seguimiento de ${incident.codigo}`}
      size="lg"
      footer={
        <Button
          variant="secondary"
          onClick={onClose}
        >
          Cerrar
        </Button>
      }
    >
      <div className="space-y-4">
        {/* IDENTIFICACIÓN */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E3ECF8] bg-[#F8FBFF] p-4">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] font-semibold text-[#3478D5]">
              {incident.codigo}
            </p>

            <h3 className="mt-1 text-[16px] font-bold text-[#263D60]">
              {incident.articulo}
            </h3>

            <div className="mt-2 flex flex-wrap gap-2">
              <IncidentTypeBadge
                type={incident.tipo}
              />

              <IncidentStatusBadge
                status={incident.estado}
              />
            </div>
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF0F2] text-[#D65367]">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </section>

        {/* INFORMACIÓN */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailItem
            icon={GraduationCap}
            label="Responsable"
            value={incident.estudiante}
          />

          <DetailItem
            icon={ClipboardList}
            label="Préstamo asociado"
            value={incident.prestamo}
          />

          <DetailItem
            icon={CalendarDays}
            label="Fecha"
            value={formatIncidentDate(incident.fecha)}
          />

          <DetailItem
            icon={Package}
            label="Código universitario"
            value={incident.codigoUniversitario}
          />
        </section>

        {/* DESCRIPCIÓN */}
        <section>
          <h4 className="text-[12px] font-semibold text-[#2A4161]">
            Descripción
          </h4>

          <p className="mt-2 rounded-xl border border-[#E5EDF6] bg-[#FAFCFF] p-3 text-[12px] leading-5 text-[#647895]">
            {incident.descripcion}
          </p>
        </section>

        {/* RESOLUCIÓN */}
        {incident.resolucion && (
          <section>
            <h4 className="text-[12px] font-semibold text-[#2A4161]">
              Resolución
            </h4>

            <p className="mt-2 rounded-xl border border-[#CFE9D8] bg-[#F1FAF5] p-3 text-[12px] leading-5 text-[#387554]">
              {incident.resolucion}
            </p>
          </section>
        )}
      </div>
    </Dialog>
  );
}
