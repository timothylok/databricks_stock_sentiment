import { getTickerSummaries } from "@/lib/databricks"
import { TickerCard } from "@/components/TickerCard"

export const revalidate = 86400

export default async function HomePage() {
  let summaries: Awaited<ReturnType<typeof getTickerSummaries>> = []
  try {
    summaries = await getTickerSummaries()
  } catch {
    // table not yet created — pipeline hasn't run
  }

  const scored = summaries.filter((s) => s.avg_compound_today != null)
  const overall =
    scored.length > 0
      ? scored.reduce((sum, s) => sum + s.avg_compound_today!, 0) / scored.length
      : null

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Stock Sentiment</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Daily sentiment from news &amp; social · refreshes 7am NZT
        </p>
      </div>

      <div className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">
          Market Mood
        </p>
        {overall != null ? (
          <div className="flex items-baseline gap-3">
            <span className={`text-4xl font-bold ${moodColor(overall)}`}>
              {moodLabel(overall)}
            </span>
            <span className={`text-xl font-mono ${moodColor(overall)}`}>
              {overall >= 0 ? "+" : ""}
              {overall.toFixed(4)}
            </span>
          </div>
        ) : (
          <p className="text-zinc-500">No data yet — run the pipeline first.</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaries.map((s) => (
          <TickerCard key={s.ticker} summary={s} />
        ))}
      </div>
    </div>
  )
}

function moodLabel(c: number) {
  if (c >= 0.05)  return "Positive"
  if (c <= -0.05) return "Negative"
  return "Neutral"
}

function moodColor(c: number) {
  if (c >= 0.05)  return "text-emerald-400"
  if (c <= -0.05) return "text-red-400"
  return "text-zinc-300"
}
