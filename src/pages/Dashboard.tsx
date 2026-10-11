import {
  Package,
  Layers,
  CheckCircle,
  ArrowRightLeft,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { SectionCard } from "../components/ui/SectionCard";
import { DataTable, type Column } from "../components/ui/DataTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  DEMO_MODE,
  demoStats,
  demoRecentLoans,
  demoPendingReturns,
  demoAlerts,
  type DemoLoan,
  type DemoAlert,
} from "../data/demoData";

type Accent = "brand" | "success" | "warning" | "error" | "info";

const statVisuals: Record<string, { icon: LucideIcon; accent: Accent }> = {
  articles: { icon: Package, accent: "brand" },
  units: { icon: Layers, accent: "info" },
  available: { icon: CheckCircle, accent: "success" },
  loaned: { icon: ArrowRightLeft, accent: "warning" },
};

const loanStatusVariant = {
  Activo: "info",
  Cerrado: "neutral",
  Anulado: "error",
} as const;

const alertTypeDot: Record<DemoAlert["type"], string> = {
  Daño: "bg-warning",
  Pérdida: "bg-error",
  Faltante: "bg-error",
};

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  const [day, month, year] = due.split("/").map(Number);
  const dueDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}

const loanColumns: Column<DemoLoan>[] = [
  { key: "folio", header: "Código", mono: true, width: "150px" },
  { key: "student", header: "Estudiante" },
  { key: "date", header: "Fecha", width: "110px" },
  { key: "items", header: "Artículos", align: "right", width: "90px" },
  {
    key: "status",
    header: "Estado",
    width: "110px",
    render: (row) => (
      <Badge variant={loanStatusVariant[row.status]}>{row.status}</Badge>
    ),
  },
];

const alertColumns: Column<DemoAlert>[] = [
  {
    key: "type",
    header: "Tipo",
    width: "160px",
    render: (row) => (
      <span className="inline-flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${alertTypeDot[row.type]}`}
        />
        <span className="text-text">{row.type}</span>
      </span>
    ),
  },
  { key: "item", header: "Artículo" },
  { key: "origin", header: "Origen" },
  {
    key: "status",
    header: "Estado",
    width: "120px",
    render: (row) => (
      <Badge variant={row.status === "Abierto" ? "error" : "success"} dot>
        {row.status}
      </Badge>
    ),
  },
];

export function Dashboard() {
  const todayRaw = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  return (
    <>
      <PageHeader
        title="Panel de control"
        subtitle="Resumen general del inventario y préstamos"
        meta={
          <>
            <span className="hidden text-[12px] text-text-secondary @[760px]:inline">
              {today}
            </span>
            {DEMO_MODE && (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border-soft bg-surface px-3 text-[11px] font-medium text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-[#828D9E]" />
                Vista de demostración
              </span>
            )}
          </>
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-8 pb-5 pt-5">
        <section className="grid grid-cols-1 gap-4 @[600px]:grid-cols-2 @[1040px]:grid-cols-4">
          {demoStats.map((stat) => {
            const visual = statVisuals[stat.key];
            const Icon = visual.icon;
            return (
              <StatCard
                key={stat.key}
                value={stat.value}
                label={stat.label}
                hint={stat.hint}
                accent={visual.accent}
                icon={<Icon className="h-[18px] w-[18px]" />}
              />
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-4 @[960px]:grid-cols-3">
          <SectionCard
            className="@[960px]:col-span-2"
            title="Préstamos recientes"
            subtitle="Últimas entregas registradas"
            action={
              <Button variant="tertiary" disabled title="Disponible en una fase posterior">
                Ver todos
              </Button>
            }
            bodyClassName="p-0"
          >
            <DataTable
              columns={loanColumns}
              data={demoRecentLoans}
              keyField="id"
              flat
            />
          </SectionCard>

          <SectionCard
            title="Devoluciones pendientes"
            subtitle="Préstamos con unidades por devolver"
            bodyClassName="space-y-2"
          >
            {demoPendingReturns.map((item) => {
              const overdue = isOverdue(item.due);
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-border-soft p-3 transition-colors duration-[120ms] ease-out hover:border-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-text">
                        {item.student}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[12px] text-text-secondary">
                        {item.folio}
                      </p>
                    </div>
                    <Badge variant={overdue ? "error" : "warning"} dot>
                      {overdue ? "Vencida" : "Pendiente"}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[12px]">
                    <span className="text-text-secondary">
                      {item.due ? `Fecha límite ${item.due}` : "Sin fecha límite"}
                    </span>
                    <span className="font-semibold tabular-nums text-text">
                      {item.pending} pendientes
                    </span>
                  </div>
                </div>
              );
            })}
          </SectionCard>
        </section>

        <section>
          <SectionCard
            title="Alertas e incidencias"
            subtitle="Daños, pérdidas y faltantes registrados"
            bodyClassName="p-0"
          >
            <DataTable
              columns={alertColumns}
              data={demoAlerts}
              keyField="id"
              flat
            />
          </SectionCard>
        </section>
      </div>
    </>
  );
}
