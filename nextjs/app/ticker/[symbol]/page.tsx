import Link from "next/link"
import { notFound } from "next/navigation"
import { getTickerSummaries, getTickerTrend, getRecentHeadlines } from "@/lib/databricks"
import { SentimentChart } from "@/components/SentimentChart"
import { HeadlineList } from "@/components/HeadlineList"
import { TickerLogo } from "@/components/TickerLogo"
import { SentimentBar } from "@/components/SentimentBar"
import { TICKER_META } from "@/lib/tickerMeta"

export const revalidate = 86400

export async function generateStaticParams() {
  try {
    const summaries = await getTickerSummaries()
    return summaries.map((s) => ({ symbol: s.ticker }))
  } catch {
    return []
  }
}

export default async function TickerPage({
  params,
}: {
  params: Promise<{ symbol: string }>
}) {
  const { symbol: raw } = await params
  const symbol = raw.toUpperCase()

  let summaries, trend, headlines
  try {
    ;[summaries, trend, headlines] = await Promise.all([
      getTickerSummaries(),
      getTickerTrend(symbol, 30),
      getRecentHeadlines(symbol, 20),
    ])
  } catch {
    notFound()
  }

  const summary = summaries.find((s) => s.ticker === symbol)
  if (!summary) notFound()

  const hasToday = summary.avg_compound_today != null
  const score = summary.avg_compound_today ?? summary.avg_compound_7d ?? summary.avg_compound_30d
  const fallbackLabel = summary.avg_compound_7d != null ? "7d avg" : "30d avg"

  return (
    <div>
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors mb-8 inline-block"
      >
        ← All tickers
      </Link>

      <div className="mb-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <TickerLogo ticker={symbol} size="lg" />
            <div>
              <h1 className="text-4xl font-bold leading-none">{symbol}</h1>
              <p className="text-zinc-500 text-sm mt-1.5">{TICKER_META[symbol]?.name}</p>
            </div>
          </div>
          <div className="sm:text-right">
            <div className={`text-5xl font-bold font-mono ${scoreColor(score)}`}>
              {fmt(score)}
            </div>
            <p className="text-zinc-500 text-sm mt-1">
              {hasToday
                ? `today · ${summary.article_count_today ?? 0} articles`
                : `no headlines today · showing ${fallbackLabel}`}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <SentimentBar value={score} />
          <div className="mt-1 flex justify-between text-[10px] text-zinc-400 dark:text-zinc-600 font-mono">
            <span>−1</span><span>0</span><span>+1</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4 text-sm">
          <Pill label="Today"   value={summary.avg_compound_today} />
          <Pill label="7d avg"  value={summary.avg_compound_7d} />
          <Pill label="30d avg" value={summary.avg_compound_30d} />
        </div>
      </div>

      <section className="mb-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-5">
          30-Day Trend
          <span className="ml-2 normal-case tracking-normal text-zinc-400 dark:text-zinc-600">· UTC dates</span>
          {trend.length < 30 && (
            <span className="ml-2 normal-case tracking-normal text-zinc-400 dark:text-zinc-600">
              · {trend.length} of 30 days have data
            </span>
          )}
        </h2>
        <SentimentChart data={trend} />
      </section>

      {(summary.top_positive_title || summary.top_negative_title) && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {summary.top_positive_title && (
            <Highlight
              label="Top Positive (7d)"
              text={summary.top_positive_title}
              variant="positive"
            />
          )}
          {summary.top_negative_title && (
            <Highlight
              label="Top Negative (7d)"
              text={summary.top_negative_title}
              variant="negative"
            />
          )}
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-4">
          Recent Headlines
        </h2>
        <HeadlineList headlines={headlines} />
      </section>
    </div>
  )
}

function Pill({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800
                     bg-white dark:bg-zinc-950 px-3 py-1">
      <span className="text-zinc-500 text-xs">{label}</span>
      <span className={`font-mono font-medium ${scoreColor(value)}`}>{fmt(value)}</span>
    </span>
  )
}

function Highlight({
  label,
  text,
  variant,
}: {
  label: string
  text: string
  variant: "positive" | "negative"
}) {
  const cls =
    variant === "positive"
      ? "border-emerald-300 dark:border-emerald-900 text-emerald-700 dark:text-emerald-500"
      : "border-red-300 dark:border-red-900 text-red-700 dark:text-red-500"

  return (
    <div className={`rounded-xl border bg-zinc-50 dark:bg-zinc-900 p-5 ${cls}`}>
      <p className="text-xs font-medium uppercase tracking-widest mb-2">{label}</p>
      <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-snug">{text}</p>
    </div>
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
