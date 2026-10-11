import { type ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
      <div className="text-text-secondary/40 mb-4 [&>svg]:h-12 [&>svg]:w-12">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-text mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary max-w-sm mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}