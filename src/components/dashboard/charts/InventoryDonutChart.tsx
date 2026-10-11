import { useState } from "react";
import type { ChartSegment } from "../../ui/DashboardCharts";

// ========================================
// GRÁFICO DE INVENTARIO

// ========================================

export function InventoryDonutChart({
  data,
}: {
  data: ChartSegment[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = data.reduce(
    (sum, segment) => sum + Math.max(0, segment.value),
    0
  );
  const availableIndex = data.findIndex(
    (segment) =>
      segment.label.toLowerCase().trim() === "disponible"
  );
  const radius = 65;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;
  const segments = data.map((segment, index) => {
    const value = Math.max(0, segment.value);
    const length =
      total > 0 ? (value / total) * circumference : 0;
    const start = accumulated;
    accumulated += length;
    return {
      ...segment,
      id: index,
      value,
      length,
      start,
      percentage:
        total > 0 ? Math.round((value / total) * 100) : 0,
    };
  });
  const active = activeIndex !== null
    ? segments[activeIndex]
    : null;
  const defaultSegment =
    availableIndex >= 0 ? segments[availableIndex] : null;
  const selected = active ?? defaultSegment;
  const centerValue = selected?.value ?? total;
  const centerLabel = active
    ? active.label.toLowerCase()
    : defaultSegment
      ? "disponibles"
      : "unidades";
  const centerColor = selected?.color ?? "#237EFF";
  const centerPercentage = selected?.percentage ?? 100;
  function LegendItem({
    segment,
  }: {
    segment: (typeof segments)[number];
  }) {
    const isActive = activeIndex === segment.id;
    const isDimmed = activeIndex !== null && !isActive;
    return (
      <button
        type="button"
        className={`
          flex w-full min-w-0 flex-col
          rounded-xl px-2 py-2 text-left
          transition-[background-color,opacity]
          duration-200 ease-out
          focus-visible:outline
          focus-visible:outline-2
          focus-visible:outline-[#408DFF]
          ${isActive
            ? "bg-[#EFF6FF]"
            : "hover:bg-[#F5F8FD]"}
          ${isDimmed ? "opacity-50" : "opacity-100"}
        `}
        onMouseEnter={() => setActiveIndex(segment.id)}
        onMouseLeave={() => setActiveIndex(null)}
        onFocus={() => setActiveIndex(segment.id)}
        onBlur={() => setActiveIndex(null)}
        aria-label={`${segment.label}: ${segment.value} unidades, ${segment.percentage}%`}
      >
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: segment.color }}
          />
          <span className="truncate text-[13px] font-semibold text-[#32496F]">
            {segment.label}
          </span>
        </span>
        <span className="mt-1 pl-[18px] text-[12px] text-[#7C8CA7]">
          <span className="font-semibold tabular-nums text-[#182B52]">
            {segment.value}
          </span>
          {" "}· {segment.percentage}%
        </span>
      </button>
    );
  }
  // Dos estados a la izquierda, dos a la derecha.
  const leftSegments = segments.slice(0, 2);
  const rightSegments = segments.slice(2, 4);
  const extraSegments = segments.slice(4);
  return (
    <div
      className="
        flex h-full min-h-0 min-w-0
        flex-col items-center justify-center gap-2
      "
      onMouseLeave={() => setActiveIndex(null)}
    >
      <div
        className="
          grid w-full min-w-0
          grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]
          items-center gap-2
        "
      >
        {/* LEYENDA IZQUIERDA */}
        <div className="flex min-w-0 flex-col justify-center gap-4">
          {leftSegments.map((segment) => (
            <LegendItem key={segment.id} segment={segment} />
          ))}
        </div>
        {/* DONA CENTRAL */}
        <div
          className="
            relative mx-auto aspect-square
            w-full max-w-[185px] min-w-0
          "
        >
          <svg
            viewBox="0 0 180 180"
            className="h-full w-full overflow-visible"
            role="img"
            aria-label={`Estado del inventario: ${segments.map(
              (s) => `${s.label}: ${s.value} unidades`
            ).join(", ")}`}
          >
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="#EBF0F7"
              strokeWidth={strokeWidth}
            />
            {total > 0 && segments.map((segment) => {
              if (segment.value <= 0) return null;
              const isActive = activeIndex === segment.id;
              const isDimmed =
                activeIndex !== null && !isActive;
              return (
                <circle
                  key={segment.id}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={
                    isActive ? strokeWidth + 4 : strokeWidth
                  }
                  strokeDasharray={`${Math.max(
                    0,
                    segment.length - 3
                  )} ${circumference}`}
                  strokeDashoffset={-segment.start}
                  strokeLinecap="butt"
                  opacity={isDimmed ? 0.35 : 1}
                  transform="rotate(-90 90 90)"
                  className="
                    cursor-pointer
                    transition-[stroke-width,opacity]
                    duration-200 ease-out
                  "
                  onMouseEnter={() =>
                    setActiveIndex(segment.id)
                  }
                  onFocus={() =>
                    setActiveIndex(segment.id)
                  }
                  onBlur={() => setActiveIndex(null)}
                  tabIndex={0}
                >
                  <title>
                    {`${segment.label}: ${segment.value} unidades (${segment.percentage}%)`}
                  </title>
                </circle>
              );
            })}
          </svg>
          {/* CENTRO DINÁMICO */}
          <div
            className="
              pointer-events-none absolute inset-0
              flex flex-col items-center justify-center
              text-center
            "
          >
            <strong
              key={`value-${activeIndex ?? "default"}`}
              className="
                text-[clamp(20px,2vw,32px)]
                font-bold leading-none
                tracking-tight tabular-nums
                text-[#12335F]
                motion-safe:animate-[inventoryFade_180ms_ease-out]
              "
            >
              {centerValue}
            </strong>
            <span
              key={`label-${activeIndex ?? "default"}`}
              className="
                mt-1 max-w-[90%] truncate
                text-[clamp(9px,0.9vw,12px)]
                font-semibold
                motion-safe:animate-[inventoryFade_180ms_ease-out]
              "
              style={{ color: centerColor }}
            >
              {centerLabel}
            </span>
            <span className="mt-0.5 text-[10px] text-[#8392AC]">
              {centerPercentage}%
            </span>
          </div>
        </div>
        {/* LEYENDA DERECHA */}
        <div className="flex min-w-0 flex-col justify-center gap-4">
          {rightSegments.map((segment) => (
            <LegendItem key={segment.id} segment={segment} />
          ))}
        </div>
      </div>
      {/* Total de unidades */}
      <p className="text-center text-[11px] text-[#7B8AA4]">
        <span className="font-semibold tabular-nums text-[#273D63]">
          {total}
        </span>{" "}
        unidades en total
      </p>
      {/* Se muestran los estados adicionales si existen */}
      {extraSegments.length > 0 && (
        <div className="flex w-full flex-wrap justify-center gap-2">
          {extraSegments.map((segment) => (
            <div key={segment.id} className="min-w-[110px]">
              <LegendItem segment={segment} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
