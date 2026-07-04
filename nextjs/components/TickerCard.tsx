import Link from "next/link"
import type { TickerSummary } from "@/lib/databricks"

export function TickerCard({ summary: s }: { summary: TickerSummary }) {
  const hasToday = s.avg_compound_today != null
  const score = s.avg_compound_today ?? s.avg_compound_7d ?? s.avg_compound_30d
  const fallbackLabel = s.avg_compound_7d != null ? "7d avg" : "30d avg"

  return (
    <Link
      href={`/ticker/${s.ticker}`}
      className="block rounded-xl border border-zinc-800 bg-zinc-900 p-5
                 hover:border-zinc-600 transition-colors duration-150"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xl font-bold">{s.ticker}</span>
        <ScoreBadge value={score} />
      </div>

      <div className={`text-3xl font-bold font-mono mb-1 ${scoreColor(score)}`}>
        {fmt(score)}
      </div>
      <p className="text-xs text-zinc-500">
        {hasToday
          ? `today · ${s.article_count_today ?? 0} articles`
          : `no headlines today · showing ${fallbackLabel}`}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Stat label="7d avg"  value={s.avg_compound_7d} />
        <Stat label="30d avg" value={s.avg_compound_30d} />
      </div>
    </Link>
  )
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-zinc-500 mb-0.5">{label}</p>
      <p className={`font-medium font-mono ${scoreColor(value)}`}>{fmt(value)}</p>
    </div>
  )
}

function ScoreBadge({ value }: { value: number | null }) {
  const { label, cls } =
    value == null        ? { label: "No data",  cls: "border-zinc-700 text-zinc-400" }
    : value >= 0.05      ? { label: "Positive",  cls: "border-emerald-800 text-emerald-400" }
    : value <= -0.05     ? { label: "Negative",  cls: "border-red-900 text-red-400" }
    :                      { label: "Neutral",   cls: "border-zinc-700 text-zinc-400" }

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  )
}

function fmt(v: number | null): string {
  if (v == null) return "—"
  return `${v >= 0 ? "+" : ""}${v.toFixed(3)}`
}

function scoreColor(v: number | null): string {
  if (v == null)  return "text-zinc-400"
  if (v >= 0.05)  return "text-emerald-400"
  if (v <= -0.05) return "text-red-400"
  return "text-zinc-300"
}
