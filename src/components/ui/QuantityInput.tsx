import { Minus, Plus } from "lucide-react";

interface QuantityInputProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number | null;
  limitLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  onBlur?: () => void;
}

export function QuantityInput({
  id,
  value,
  onChange,
  min = 0,
  max = null,
  limitLabel,
  disabled = false,
  invalid = false,
  ariaLabel = "Cantidad",
  onBlur,
}: QuantityInputProps) {
  const clamp = (candidate: number) => {
    let next = Number.isFinite(candidate) ? Math.trunc(candidate) : min;
    if (next < min) next = min;
    if (max != null && next > max) next = max;
    return next;
  };

  const handleText = (raw: string) => {
    if (raw.trim() === "") {
      onChange(min);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    if (max != null && parsed > max) {
      onChange(parsed);
      return;
    }
    onChange(Math.max(min, Math.trunc(parsed)));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    if (event.shiftKey && max != null) {
      onChange(max);
      return;
    }
    const step = (event.ctrlKey || event.metaKey ? 5 : 1) *
      (event.key === "ArrowUp" ? 1 : -1);
    onChange(clamp(value + step));
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`inline-flex h-9 items-stretch overflow-hidden rounded-md border bg-surface ${
          invalid ? "border-error" : "border-border"
        }`}
      >
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={disabled || value <= min}
          aria-label="Disminuir cantidad"
          className="inline-flex w-9 items-center justify-center text-text-secondary transition-colors duration-[120ms] hover:bg-[#E6EBF2] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(event) => handleText(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={(event) => {
            onChange(clamp(Number(event.target.value)));
            onBlur?.();
          }}
          className="w-14 border-x border-border-soft bg-surface text-center text-sm tabular-nums text-text focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand disabled:bg-[#F1F4F8] disabled:text-text-secondary"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={disabled || (max != null && value >= max)}
          aria-label="Aumentar"
          className="inline-flex w-9 items-center justify-center text-text-secondary transition-colors duration-[120ms] hover:bg-[#E6EBF2] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {limitLabel && (
        <span className="text-[11.5px] text-text-secondary">{limitLabel}</span>
      )}
    </div>
  );
}
