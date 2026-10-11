
import { useState } from "react";
import { NavLink } from "react-router-dom";

import background from "../../assets/nabvar/sideBackground.png";
import logo from "../../assets/branding/stocklend-logo.png";
import logoIcon from "../../assets/branding/stocklend-icon.png";

import {
  Home,
  Package,
  Users,
  Handshake,
  RotateCcw,
  AlertTriangle,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type Icon = typeof Home;

interface NavItemDef {
  to: string;
  icon: Icon;
  label: string;
}

interface NavItemProps extends NavItemDef {
  isCollapsed: boolean;
}

const primary: NavItemDef[] = [
  { to: "/", icon: Home, label: "Dashboard" },
  { to: "/inventario", icon: Package, label: "Inventario" },
  { to: "/estudiantes", icon: Users, label: "Estudiantes" },
  { to: "/prestamos", icon: Handshake, label: "Préstamos" },
  { to: "/devoluciones", icon: RotateCcw, label: "Devoluciones" },
  { to: "/reportes", icon: FileText, label: "Reportes" },
];

const secondary: NavItemDef[] = [
  {
    to: "/incidentes",
    icon: AlertTriangle,
    label: "Incidentes",
  },
];

function NavItem({
  to,
  icon: Icon,
  label,
  isCollapsed,
}: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        `
        group relative flex h-11 shrink-0 items-center
        rounded-xl text-[14px] font-medium
        transition-[background-color,color,box-shadow]
        duration-200 ease-out

        ${
          isCollapsed
            ? "justify-center px-0"
            : "gap-3 px-3"
        }

        ${
          isActive
            ? "bg-gradient-to-r from-[#2877F0] to-[#75B3FF] text-white shadow-[0_6px_16px_rgba(37,99,235,0.20)]"
            : "text-[#263D66] hover:bg-white/65 hover:text-[#1764D2]"
        }
        `
      }
    >
      {({ isActive }) => (
        <>
          {/* Indicador del elemento seleccionado */}
          <span
            className={`
              pointer-events-none absolute top-1/2
              h-7 w-[3px] -translate-y-1/2
              rounded-full bg-[#2477FF]
              transition-opacity duration-200

              ${isCollapsed ? "-left-2" : "-left-3"}

              ${
                isActive
                  ? "opacity-100"
                  : "opacity-0"
              }
            `}
          />

          {/* Icono de navegación */}
          <Icon
            className={`
              h-5 w-5 shrink-0
              transition-colors duration-200

              ${
                isActive
                  ? "text-white"
                  : "text-[#465D86] group-hover:text-[#1764D2]"
              }
            `}
          />

          {/* Nombre de la sección */}
          {!isCollapsed && (
            <span className="min-w-0 truncate">
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed((previous) => !previous);
  };

  return (
    <aside
      className={`
        relative flex h-full min-h-0 shrink-0
        flex-col overflow-hidden
        border-r border-white/50

        transition-[width] duration-200 ease-out

        ${
          isCollapsed
            ? "w-[68px]"
            : "w-[250px]"
        }
      `}
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Capa suave del fondo */}
      <div
        className="
          pointer-events-none absolute inset-0
          bg-white/10
        "
      />

      {/* Contenido */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">

        {/* =====================================
            LOGO STOCKLEND
        ===================================== */}

        <div
          className={`
            flex h-[88px] shrink-0 items-center
            transition-[padding] duration-200

            ${
              isCollapsed
                ? "justify-center px-2"
                : "px-3"
            }
          `}
        >
          {isCollapsed ? (
            <img
              src={logoIcon}
              alt="StockLend"
              title="StockLend"
              className="
                block h-11 w-11 shrink-0
                object-contain
              "
            />
          ) : (
            <img
              src={logo}
              alt="StockLend — Inventario y préstamos"
              className="
                block h-auto w-full
                max-w-[224px]
                object-contain
              "
            />
          )}
        </div>

        {/* =====================================
            NAVEGACIÓN PRINCIPAL
        ===================================== */}

        <nav
          aria-label="Navegación principal"
          className={`
            flex min-h-0 flex-1 flex-col
            overflow-y-auto py-3

            ${
              isCollapsed
                ? "px-2"
                : "px-3"
            }
          `}
        >
          <div className="flex flex-col gap-2">
            {primary.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                isCollapsed={isCollapsed}
              />
            ))}

            {/* Separador */}
            <div className="my-3 border-t border-[#BDD1EA]/60" />

            {secondary.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>

          {/* Configuración al final */}
          <div className="mt-auto pt-3">
            <NavItem
              to="/configuracion"
              icon={Settings}
              label="Configuración"
              isCollapsed={isCollapsed}
            />
          </div>
        </nav>

        {/* =====================================
            CONTRAER / EXPANDIR SIDEBAR
        ===================================== */}

        <div
          className={`
            shrink-0
            border-t border-[#BDD1EA]/50
            py-3

            ${
              isCollapsed
                ? "px-2"
                : "px-5"
            }
          `}
        >
          <button
            type="button"
            onClick={toggleSidebar}
            title={
              isCollapsed
                ? "Expandir barra lateral"
                : "Contraer barra lateral"
            }
            aria-label={
              isCollapsed
                ? "Expandir barra lateral"
                : "Contraer barra lateral"
            }
            aria-expanded={!isCollapsed}
            className={`
              mb-2 flex w-full items-center
              gap-2 rounded-lg py-2

              text-[#465D86]
              transition-colors duration-200

              hover:bg-white/60
              hover:text-[#1764D2]

              focus-visible:outline-2
              focus-visible:outline-offset-2
              focus-visible:outline-[#2877F0]

              ${
                isCollapsed
                  ? "justify-center px-0"
                  : "px-3"
              }
            `}
          >
            {isCollapsed ? (
              <ChevronRight
                className="h-5 w-5 shrink-0"
              />
            ) : (
              <>
                <ChevronLeft
                  className="h-5 w-5 shrink-0"
                />

                <span className="text-[13px] font-medium">
                  Contraer
                </span>
              </>
            )}
          </button>

          {/* Versión */}
          <div
            className={`
              text-[11px] text-[#667795]

              ${
                isCollapsed
                  ? "text-center"
                  : ""
              }
            `}
          >
            <span className="block truncate">
              v0.1.0
            </span>

            {!isCollapsed && (
              <span className="block truncate">
                esquema 1
              </span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
