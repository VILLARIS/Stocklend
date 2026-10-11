import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  Handshake,
  RotateCcw,
  AlertTriangle,
  FileText,
  Settings,
  Boxes,
} from "lucide-react";

type Icon = typeof LayoutDashboard;

interface NavItemDef {
  to: string;
  icon: Icon;
  label: string;
}

const primary: NavItemDef[] = [
  { to: "/", icon: LayoutDashboard, label: "Panel" },
  { to: "/inventario", icon: Package, label: "Inventario" },
  { to: "/estudiantes", icon: Users, label: "Estudiantes" },
  { to: "/prestamos", icon: Handshake, label: "Préstamos" },
  { to: "/devoluciones", icon: RotateCcw, label: "Devoluciones" },
  { to: "/reportes", icon: FileText, label: "Reportes" },
];

const secondary: NavItemDef[] = [
  { to: "/incidentes", icon: AlertTriangle, label: "Incidentes" },
];

function NavItem({ to, icon: Icon, label }: NavItemDef) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        `group relative flex h-10 items-center gap-3 rounded-md px-3 text-[13.5px] font-medium transition-colors duration-[120ms] ease-out @max-[1151px]:justify-center @max-[1151px]:gap-0 @max-[1151px]:px-0 ${
          isActive
            ? "bg-brand-tint text-brand"
            : "text-[#26334A] hover:bg-[#EDF3FA]"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand transition-opacity duration-[120ms] ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
          />
          <Icon
            className={`h-[18px] w-[18px] shrink-0 transition-colors ${
              isActive
                ? "text-brand"
                : "text-[#5A6672] group-hover:text-[#26334A]"
            }`}
          />
          <span className="truncate @max-[1151px]:hidden">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-border-soft bg-surface transition-[width] duration-[160ms] ease-out @max-[1151px]:w-[68px]">
      <div className="flex h-16 items-center gap-3 px-5 @max-[1151px]:justify-center @max-[1151px]:px-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-card">
          <Boxes className="h-5 w-5" />
        </div>
        <div className="min-w-0 leading-tight @max-[1151px]:hidden">
          <span className="block truncate text-[15px] font-semibold tracking-tight text-brand-dark">
            StockLend
          </span>
          <span className="block truncate text-[11px] text-text-secondary">
            Inventario y préstamos
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-3 @max-[1151px]:px-2">
        <div className="flex flex-col gap-1">
          {primary.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}

          <div className="my-2 border-t border-border-soft" />

          {secondary.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </div>

        <div className="mt-auto pt-3">
          <NavItem to="/configuracion" icon={Settings} label="Configuración" />
        </div>
      </nav>

      <div className="shrink-0 border-t border-border-soft px-5 py-3 text-[11px] text-text-secondary @max-[1151px]:px-0 @max-[1151px]:text-center">
        <span className="block truncate">v0.1.0</span>
        <span className="block truncate @max-[1151px]:hidden">esquema 1</span>
      </div>
    </aside>
  );
}
