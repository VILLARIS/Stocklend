import { type ReactNode } from "react";

type BadgeVariant = "success" | "warning" | "error" | "neutral" | "info";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
}

const styles: Record<BadgeVariant, string> = {
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  error: "bg-error-tint text-error",
  neutral: "bg-[#E6EBF2] text-text-secondary",
  info: "bg-brand-tint text-brand",
};

const dotStyles: Record<BadgeVariant, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  neutral: "bg-[#828D9E]",
  info: "bg-brand",
};

export function Badge({ children, variant = "neutral", dot = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded px-2 text-[12px] font-semibold ${styles[variant]}`}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotStyles[variant]}`} />
      )}
      {children}
    </span>
  );
}
