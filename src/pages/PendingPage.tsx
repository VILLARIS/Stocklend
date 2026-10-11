import { Construction } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";

interface PendingPageProps {
  title: string;
  subtitle: string;
}

export function PendingPage({ title, subtitle }: PendingPageProps) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="flex min-h-0 flex-1 overflow-y-auto px-8 pb-8 pt-6">
        <div className="flex flex-1 items-center justify-center rounded-card border border-border-soft bg-surface">
          <EmptyState
            icon={<Construction />}
            title={`${title} — pendiente de desarrollo`}
            description="Esta sección estará disponible en una próxima fase de la migración."
          />
        </div>
      </div>
    </>
  );
}
