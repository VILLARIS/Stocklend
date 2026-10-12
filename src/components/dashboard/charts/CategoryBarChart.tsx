import type { ChartSegment } from "./types";

// ========================================
// GRÁFICO DE CATEGORÍAS
// CONSERVADO PARA FUTURAS PANTALLAS

// ========================================

export function CategoryBarChart({
  data,
}: {
  data: ChartSegment[];
}) {
  if (data.length === 0) return null;
  const width = 390;
  const height = 225;
  const left = 28;
  const right = 10;
  const top = 22;
  const bottom = 46;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maximum = Math.max(
    0,
    ...data.map((item) => item.value)
  );
  const tickStep = Math.max(
    1,
    Math.ceil(maximum / 5)
  );
  const chartMax = tickStep * 5;
  const step = plotWidth / data.length;
  const barWidth = Math.min(42, step * 0.58);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="block h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Artículos por categoría"
    >
      {Array.from({ length: 6 }, (_, index) => {
        const value = tickStep * index;
        const position =
          top + plotHeight * (1 - value / chartMax);
        return (
          <g key={index}>
            <line
              x1={left}
              x2={width - right}
              y1={position}
              y2={position}
              stroke="#E7EDF5"
            />
            <text
              x={left - 7}
              y={position + 3}
              textAnchor="end"
              fontSize="10"
              fill="#8290A8"
            >
              {value}
            </text>
          </g>
        );
      })}
      {data.map((item, index) => {
        const barHeight =
          (item.value / chartMax) * plotHeight;
        const x =
          left +
          index * step +
          (step - barWidth) / 2;
        const y = top + plotHeight - barHeight;
        return (
          <g key={`${item.label}-${index}`}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="5"
              fill={item.color}
            />
            <text
              x={x + barWidth / 2}
              y={y - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="#192B50"
            >
              {item.value}
            </text>
            <text
              x={x + barWidth / 2}
              y={height - 15}
              textAnchor="middle"
              fontSize="10"
              fill="#667995"
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
