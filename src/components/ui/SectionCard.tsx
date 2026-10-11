import { type ReactNode } from "react";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "",
}: SectionCardProps) {
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card ${className}`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-border-soft px-5 py-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-5 text-text">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-[12px] text-text-secondary">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={`flex-1 p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
