
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Hash,
  LayoutDashboard,
  PackageOpen,
  UserRound,
} from "lucide-react";

import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { StudentHistoryTable } from "./StudentHistoryTable";
import { StudentIncidentsList } from "./StudentIncidentsList";

import {
  formatFecha,
  getStudentIncidents,
  getStudentLoans,
  type StudentSummary,
} from "../../data/demoStudents";

export type StudentDetailsTab =
  | "general"
  | "historial"
  | "incidencias";

interface StudentDetailsDialogProps {
  open: boolean;
  student: StudentSummary | null;
  initialTab?: StudentDetailsTab;
  onClose: () => void;
}

const tabs = [
  {
    key: "general",
    label: "Información general",
    icon: LayoutDashboard,
  },
  {
    key: "historial",
    label: "Historial de préstamos",
    icon: BookOpen,
  },
  {
    key: "incidencias",
    label: "Incidencias",
    icon: AlertTriangle,
  },
] as const;

function initials(
  nombres: string,
  apellidos: string
): string {
  return `${nombres.trim().charAt(0)}${apellidos
    .trim()
    .charAt(0)}`.toUpperCase();
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`
        inline-flex h-8 shrink-0 items-center
        gap-2 whitespace-nowrap rounded-xl border px-3
        text-[11.5px] font-semibold
        ${
          active
            ? "border-[#CFE9D8] bg-[#EDF8F1] text-[#1B8E57]"
            : "border-[#E4E8EF] bg-[#F4F6F9] text-[#64748B]"
        }
      `}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          active ? "bg-[#1FB56C]" : "bg-[#99A5B5]"
        }`}
      />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function DetailItem({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#E6EDF6] bg-[#FBFCFF] px-3.5 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#EDF5FF] text-[#4384DB]">
        {icon}
      </div>

      <div className="min-w-0">
        <dt className="text-[10.5px] font-medium text-[#8998AE]">
          {label}
        </dt>
        <dd className="mt-1 min-w-0 text-[12px] font-semibold text-[#273C5D]">
          {children}
        </dd>
      </div>
    </div>
  );
}

type MetricAccent = "blue" | "green" | "violet" | "red";

const metricStyles: Record<
  MetricAccent,
  { icon: string; value: string; background: string }
> = {
  blue: {
    icon: "bg-[#E8F2FF] text-[#317FE7]",
    value: "text-[#317FE7]",
    background: "border-[#E1EBF8] bg-[#FAFCFF]",
  },
  green: {
    icon: "bg-[#E9F8EF] text-[#1C9B64]",
    value: "text-[#1C9B64]",
    background: "border-[#E1EEE6] bg-[#FBFEFC]",
  },
  violet: {
    icon: "bg-[#F0EDFF] text-[#8068D6]",
    value: "text-[#8068D6]",
    background: "border-[#E9E5F5] bg-[#FCFBFF]",
  },
  red: {
    icon: "bg-[#FFF0F2] text-[#D9576B]",
    value: "text-[#D9576B]",
    background: "border-[#F5E1E5] bg-[#FFFCFD]",
  },
};

function Metric({
  value,
  label,
  icon,
  accent,
}: {
  value: number;
  label: string;
  icon: ReactNode;
  accent: MetricAccent;
}) {
  const styles = metricStyles[accent];

  return (
    <div
      className={`
        min-w-0 rounded-xl border p-3
        ${styles.background}
      `}
    >
      <div
        className={`
          flex h-8 w-8 items-center justify-center
          rounded-[10px] ${styles.icon}
        `}
      >
        {icon}
      </div>

      <p
        className={`
          mt-2 text-[22px] font-bold
          leading-7 tabular-nums
          ${value === 0 ? "text-[#A4B0C1]" : styles.value}
        `}
      >
        {value}
      </p>

      <p className="mt-1 text-[10.5px] font-medium leading-[15px] text-[#7889A2]">
        {label}
      </p>
    </div>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EAF3FF] text-[#347FDC]">
        {icon}
      </span>
      <h3 className="text-[12.5px] font-semibold text-[#233958]">
        {children}
      </h3>
    </div>
  );
}

export function StudentDetailsDialog({
  open,
  student,
  initialTab = "general",
  onClose,
}: StudentDetailsDialogProps) {
  const [tab, setTab] =
    useState<StudentDetailsTab>(initialTab);

  const tabRefs = useRef<
    Array<HTMLButtonElement | null>
  >([]);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, student?.id, initialTab]);

  if (!student) return null;

  const loans = getStudentLoans(student.id);
  const incidents = getStudentIncidents(student.id);

  const onKeyDown = (
    event: KeyboardEvent<HTMLDivElement>
  ) => {
    if (
      !["ArrowRight", "ArrowLeft", "Home", "End"].includes(
        event.key
      )
    ) {
      return;
    }

    event.preventDefault();

    const current = tabs.findIndex(
      (item) => item.key === tab
    );

    let next = current;

    if (event.key === "ArrowRight") {
      next = (current + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      next = (current - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = tabs.length - 1;
    }

    setTab(tabs[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detalles del estudiante"
      subtitle="Información y actividad del estudiante seleccionado."
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-4">
        {/* ====================================
            FICHA DEL ESTUDIANTE
        ==================================== */}

        <section className="flex min-w-0 flex-wrap items-center gap-3.5 rounded-2xl border border-[#DCE9FA] bg-gradient-to-r from-[#F0F6FF] via-[#F6F9FF] to-white px-4 py-3.5">
          <div
            aria-hidden="true"
            className="
              flex h-14 w-14 shrink-0
              items-center justify-center
              rounded-[17px]
              border border-[#CFE1FB]
              bg-white
              text-[17px] font-bold
              text-[#337EDC]
              shadow-[0_3px_10px_rgba(47,115,204,0.08)]
            "
          >
            {initials(student.nombres, student.apellidos)}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[16px] font-bold leading-6 text-[#213757]">
              {student.nombreCompleto}
            </h3>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-[#8094B0]" />
              <span className="font-mono text-[11.5px] text-[#617A9E]">
                {student.codigoUniversitario}
              </span>
            </div>
          </div>

          <StatusBadge active={student.activo} />
        </section>

        {/* ====================================
            PESTAÑAS
        ==================================== */}

        <div
          role="tablist"
          aria-label="Secciones del estudiante"
          onKeyDown={onKeyDown}
          className="
            flex min-w-0 gap-1
            overflow-x-auto
            border-b border-[#E5ECF6]
          "
        >
          {tabs.map((item, index) => {
            const active = item.key === tab;
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`estudiante-tab-${item.key}`}
                aria-selected={active}
                aria-controls={`estudiante-panel-${item.key}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(item.key)}
                className={`
                  relative flex h-11 shrink-0
                  items-center gap-2
                  whitespace-nowrap px-3.5
                  text-[12px] font-semibold
                  transition-colors duration-200
                  focus-visible:outline-2
                  focus-visible:outline-offset-2
                  focus-visible:outline-brand
                  ${
                    active
                      ? "text-[#267BEB]"
                      : "text-[#8190A6] hover:text-[#385D91]"
                  }
                `}
              >
                <Icon className="h-[15px] w-[15px]" />
                {item.label}

                <span
                  className={`
                    absolute inset-x-2 bottom-0
                    h-[2.5px] rounded-full
                    bg-[#398BFF]
                    transition-opacity duration-200
                    ${
                      active ? "opacity-100" : "opacity-0"
                    }
                  `}
                />
              </button>
            );
          })}
        </div>

        {/* ====================================
            INFORMACIÓN GENERAL
        ==================================== */}

        {tab === "general" && (
          <div
            role="tabpanel"
            id="estudiante-panel-general"
            aria-labelledby="estudiante-tab-general"
            className="space-y-4"
          >
            <section>
              <SectionTitle
                icon={<UserRound className="h-[17px] w-[17px]" />}
              >
                Información del estudiante
              </SectionTitle>

              <dl className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <DetailItem
                  icon={<Hash className="h-[17px] w-[17px]" />}
                  label="Código universitario"
                >
                  <span className="break-all font-mono text-[11px]">
                    {student.codigoUniversitario}
                  </span>
                </DetailItem>

                <DetailItem
                  icon={
                    <CheckCircle2 className="h-[17px] w-[17px]" />
                  }
                  label="Estado"
                >
                  <span
                    className={
                      student.activo
                        ? "text-[#1B8E57]"
                        : "text-[#7C899B]"
                    }
                  >
                    {student.activo ? "Activo" : "Inactivo"}
                  </span>
                </DetailItem>

                <DetailItem
                  icon={
                    <CalendarDays className="h-[17px] w-[17px]" />
                  }
                  label="Fecha de alta"
                >
                  <span className="tabular-nums">
                    {formatFecha(student.creadoEn)}
                  </span>
                </DetailItem>
              </dl>
            </section>

            <section>
              <SectionTitle
                icon={
                  <LayoutDashboard className="h-[17px] w-[17px]" />
                }
              >
                Resumen de actividad
              </SectionTitle>

              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Metric
                  value={student.prestamosActivos}
                  label="Préstamos activos"
                  icon={<Clock3 className="h-4 w-4" />}
                  accent="blue"
                />

                <Metric
                  value={student.prestamosFinalizados}
                  label="Préstamos finalizados"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  accent="green"
                />

                <Metric
                  value={student.unidadesActivas}
                  label="Unidades fuera"
                  icon={<PackageOpen className="h-4 w-4" />}
                  accent="violet"
                />

                <Metric
                  value={student.incidencias}
                  label="Incidencias"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  accent="red"
                />
              </div>
            </section>
          </div>
        )}

        {/* ====================================
            HISTORIAL DE PRÉSTAMOS
        ==================================== */}

        {tab === "historial" && (
          <div
            role="tabpanel"
            id="estudiante-panel-historial"
            aria-labelledby="estudiante-tab-historial"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <SectionTitle
                icon={<BookOpen className="h-[17px] w-[17px]" />}
              >
                Historial de préstamos
              </SectionTitle>

              <span className="rounded-lg bg-[#EAF2FF] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#3478D5]">
                {loans.length}
              </span>
            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border border-[#E7EDF6] bg-white">
              <StudentHistoryTable loans={loans} />
            </div>
          </div>
        )}

        {/* ====================================
            INCIDENCIAS
        ==================================== */}

        {tab === "incidencias" && (
          <div
            role="tabpanel"
            id="estudiante-panel-incidencias"
            aria-labelledby="estudiante-tab-incidencias"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <SectionTitle
                icon={
                  <AlertTriangle className="h-[17px] w-[17px]" />
                }
              >
                Incidencias asociadas
              </SectionTitle>

              <span className="rounded-lg bg-[#FFF0F2] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#D65367]">
                {incidents.length}
              </span>
            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border border-[#E7EDF6] bg-white">
              <StudentIncidentsList incidents={incidents} />
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
