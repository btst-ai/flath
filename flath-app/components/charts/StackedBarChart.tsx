"use client";

import { useState, useEffect, useRef } from "react";

interface BarSeries {
  label: string;
  color: string;
  values: number[];
}

interface Props {
  days: string[];
  series: BarSeries[];
  ariaLabel?: string;
}

export function StackedBarChart({ days, series, ariaLabel = "Stacked bar chart" }: Props) {
  const w = 600;
  const h = 200;
  const padX = 32;
  const padY = 16;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2 - 20;

  const n = days.length;
  const barW = Math.max(2, (innerW / n) * 0.8);
  const barGap = innerW / n;

  // Compute per-day totals for y scale
  const dayTotals = days.map((_, i) =>
    series.reduce((s, sr) => s + (sr.values[i] ?? 0), 0)
  );
  const maxTotal = Math.max(1, ...dayTotals);

  const xFor = (i: number) => padX + i * barGap + barGap / 2 - barW / 2;
  const hFor = (v: number) => (v / maxTotal) * innerH;
  const yBase = padY + innerH;

  const labelStep = Math.max(1, Math.floor(n / 6));

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: TouchEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setHoverIdx(null);
      }
    };
    document.addEventListener("touchstart", handler);
    return () => document.removeEventListener("touchstart", handler);
  }, []);

  const tooltipLeft =
    hoverIdx !== null
      ? Math.min(85, Math.max(0, (hoverIdx / Math.max(1, n - 1)) * 100))
      : 0;

  return (
    <div className="w-full relative" ref={containerRef}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        role="img"
        aria-label={ariaLabel}
      >
        <rect x={0} y={0} width={w} height={h} fill="white" />
        {/* Baseline */}
        <line x1={padX} x2={w - padX} y1={yBase} y2={yBase} stroke="#e5e7eb" strokeWidth={1} />
        {/* Bars */}
        {days.map((_, i) => {
          let offset = 0;
          return series.map((s) => {
            const v = s.values[i] ?? 0;
            const barH = hFor(v);
            const rect = (
              <rect
                key={`${i}-${s.label}`}
                x={xFor(i)}
                y={yBase - offset - barH}
                width={barW}
                height={barH}
                fill={s.color}
              />
            );
            offset += barH;
            return rect;
          });
        })}
        {/* X-axis labels */}
        {days.map((label, i) =>
          i % labelStep === 0 ? (
            <text
              key={i}
              x={xFor(i) + barW / 2}
              y={h - 4}
              textAnchor="middle"
              fontSize={9}
              fill="#9ca3af"
            >
              {label}
            </text>
          ) : null
        )}
        {/* Hover guide */}
        {hoverIdx !== null && (
          <line
            x1={xFor(hoverIdx) + barW / 2}
            x2={xFor(hoverIdx) + barW / 2}
            y1={padY}
            y2={yBase}
            stroke="#d1d5db"
            strokeWidth={1}
          />
        )}
        {/* Hit zones — rendered last so they sit on top */}
        {days.map((_, i) => (
          <rect
            key={`hit-${i}`}
            x={xFor(i)}
            y={padY}
            width={barGap}
            height={innerH + 20}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            onTouchStart={(e) => { e.preventDefault(); setHoverIdx(i); }}
          />
        ))}
      </svg>
      {/* Tooltip */}
      {hoverIdx !== null && (
        <div
          className="bg-white border border-gray-200 rounded shadow-md px-3 py-2 text-xs z-10 pointer-events-none min-w-max"
          style={{
            position: "absolute",
            left: `${tooltipLeft}%`,
            top: "8px",
            transform: tooltipLeft > 50 ? "translateX(-100%)" : "translateX(0)",
          }}
        >
          <div className="font-medium mb-1">{days[hoverIdx]}</div>
          {series
            .filter((si) => si.values[hoverIdx] > 0)
            .map((si) => (
              <div key={si.label} className="flex items-center gap-1">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: si.color }}
                />
                {si.label}: {si.values[hoverIdx]}
              </div>
            ))}
          <div className="mt-1 font-medium">Total: {dayTotals[hoverIdx]}</div>
        </div>
      )}
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-600">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
