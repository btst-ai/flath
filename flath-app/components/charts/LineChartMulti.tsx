"use client";

import { useState, useEffect, useRef } from "react";

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

  const barW = innerW / Math.max(1, n - 1);

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
        {/* Hover guide */}
        {hoverIdx !== null && (
          <>
            <line
              x1={xFor(hoverIdx)} x2={xFor(hoverIdx)}
              y1={padY} y2={padY + innerH}
              stroke="#d1d5db" strokeWidth={1}
            />
            {series.map((s) => (
              <circle
                key={s.label}
                cx={xFor(hoverIdx)}
                cy={yFor(s.values[hoverIdx])}
                r={3}
                fill={s.color}
              />
            ))}
          </>
        )}
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
        {/* Hit zones (transparent, per day index) — rendered last to sit on top */}
        {labels.map((_, i) => (
          <rect
            key={i}
            x={xFor(i) - barW / 2}
            y={padY}
            width={barW}
            height={innerH + 20}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            onTouchStart={(e) => { e.preventDefault(); setHoverIdx(i); }}
          />
        ))}
      </svg>
      {/* Tooltip overlay */}
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
          <div className="font-medium mb-1">{labels[hoverIdx]}</div>
          {series.map((s) => (
            <div key={s.label} className="flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span>{s.label}: {s.values[hoverIdx]}</span>
            </div>
          ))}
        </div>
      )}
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
