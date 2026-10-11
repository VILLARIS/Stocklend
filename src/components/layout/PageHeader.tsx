import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, meta, action }: PageHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border-soft px-8 py-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-7 tracking-tight text-text">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[13px] leading-[18px] text-text-secondary">
            {subtitle}
          </p>
        )}
      </div>
      {(meta || action) && (
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {meta}
          {action}
        </div>
      )}
    </header>
  );
}
