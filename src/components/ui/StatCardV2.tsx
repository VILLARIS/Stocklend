
import { useId, type ReactNode } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

export type StatAccent =
  | "blue"
  | "violet"
  | "green"
  | "orange";

interface StatCardV2Props {
  value: number | string;
  label: string;
  icon: ReactNode;
  accent: StatAccent;

  // Texto opcional para otras pantallas
  hint?: string;

  // Propiedades opcionales del Dashboard
  change?: string;
  changeText?: string;
  direction?: "up" | "down";
  positive?: boolean;
  chartData?: number[];
}

const themes: Record<
  StatAccent,
  {
    iconBg: string;
    icon: string;
    line: string;
  }
> = {
  blue: {
    iconBg: "#E7F1FF",
    icon: "#1677FF",
    line: "#1677FF",
  },
  violet: {
    iconBg: "#EEEBFF",
    icon: "#6D61F2",
    line: "#7B73FF",
  },
  green: {
    iconBg: "#E3F8EE",
    icon: "#18B57C",
    line: "#20C48A",
  },
  orange: {
    iconBg: "#FFF2DF",
    icon: "#F0A019",
    line: "#FF535F",
  },
};

function Sparkline({
  data,
  color,
}: {
  data: number[];
  color: string;
}) {
  const gradientId = `spark-${useId().replace(/:/g, "")}`;

  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(max - min, 1);

  const points = data.map((value, index) => ({
    x: 4 + (index / (data.length - 1)) * 92,
    y: 48 - ((value - min) / range) * 38,
  }));

  const coordinates = points
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  const area = `4,52 ${coordinates} 96,52`;

  return (
    <svg
      viewBox="0 0 100 54"
      className="h-[52px] w-[86px] shrink-0"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stopColor={color}
            stopOpacity="0.18"
          />
          <stop
            offset="100%"
            stopColor={color}
            stopOpacity="0"
          />
        </linearGradient>
      </defs>

      <polygon
        points={area}
        fill={`url(#${gradientId})`}
      />

      <polyline
        points={coordinates}
        fill="none"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatCardV2({
  value,
  label,
  icon,
  accent,
  hint,
  change,
  changeText,
  direction,
  positive = true,
  chartData,
}: StatCardV2Props) {
  const theme = themes[accent];
  const hasTrend = change !== undefined && direction !== undefined;

  return (
    <article
      className="
        group flex min-h-[132px] min-w-0
        flex-col justify-between
        rounded-[18px]
        border border-white/80
        bg-white/90
        px-4 py-3.5
        shadow-[0_5px_20px_rgba(27,61,114,0.055)]
        backdrop-blur-md

        transition-[transform,box-shadow,border-color]
        duration-200 ease-out

        hover:border-blue-100
        hover:shadow-[0_12px_26px_rgba(27,61,114,0.09)]
        motion-safe:hover:-translate-y-0.5
      "
    >
      {/* ICONO, NÚMERO Y GRÁFICA */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="
              flex h-12 w-12 shrink-0
              items-center justify-center
              rounded-2xl
              transition-transform duration-200
              motion-safe:group-hover:scale-105
              [&>svg]:h-6 [&>svg]:w-6
            "
            style={{
              backgroundColor: theme.iconBg,
              color: theme.icon,
            }}
          >
            {icon}
          </div>

          <strong
            className="
              min-w-0 truncate
              text-[32px] font-bold leading-none
              tracking-tight tabular-nums
              text-[#101B42]
            "
          >
            {value}
          </strong>
        </div>

        {chartData && chartData.length >= 2 && (
          <Sparkline
            data={chartData}
            color={theme.line}
          />
        )}
      </div>

      {/* ETIQUETA */}
      <p
        className="
          mt-2 text-[14px]
          font-medium leading-5
          text-[#445B85]
        "
      >
        {label}
      </p>

      {/* TENDENCIA O DESCRIPCIÓN */}
      {hasTrend ? (
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`
              inline-flex shrink-0 items-center gap-1
              text-[13px] font-semibold tabular-nums
              ${
                positive
                  ? "text-[#00A86B]"
                  : "text-[#F04452]"
              }
            `}
          >
            {direction === "up" ? (
              <ArrowUp
                className="h-4 w-4"
                strokeWidth={2.5}
              />
            ) : (
              <ArrowDown
                className="h-4 w-4"
                strokeWidth={2.5}
              />
            )}

            {change}
          </span>

          {changeText && (
            <span
              className="
                min-w-0 truncate
                text-[11px] text-[#7D8CA7]
              "
              title={changeText}
            >
              {changeText}
            </span>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[12px] leading-4 text-[#7D8CA7]">
          {hint ?? "\u00A0"}
        </p>
      )}
    </article>
  );
}
