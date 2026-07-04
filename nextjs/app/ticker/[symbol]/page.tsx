import Link from "next/link"
import { notFound } from "next/navigation"
import { getTickerSummaries, getTickerTrend, getRecentHeadlines } from "@/lib/databricks"
import { SentimentChart } from "@/components/SentimentChart"
import { HeadlineList } from "@/components/HeadlineList"

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
        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-8 inline-block"
      >
        ← All tickers
      </Link>

      <div className="mb-8">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-1">
          Ticker
        </p>
        <h1 className="text-4xl font-bold">{symbol}</h1>
        <div className={`text-5xl font-bold font-mono mt-2 ${scoreColor(score)}`}>
          {fmt(score)}
        </div>
        <p className="text-zinc-500 text-sm mt-1">
          {hasToday
            ? `today · ${summary.article_count_today ?? 0} articles`
            : `no headlines today · showing ${fallbackLabel}`}
        </p>

        <div className="flex gap-6 mt-4 text-sm">
          <Stat label="7d avg"  value={summary.avg_compound_7d} />
          <Stat label="30d avg" value={summary.avg_compound_30d} />
        </div>
      </div>

      <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-5">
          30-Day Trend
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

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-4">
          Recent Headlines
        </h2>
        <HeadlineList headlines={headlines} />
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-zinc-500 text-xs mb-0.5">{label}</p>
      <p className={`font-mono font-medium ${scoreColor(value)}`}>{fmt(value)}</p>
    </div>
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
      ? "border-emerald-900 text-emerald-500"
      : "border-red-900 text-red-500"

  return (
    <div className={`rounded-xl border bg-zinc-900 p-5 ${cls}`}>
      <p className="text-xs font-medium uppercase tracking-widest mb-2">{label}</p>
      <p className="text-sm text-zinc-200 leading-snug">{text}</p>
    </div>
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
