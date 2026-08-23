interface Props {
  data: number[];
  color?: string;
  className?: string;
}

/** Minimal axis-free SVG line showing the trend shape of a numeric series. */
export function Sparkline({ data, color = "#60a5fa", className }: Props) {
  const points = downsample(data, 14);
  if (points.length < 2) return null;

  const w = 96;
  const h = 28;
  const pad = 3;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);

  const coords = points.map((v, i) => ({
    x: pad + i * step,
    y: h - pad - ((v - min) / range) * (h - pad * 2),
  }));
  const path = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      <polyline
        points={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={2} fill={color} />
    </svg>
  );
}

/** Chunk-average a series down to at most `target` points. */
function downsample(data: number[], target: number): number[] {
  if (data.length <= target) return data;
  const out: number[] = [];
  const chunkSize = data.length / target;
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * chunkSize);
    const end = Math.min(Math.max(start + 1, Math.floor((i + 1) * chunkSize)), data.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += data[j];
    out.push(sum / (end - start));
  }
  return out;
}
