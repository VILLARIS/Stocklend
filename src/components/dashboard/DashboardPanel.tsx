
import type { ReactNode } from "react";

interface DashboardPanelProps {
  children: ReactNode;
  className?: string;
}

export function DashboardPanel({
  children,
  className = "",
}: DashboardPanelProps) {
  return (
    <section
      className={`
        flex min-h-0 min-w-0 flex-col
        rounded-[20px]
        border border-white/80
        bg-white/90
        p-4
        shadow-[0_6px_24px_rgba(31,65,122,0.06)]
        backdrop-blur-md
        ${className}
      `}
    >
      {children}
    </section>
  );
}

interface PanelHeaderProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  action?: ReactNode;
}

export function PanelHeader({
  title,
  subtitle,
  icon,
  action,
}: PanelHeaderProps) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <div
          className="
            mt-0.5 shrink-0 text-[#267BFA]
            [&>svg]:h-[19px]
            [&>svg]:w-[19px]
          "
        >
          {icon}
        </div>

        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold leading-5 text-[#16274D]">
            {title}
          </h2>

          <p className="mt-0.5 text-[11px] leading-4 text-[#7584A0]">
            {subtitle}
          </p>
        </div>
      </div>

      {action && (
        <div className="shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
