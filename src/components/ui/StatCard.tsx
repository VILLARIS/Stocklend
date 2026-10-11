import { type ReactNode } from "react";

interface StatCardProps {
  value: number | string;
  label: string;
  icon: ReactNode;
  accent?: "brand" | "success" | "warning" | "error" | "info";
  hint?: string;
}

const accents = {
  brand: "bg-brand-tint text-brand",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  error: "bg-error-tint text-error",
  info: "bg-[#EEF2F8] text-[#3A4A5E]",
};

export function StatCard({
  value,
  label,
  icon,
  accent = "brand",
  hint,
}: StatCardProps) {
  return (
    <div className="group flex flex-col rounded-card border border-border bg-surface p-4 shadow-card transition-[box-shadow,border-color,transform] duration-[180ms] ease-out hover:-translate-y-0.5 hover:border-[#C3D2E6] hover:shadow-card-hover">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-[180ms] ease-out group-hover:scale-105 ${accents[accent]}`}
        >
          {icon}
        </div>
        <p className="text-[28px] font-semibold leading-none tabular-nums text-text">
          {value}
        </p>
      </div>
      <p className="mt-3 text-[13px] leading-[18px] text-text-secondary">
        {label}
      </p>
      {hint && (
        <p className="mt-1 text-[12px] leading-4 text-text-secondary/80">
          {hint}
        </p>
      )}
    </div>
  );
}
