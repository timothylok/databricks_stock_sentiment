import Link from "next/link"
import type { TickerSummary } from "@/lib/d1"
import { TICKER_META, moodLabel } from "@/lib/tickerMeta"
import { TickerLogo } from "@/components/TickerLogo"
import { Sparkline } from "@/components/Sparkline"
import { SentimentBar } from "@/components/SentimentBar"

export function TickerCard({ summary: s, trend }: { summary: TickerSummary; trend: number[] }) {
  const hasToday = s.avg_compound_today != null
  const score = s.avg_compound_today ?? s.avg_compound_7d ?? s.avg_compound_30d
  const fallbackLabel = s.avg_compound_7d != null ? "7d avg" : "30d avg"

  return (
    <Link
      href={`/ticker/${s.ticker}`}
      className="group block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-5
                 hover:border-zinc-400 dark:hover:border-zinc-600 hover:-translate-y-0.5 hover:shadow-md
                 dark:hover:shadow-black/40 transition duration-150"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <TickerLogo ticker={s.ticker} />
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight">{s.ticker}</p>
            <p className="text-xs text-zinc-500 truncate">{TICKER_META[s.ticker]?.name}</p>
          </div>
        </div>
        <ScoreBadge value={score} />
      </div>

      <div className="flex items-end justify-between gap-3 mb-1">
        <div className={`text-3xl font-bold font-mono ${scoreColor(score)}`}>
          {fmt(score)}
        </div>
        <Sparkline values={trend} className={`mb-1 ${scoreColor(score)}`} />
      </div>
      <p className="text-xs text-zinc-500 mb-3">
        {hasToday
          ? `today · ${s.article_count_today ?? 0} articles`
          : `no headlines today · showing ${fallbackLabel}`}
      </p>

      <SentimentBar value={score} />

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

const BADGE_CLS: Record<string, string> = {
  "Positive":         "border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400",
  "Negative":         "border-red-300 dark:border-red-900 text-red-600 dark:text-red-400",
  "Leaning positive": "border-zinc-300 dark:border-zinc-700 text-emerald-700 dark:text-emerald-500",
  "Leaning negative": "border-zinc-300 dark:border-zinc-700 text-red-700 dark:text-red-500",
  "Neutral":          "border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400",
}

function ScoreBadge({ value }: { value: number | null }) {
  const label = value == null ? "No data" : moodLabel(value)
  const cls = BADGE_CLS[label] ?? BADGE_CLS.Neutral

  return (
    <span className={`shrink-0 whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  )
}

function fmt(v: number | null): string {
  if (v == null) return "—"
  return `${v >= 0 ? "+" : ""}${v.toFixed(3)}`
}

function scoreColor(v: number | null): string {
  if (v == null)  return "text-zinc-500 dark:text-zinc-400"
  if (v >= 0.2)   return "text-emerald-600 dark:text-emerald-400"
  if (v <= -0.2)  return "text-red-600 dark:text-red-400"
  return "text-zinc-700 dark:text-zinc-300"
}
