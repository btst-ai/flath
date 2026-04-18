"use client";

import type { FinalizedRound } from "./duelTypes";

interface Props {
  history: FinalizedRound[];
  totalCards: number;
  p1Name: string;
  p2Name: string;
  /** "hud" = compact inline chart, "full" = large victory-screen chart. */
  size?: "hud" | "full";
}

/**
 * Cumulative-score evolution chart. Pure SVG, no external chart library.
 */
export function EvolutionChart({ history, totalCards, p1Name, p2Name, size = "hud" }: Props) {
  const w = size === "full" ? 640 : 240;
  const h = size === "full" ? 240 : 100;
  const padX = size === "full" ? 40 : 20;
  const padY = size === "full" ? 24 : 12;

  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  // Always include the starting point (0,0).
  const points = [
    { x: 0, p1: 0, p2: 0 },
    ...history.map(r => ({ x: r.cardIndex + 1, p1: r.p1CumScore, p2: r.p2CumScore })),
  ];

  const maxCards = Math.max(totalCards, 1);

  const allScores = points.flatMap(p => [p.p1, p.p2]);
  const rawMin = Math.min(0, ...allScores);
  const rawMax = Math.max(10, ...allScores);  // at least 10 range so small games aren't flat
  const range = rawMax - rawMin || 1;

  const xFor = (i: number) => padX + (i / maxCards) * innerW;
  const yFor = (v: number) => padY + innerH - ((v - rawMin) / range) * innerH;

  const path = (key: "p1" | "p2") =>
    points
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${xFor(p.x).toFixed(1)} ${yFor(p[key]).toFixed(1)}`)
      .join(" ");

  // Zero line for reference.
  const zeroY = yFor(0);

  return (
    <div className={size === "full" ? "w-full" : "w-full max-w-xs"}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        role="img"
        aria-label="Score evolution chart"
      >
        {/* Background */}
        <rect x={0} y={0} width={w} height={h} fill="white" stroke="#e5e7eb" rx={8} />
        {/* Zero reference line */}
        <line x1={padX} x2={w - padX} y1={zeroY} y2={zeroY} stroke="#d1d5db" strokeDasharray="3 3" />

        {/* P1 line — blue */}
        <path d={path("p1")} fill="none" stroke="#2563eb" strokeWidth={size === "full" ? 2.5 : 1.8} strokeLinejoin="round" />
        {/* P2 line — purple */}
        <path d={path("p2")} fill="none" stroke="#9333ea" strokeWidth={size === "full" ? 2.5 : 1.8} strokeLinejoin="round" />

        {/* Axis labels */}
        {size === "full" && (
          <>
            <text x={padX} y={h - 4} fontSize={10} fill="#6b7280">Card 0</text>
            <text x={w - padX} y={h - 4} textAnchor="end" fontSize={10} fill="#6b7280">{totalCards}</text>
            <text x={4} y={padY + 8} fontSize={10} fill="#6b7280">{rawMax.toFixed(0)}</text>
            <text x={4} y={h - padY} fontSize={10} fill="#6b7280">{rawMin.toFixed(0)}</text>
          </>
        )}
      </svg>
      <div className={`mt-1 flex items-center justify-between ${size === "full" ? "text-sm" : "text-xs"}`}>
        <span className="flex items-center gap-1 text-blue-600 font-medium">
          <span className="inline-block w-3 h-[2px] bg-blue-600" /> {p1Name}
        </span>
        <span className="flex items-center gap-1 text-purple-600 font-medium">
          <span className="inline-block w-3 h-[2px] bg-purple-600" /> {p2Name}
        </span>
      </div>
    </div>
  );
}
