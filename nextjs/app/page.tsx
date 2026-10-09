import Link from "next/link"
import { getTickerSummaries, getRecentTrends, type TickerSummary } from "@/lib/d1"
import { TickerGrid } from "@/components/TickerGrid"
import { TickerLogo } from "@/components/TickerLogo"
import { bucketOf, moodLabel } from "@/lib/tickerMeta"
import { sendAlert } from "@/lib/alert"

export const revalidate = 86400

export default async function HomePage() {
  // Sparklines are optional: a failed trend query just hides them
  const trendRows = getRecentTrends().catch(async (err) => {
    console.error("[home] getRecentTrends failed:", err)
    await sendAlert(`⚠️ **dashboard**: sparkline query failed, sparklines hidden
${err}`)
    return []
  })

  let summaries: Awaited<ReturnType<typeof getTickerSummaries>>
  try {
    summaries = await getTickerSummaries()
  } catch (err) {
    // Rethrow so ISR keeps serving the last good page instead of caching an empty one
    console.error("[home] getTickerSummaries failed:", err)
    await sendAlert(`🚨 **dashboard**: D1 query failed — keeping the previous page\n${err}`)
    throw err
  }

  const trends: Record<string, number[]> = {}
  for (const r of await trendRows) (trends[r.ticker] ??= []).push(r.avg_compound)

  const lastUpdated = summaries[0]?.last_updated ?? null

  const withScore = summaries
    .map((s) => ({ s, v: s.avg_compound_today ?? s.avg_compound_7d ?? s.avg_compound_30d }))
    .filter((x): x is { s: TickerSummary; v: number } => x.v != null)
    .sort((a, b) => b.v - a.v)
  const counts = { positive: 0, neutral: 0, negative: 0 }
  for (const { v } of withScore) counts[bucketOf(v)]++
  const bullish = withScore[0]
  const bearish = withScore.length > 1 ? withScore[withScore.length - 1] : undefined

  const scored = summaries.filter((s) => s.avg_compound_today != null)
  const overall =
    scored.length > 0
      ? scored.reduce((sum, s) => sum + s.avg_compound_today!, 0) / scored.length
      : null

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Stock Sentiment</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
          Daily sentiment from news &amp; social · refreshes 7am NZT
        </p>
        {lastUpdated && (
          <p className="text-zinc-500 mt-1 text-xs">
            Data last updated {formatNzt(lastUpdated)}
          </p>
        )}
      </div>

      <div className="mb-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">
          Market Mood
        </p>
        {overall != null ? (
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-baseline gap-3">
                <span className={`text-4xl font-bold ${moodColor(overall)}`}>
                  {moodLabel(overall)}
                </span>
                <span className={`text-xl font-mono ${moodColor(overall)}`}>
                  {overall >= 0 ? "+" : ""}
                  {overall.toFixed(4)}
                </span>
              </div>
              <div className="mt-3 flex gap-4 text-xs">
                <Count n={counts.positive} label="positive" dot="bg-emerald-500" />
                <Count n={counts.neutral}  label="neutral"  dot="bg-zinc-400" />
                <Count n={counts.negative} label="negative" dot="bg-red-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:w-80">
              {/* Only call it bullish/bearish when it clears the ±0.2 cut-off the counts use */}
              {bullish && (
                <Mover
                  title={bucketOf(bullish.v) === "positive" ? "Most bullish" : "Highest score"}
                  ticker={bullish.s.ticker}
                  value={bullish.v}
                />
              )}
              {bearish && (
                <Mover
                  title={bucketOf(bearish.v) === "negative" ? "Most bearish" : "Lowest score"}
                  ticker={bearish.s.ticker}
                  value={bearish.v}
                />
              )}
            </div>
          </div>
        ) : (
          <p className="text-zinc-500">No data yet — run the pipeline first.</p>
        )}
      </div>

      {summaries.length > 0 && <TickerGrid summaries={summaries} trends={trends} />}
    </div>
  )
}

// D1 timestamps are UTC strings, usually without a zone suffix.
function formatNzt(ts: string) {
  const iso = ts.includes("T") ? ts : ts.replace(" ", "T")
  const date = new Date(iso.endsWith("Z") ? iso : iso + "Z")
  if (Number.isNaN(date.getTime())) return ts
  return (
    new Intl.DateTimeFormat("en-NZ", {
      timeZone: "Pacific/Auckland",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date) + " NZT"
  )
}

function Count({ n, label, dot }: { n: number; label: string; dot: string }) {
  return (
    <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{n}</span> {label}
    </span>
  )
}

function Mover({ title, ticker, value }: { title: string; ticker: string; value: number }) {
  return (
    <Link
      href={`/ticker/${ticker}`}
      className="flex items-center gap-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800
                 bg-white dark:bg-zinc-950 p-2.5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
    >
      <TickerLogo ticker={ticker} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500">{title}</p>
        <p className="text-sm font-semibold">
          {ticker}{" "}
          <span className={`font-mono text-xs ${moodColor(value)}`}>
            {value >= 0 ? "+" : ""}{value.toFixed(3)}
          </span>
        </p>
      </div>
    </Link>
  )
}

function moodColor(c: number) {
  if (c >= 0.2)   return "text-emerald-600 dark:text-emerald-400"
  if (c <= -0.2)  return "text-red-600 dark:text-red-400"
  return "text-zinc-700 dark:text-zinc-300"
}
