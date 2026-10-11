import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Dialog } from "../ui/Dialog";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { StudentHistoryTable } from "./StudentHistoryTable";
import { StudentIncidentsList } from "./StudentIncidentsList";
import {
  formatFecha,
  getStudentIncidents,
  getStudentLoans,
  type StudentSummary,
} from "../../data/demoStudents";

export type StudentDetailsTab = "general" | "historial" | "incidencias";

interface StudentDetailsDialogProps {
  open: boolean;
  student: StudentSummary | null;
  initialTab?: StudentDetailsTab;
  onClose: () => void;
}

const tabs: { key: StudentDetailsTab; label: string }[] = [
  { key: "general", label: "Información general" },
  { key: "historial", label: "Historial de préstamos" },
  { key: "incidencias", label: "Incidencias" },
];

function initials(nombres: string, apellidos: string): string {
  return `${nombres.trim().charAt(0)}${apellidos
    .trim()
    .charAt(0)}`.toUpperCase();
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-[12.5px] text-text-secondary">{label}</dt>
      <dd className="text-right text-[13px] text-text">{children}</dd>
    </div>
  );
}

function Metric({
  value,
  label,
  accent = "text",
}: {
  value: number;
  label: string;
  accent?: "text" | "brand" | "success" | "error";
}) {
  const color =
    value === 0
      ? "text-text-secondary/45"
      : accent === "brand"
        ? "text-brand"
        : accent === "success"
          ? "text-success"
          : accent === "error"
            ? "text-error"
            : "text-text";
  return (
    <div className="rounded-md border border-border-soft bg-[#F7F9FC] px-3 py-2">
      <p className={`text-[18px] font-semibold tabular-nums ${color}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-4 text-text-secondary">{label}</p>
    </div>
  );
}

export function StudentDetailsDialog({
  open,
  student,
  initialTab = "general",
  onClose,
}: StudentDetailsDialogProps) {
  const [tab, setTab] = useState(initialTab);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, student?.id, initialTab]);

  if (!student) return null;

  const loans = getStudentLoans(student.id);
  const incidents = getStudentIncidents(student.id);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const current = tabs.findIndex((item) => item.key === tab);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    setTab(tabs[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detalles del estudiante"
      subtitle="Información, historial de préstamos e incidencias."
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="mb-3 flex items-center gap-3 rounded-md border border-border-soft bg-[#F7F9FC] px-3 py-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[15px] font-semibold text-brand"
        >
          {initials(student.nombres, student.apellidos)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-text">
            {student.nombreCompleto}
          </p>
          <p className="font-mono text-[12.5px] text-text-secondary">
            {student.codigoUniversitario}
          </p>
        </div>
        <div className="ml-auto">
          <Badge variant={student.activo ? "success" : "neutral"} dot>
            {student.activo ? "Activo" : "Inactivo"}
          </Badge>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Secciones del estudiante"
        onKeyDown={onKeyDown}
        className="flex items-center gap-1 border-b border-border-soft"
      >
        {tabs.map((item, index) => {
          const active = item.key === tab;
          return (
            <button
              key={item.key}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`estudiante-tab-${item.key}`}
              aria-selected={active}
              aria-controls={`estudiante-panel-${item.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(item.key)}
              className={`relative flex h-10 items-center px-3 text-[13px] font-medium transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                active ? "text-brand" : "text-text-secondary hover:text-text"
              }`}
            >
              {item.label}
              <span
                className={`absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-brand transition-opacity duration-[120ms] ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          );
        })}
      </div>

      {tab === "general" && (
        <div
          role="tabpanel"
          id="estudiante-panel-general"
          aria-labelledby="estudiante-tab-general"
        >
          <section className="mt-3">
            <h3 className="text-[12.5px] font-medium text-text">
              Información del estudiante
            </h3>
            <dl className="mt-1 divide-y divide-border-soft">
              <DetailRow label="Código universitario">
                <span className="font-mono text-[12.5px]">
                  {student.codigoUniversitario}
                </span>
              </DetailRow>
              <DetailRow label="Estado">
                <Badge variant={student.activo ? "success" : "neutral"} dot>
                  {student.activo ? "Activo" : "Inactivo"}
                </Badge>
              </DetailRow>
              <DetailRow label="Fecha de alta">
                <span className="tabular-nums">
                  {formatFecha(student.creadoEn)}
                </span>
              </DetailRow>
            </dl>
          </section>

          <section className="mt-4">
            <h3 className="text-[12.5px] font-medium text-text">
              Resumen de actividad
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric
                value={student.prestamosActivos}
                label="Préstamos activos"
                accent="brand"
              />
              <Metric
                value={student.prestamosFinalizados}
                label="Préstamos finalizados"
                accent="success"
              />
              <Metric value={student.unidadesActivas} label="Unidades fuera" />
              <Metric
                value={student.incidencias}
                label="Incidencias"
                accent="error"
              />
            </div>
          </section>
        </div>
      )}

      {tab === "historial" && (
        <div
          role="tabpanel"
          id="estudiante-panel-historial"
          aria-labelledby="estudiante-tab-historial"
        >
          <h3 className="mt-3 text-[12.5px] font-medium text-text">
            Historial de préstamos ({loans.length})
          </h3>
          <StudentHistoryTable loans={loans} />
        </div>
      )}

      {tab === "incidencias" && (
        <div
          role="tabpanel"
          id="estudiante-panel-incidencias"
          aria-labelledby="estudiante-tab-incidencias"
        >
          <h3 className="mt-3 text-[12.5px] font-medium text-text">
            Incidencias asociadas ({incidents.length})
          </h3>
          <StudentIncidentsList incidents={incidents} />
        </div>
      )}
    </Dialog>
  );
}
