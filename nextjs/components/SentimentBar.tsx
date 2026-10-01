// Diverging bar: fills from the centre toward -1 (left) or +1 (right).
export function SentimentBar({ value }: { value: number | null }) {
  const v = Math.max(-1, Math.min(1, value ?? 0))
  const fill =
    v >= 0.2 ? "bg-emerald-500" : v <= -0.2 ? "bg-red-500" : "bg-zinc-400 dark:bg-zinc-500"

  return (
    <div className="relative h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
      <div className="absolute left-1/2 top-[-2px] h-[10px] w-px bg-zinc-400 dark:bg-zinc-600" />
      {value != null && (
        <div
          className={`absolute top-0 h-full rounded-full ${fill}`}
          style={v >= 0
            ? { left: "50%", width: `${v * 50}%` }
            : { right: "50%", width: `${-v * 50}%` }}
        />
      )}
    </div>
  )
}
