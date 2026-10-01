// Inline SVG trend line; colored by the caller via currentColor.
export function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  if (values.length < 2) return null

  const W = 96, H = 32, PAD = 3
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const span = Math.max(max - min, 0.2)
  const mid = (max + min) / 2
  const y = (v: number) => H / 2 - ((v - mid) / span) * (H - PAD * 2)
  const x = (i: number) => PAD + (i / (values.length - 1)) * (W - PAD * 2)
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={className} aria-hidden>
      <line
        x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)}
        className="stroke-zinc-300 dark:stroke-zinc-700" strokeDasharray="2 3"
      />
      <polyline
        points={points} fill="none" stroke="currentColor"
        strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round"
      />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.25} fill="currentColor" />
    </svg>
  )
}
