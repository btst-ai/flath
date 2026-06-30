"use client";

interface Slice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: Slice[];
  ariaLabel?: string;
}

export function PieChart({ slices, ariaLabel = "Pie chart" }: Props) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 80;

  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return null;

  const paths: { d: string; color: string; label: string; value: number }[] = [];
  let startAngle = -Math.PI / 2; // start at top

  for (const sl of slices) {
    if (sl.value === 0) continue;
    const angle = (sl.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;

    // Handle full circle (single slice)
    if (slices.filter((s) => s.value > 0).length === 1) {
      paths.push({
        d: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`,
        color: sl.color,
        label: sl.label,
        value: sl.value,
      });
    } else {
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      paths.push({
        d: `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
        color: sl.color,
        label: sl.label,
        value: sl.value,
      });
    }
    startAngle = endAngle;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-40 h-40 shrink-0"
        role="img"
        aria-label={ariaLabel}
      >
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} stroke="white" strokeWidth={1.5} />
        ))}
      </svg>
      <ul className="text-xs text-gray-700 space-y-1 min-w-0">
        {slices
          .filter((s) => s.value > 0)
          .map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate">
                {s.label} ({Math.round((s.value / total) * 100)}%)
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
