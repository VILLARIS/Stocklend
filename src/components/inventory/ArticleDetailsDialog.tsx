import type { ReactNode } from "react";
import { Dialog } from "../ui/Dialog";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import type { InventoryArticle, InventoryUnit } from "../../data/inventoryData";

interface ArticleDetailsDialogProps {
  open: boolean;
  article: InventoryArticle | null;
  unidades?: InventoryUnit[];
  onClose: () => void;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-[12.5px] text-text-secondary">{label}</dt>
      <dd className="text-right text-[13px] text-text">{children}</dd>
    </div>
  );
}

function StockCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "success" | "warning" | "error";
}) {
  const color =
    value === 0
      ? "text-text-secondary/55"
      : accent === "success"
        ? "text-success"
        : accent === "warning"
          ? "text-warning"
          : accent === "error"
            ? "text-error"
            : "text-text";
  return (
    <div className="rounded-md border border-border-soft bg-[#F7F9FC] px-2 py-1.5 text-center">
      <p className="text-[10.5px] uppercase tracking-wide text-text-secondary">
        {label}
      </p>
      <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${color}`}>
        {value}
      </p>
    </div>
  );
}

export function ArticleDetailsDialog({
  open,
  article,
  unidades = [],
  onClose,
}: ArticleDetailsDialogProps) {
  if (!article) return null;

  const total =
    article.disponible + article.prestado + article.danado + article.faltante;

  const disponibilidad = !article.prestable
    ? "No prestable"
    : article.disponible > 0
      ? "Disponible para préstamo"
      : "Sin existencias disponibles";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detalles del artículo"
      subtitle={article.nombre}
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <dl className="divide-y divide-border-soft">
        <DetailRow label="Nombre">{article.nombre}</DetailRow>
        <DetailRow label="Código">
          <span className="font-mono text-[12.5px]">
            {article.codigo ?? "—"}
          </span>
        </DetailRow>
        <DetailRow label="Categoría">
          <Badge variant="neutral">{article.categoria}</Badge>
        </DetailRow>
        <DetailRow label="Tipo de control">
          {article.controlIndividual
            ? "Por unidades individuales"
            : "Por cantidad"}
        </DetailRow>
        <DetailRow label="Disponibilidad">{disponibilidad}</DetailRow>
        <DetailRow label="Estado">
          <Badge variant={article.prestable ? "success" : "neutral"} dot>
            {article.prestable ? "Prestable" : "No prestable"}
          </Badge>
        </DetailRow>
      </dl>

      <div className="mt-4">
        <p className="text-[12.5px] font-medium text-text">Existencias</p>
        <div className="mt-2 grid grid-cols-5 gap-2">
          <StockCell label="Disp." value={article.disponible} accent="success" />
          <StockCell label="Prest." value={article.prestado} />
          <StockCell label="Dañ." value={article.danado} accent="warning" />
          <StockCell label="Falt." value={article.faltante} accent="error" />
          <StockCell label="Total" value={total} />
        </div>
      </div>

      {article.controlIndividual && (
        <div className="mt-4">
          <p className="text-[12.5px] font-medium text-text">
            Códigos de unidad ({unidades.length})
          </p>
          {unidades.length > 0 ? (
            <div className="mt-2 flex max-h-[120px] flex-wrap gap-1.5 overflow-y-auto">
              {unidades.map((unit) => (
                <span
                  key={unit.id}
                  className="rounded border border-border-soft bg-[#F7F9FC] px-1.5 py-0.5 font-mono text-[11.5px] text-text-secondary"
                >
                  {unit.codigo}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11.5px] text-text-secondary">
              Este artículo aún no tiene unidades registradas.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
