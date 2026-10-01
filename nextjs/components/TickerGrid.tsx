"use client"

import { useState } from "react"
import type { TickerSummary } from "@/lib/databricks"
import { bucketOf, type Bucket } from "@/lib/tickerMeta"
import { TickerCard } from "@/components/TickerCard"

type Sort = "ticker" | "score" | "articles"
type Filter = "all" | Bucket

const SORTS: Array<[Sort, string]> = [["ticker", "A–Z"], ["score", "Score"], ["articles", "Articles"]]
const FILTERS: Filter[] = ["all", "positive", "neutral", "negative"]

const scoreOf = (s: TickerSummary) => s.avg_compound_today ?? s.avg_compound_7d ?? s.avg_compound_30d

export function TickerGrid({
  summaries,
  trends,
}: {
  summaries: TickerSummary[]
  trends: Record<string, number[]>
}) {
  const [sort, setSort] = useState<Sort>("ticker")
  const [filter, setFilter] = useState<Filter>("all")

  const count = (f: Filter) =>
    f === "all" ? summaries.length : summaries.filter((s) => {
      const v = scoreOf(s)
      return v != null && bucketOf(v) === f
    }).length

  const shown = summaries
    .filter((s) => {
      if (filter === "all") return true
      const v = scoreOf(s)
      return v != null && bucketOf(v) === filter
    })
    .sort((a, b) =>
      sort === "score"    ? (scoreOf(b) ?? -2) - (scoreOf(a) ?? -2)
      : sort === "articles" ? (b.article_count_today ?? 0) - (a.article_count_today ?? 0)
      : a.ticker.localeCompare(b.ticker)
    )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Filter"
          options={FILTERS.map((f) => [f, `${f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)} ${count(f)}`])}
          value={filter}
          onChange={setFilter}
        />
        <Segmented label="Sort" options={SORTS} value={sort} onChange={setSort} />
      </div>

      {shown.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((s) => (
            <TickerCard key={s.ticker} summary={s} trend={trends[s.ticker] ?? []} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No {filter} tickers right now.</p>
      )}
    </div>
  )
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<[T, string]>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div role="group" aria-label={label}
      className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 text-xs">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={`rounded-md px-2.5 py-1 transition-colors ${
            v === value
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
