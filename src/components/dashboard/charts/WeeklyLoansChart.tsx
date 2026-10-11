import { useId, useState } from "react";
import type { ChartPoint } from "../../ui/DashboardCharts";

// ========================================
// UTILIDAD PARA CURVAS SUAVES

// ========================================

function createSmoothPath(
  points: { x: number; y: number }[]
): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const previous = points[Math.max(0, i - 1)];
    const after = points[Math.min(points.length - 1, i + 2)];
    const tension = 0.16;
    const cp1x =
      current.x + (next.x - previous.x) * tension;
    const cp1y =
      current.y + (next.y - previous.y) * tension;
    const cp2x =
      next.x - (after.x - current.x) * tension;
    const cp2y =
      next.y - (after.y - current.y) * tension;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }
  return path;
}

// ========================================
// GRÁFICO SEMANAL

// ========================================

export function WeeklyLoansChart({
  data,
}: {
  data: ChartPoint[];
}) {
  const id = useId().replace(/:/g, "");
  const gradientId = `weekly-gradient-${id}`;
  const [activeIndex, setActiveIndex] =
    useState<number | null>(null);
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-[#8492AA]">
        No hay datos para mostrar.
      </div>
    );
  }
  const width = 680;
  const height = 300;
  const left = 44;
  const right = 20;
  const top = 30;
  const bottom = 43;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(
    0,
    ...data.map((item) => item.value)
  );
  const tickStep = Math.max(
    1,
    Math.ceil(maxValue / 4)
  );
  const chartMax = tickStep * 4;
  const x = (index: number) =>
    left +
    (data.length === 1
      ? plotWidth / 2
      : (index / (data.length - 1)) * plotWidth);
  const y = (value: number) =>
    top + plotHeight * (1 - value / chartMax);
  const points = data.map((item, index) => ({
    x: x(index),
    y: y(item.value),
    label: item.label,
    value: item.value,
  }));
  const linePath = createSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  const bottomY = top + plotHeight;
  const areaPath = `
    ${linePath}
    L ${last.x} ${bottomY}
    L ${first.x} ${bottomY}
    Z
  `;
  const selected =
    activeIndex !== null
      ? points[activeIndex]
      : null;
  const tooltipWidth = 124;
  const tooltipHeight = 52;
  const tooltipX = selected
    ? Math.max(
        4,
        Math.min(
          width - tooltipWidth - 4,
          selected.x - tooltipWidth / 2
        )
      )
    : 0;
  const tooltipY = selected
    ? selected.y < top + 72
      ? selected.y + 18
      : selected.y - tooltipHeight - 18
    : 0;
  return (
    <div className="relative h-full min-h-0 w-full min-w-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-full w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Préstamos por semana: ${data
          .map((item) => `${item.label}: ${item.value}`)
          .join(", ")}`}
        onMouseLeave={() =>
          setActiveIndex(null)
        }
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
              stopColor="#2684FF"
              stopOpacity="0.20"
            />
            <stop
              offset="60%"
              stopColor="#2684FF"
              stopOpacity="0.07"
            />
            <stop
              offset="100%"
              stopColor="#2684FF"
              stopOpacity="0.01"
            />
          </linearGradient>
        </defs>
        {/* EJES */}
        {Array.from({ length: 5 }, (_, index) => {
          const value = tickStep * index;
          const position = y(value);
          return (
            <g key={index}>
              <line
                x1={left}
                x2={width - right}
                y1={position}
                y2={position}
                stroke="#E5EDF7"
                strokeWidth="1"
              />
              <text
                x={left - 12}
                y={position + 4}
                textAnchor="end"
                fontSize="12"
                fill="#8796AF"
              >
                {value}
              </text>
            </g>
          );
        })}
        {/* ÁREA */}
        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
        />
        {/* CURVA */}
        <path
          d={linePath}
          fill="none"
          stroke="#237EFF"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* LÍNEA DE SELECCIÓN */}
        {selected && (
          <line
            x1={selected.x}
            x2={selected.x}
            y1={top}
            y2={bottomY}
            stroke="#8FB9FF"
            strokeWidth="1.5"
            strokeDasharray="5 6"
          />
        )}
        {/* PUNTOS INTERACTIVOS */}
        {points.map((point, index) => {
          const isActive = activeIndex === index;
          const hitWidth =
            data.length === 1
              ? plotWidth
              : plotWidth / (data.length - 1);
          const startX = Math.max(
            left,
            point.x - hitWidth / 2
          );
          return (
            <g key={`${point.label}-${index}`}>
              <rect
                x={startX}
                y={top}
                width={Math.max(
                  0,
                  Math.min(
                    hitWidth,
                    width - right - startX
                  )
                )}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() =>
                  setActiveIndex(index)
                }
                onFocus={() =>
                  setActiveIndex(index)
                }
                onBlur={() =>
                  setActiveIndex(null)
                }
                tabIndex={0}
                role="button"
                aria-label={`${point.label}: ${point.value} préstamos`}
                className="cursor-pointer outline-none"
              />
              {isActive && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="11"
                  fill="#237EFF"
                  opacity="0.13"
                  pointerEvents="none"
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r={isActive ? 6 : 4.8}
                fill="#237EFF"
                stroke="white"
                strokeWidth="2.4"
                pointerEvents="none"
              />
              <text
                x={point.x}
                y={height - 13}
                textAnchor="middle"
                fontSize="12"
                fontWeight={
                  isActive ? "600" : "400"
                }
                fill={
                  isActive
                    ? "#1768D4"
                    : "#7788A6"
                }
              >
                {point.label}
              </text>
            </g>
          );
        })}
        {/* TOOLTIP */}
        {selected && (
          <g
            transform={`translate(${tooltipX}, ${tooltipY})`}
            pointerEvents="none"
          >
            <rect
              width={tooltipWidth}
              height={tooltipHeight}
              rx="11"
              fill="#FFFFFF"
              stroke="#DBE7F7"
            />
            <text
              x="13"
              y="19"
              fontSize="11"
              fill="#7183A2"
            >
              {selected.label}
            </text>
            <text
              x="13"
              y="38"
              fontSize="14"
              fontWeight="700"
              fill="#152B53"
            >
              {selected.value} préstamos
            </text>
            <circle
              cx="108"
              cy="28"
              r="4"
              fill="#237EFF"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
