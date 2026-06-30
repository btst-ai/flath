"use client";

interface Series {
  label: string;
  color: string;
  values: number[];
}

interface Props {
  series: Series[];
  labels: string[];
  ariaLabel?: string;
}

export function LineChartMulti({ series, labels, ariaLabel = "Line chart" }: Props) {
  const w = 600;
  const h = 200;
  const padX = 32;
  const padY = 16;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2 - 20; // 20px for x-axis labels

  const allValues = series.flatMap((s) => s.values);
  const rawMax = Math.max(1, ...allValues);

  const n = labels.length;
  const xFor = (i: number) => (n <= 1 ? padX + innerW / 2 : padX + (i / (n - 1)) * innerW);
  const yFor = (v: number) => padY + innerH - (v / rawMax) * innerH;

  const path = (values: number[]) =>
    values
      .map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`)
      .join(" ");

  // Show every ~7th label to avoid crowding on 30-day views
  const labelStep = Math.max(1, Math.floor(n / 6));

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        role="img"
        aria-label={ariaLabel}
      >
        <rect x={0} y={0} width={w} height={h} fill="white" />
        {/* Zero line */}
        <line
          x1={padX} x2={w - padX}
          y1={yFor(0)} y2={yFor(0)}
          stroke="#e5e7eb" strokeWidth={1}
        />
        {/* Series lines */}
        {series.map((s) => (
          <path
            key={s.label}
            d={path(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {/* X-axis labels */}
        {labels.map((label, i) =>
          i % labelStep === 0 ? (
            <text
              key={i}
              x={xFor(i)}
              y={h - 4}
              textAnchor="middle"
              fontSize={9}
              fill="#9ca3af"
            >
              {label}
            </text>
          ) : null
        )}
        {/* Y-axis max label */}
        <text x={padX - 4} y={padY + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
          {rawMax}
        </text>
      </svg>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-600">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1">
            <span
              className="inline-block w-4 h-0.5 rounded"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
