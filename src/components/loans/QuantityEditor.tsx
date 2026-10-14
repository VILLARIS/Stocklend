import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

interface QuantityEditorProps {
  value: number;
  max: number;
  articleName: string;
  onChange: (value: number) => void;
}

/** Control -/+ con entrada numérica para la cantidad de un artículo. */
export function QuantityEditor({
  value,
  max,
  articleName,
  onChange,
}: QuantityEditorProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);

    const next =
      draft.trim() === "" || !Number.isFinite(parsed)
        ? 1
        : Math.min(Math.max(1, Math.trunc(parsed)), Math.max(1, max));

    setDraft(String(next));
    onChange(next);
  };

  return (
    <div
      className="
        flex shrink-0 items-center gap-1
        rounded-[10px]
        border border-[#DFE7F2]
        bg-white p-1
        transition-colors duration-200
        focus-within:border-[#398BFF]
        focus-within:ring-2
        focus-within:ring-[#398BFF]/10
      "
    >
      <button
        type="button"
        aria-label={`Restar una unidad de ${articleName}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className="
          flex h-7 w-7 items-center justify-center
          rounded-md text-[#617794]
          hover:bg-[#EDF5FF] hover:text-[#287FF0]
          disabled:cursor-not-allowed disabled:opacity-30
        "
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;

          if (/^\d*$/.test(next)) {
            setDraft(next);
          }
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        aria-label={`Cantidad de ${articleName}`}
        title={`Introduce una cantidad entre 1 y ${max}`}
        className="
          h-7 w-12 rounded-md
          bg-transparent px-1
          text-center text-[12px] font-semibold
          tabular-nums text-[#283F61]
          outline-none
        "
      />

      <button
        type="button"
        aria-label={`Sumar una unidad de ${articleName}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="
          flex h-7 w-7 items-center justify-center
          rounded-md text-[#617794]
          hover:bg-[#EDF5FF] hover:text-[#287FF0]
          disabled:cursor-not-allowed disabled:opacity-30
        "
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
