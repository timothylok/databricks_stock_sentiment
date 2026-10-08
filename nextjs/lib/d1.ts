import { unstable_cache } from "next/cache"

const ACCOUNT_ID  = process.env.CLOUDFLARE_ACCOUNT_ID
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID
const API_TOKEN   = process.env.CLOUDFLARE_API_TOKEN

export const VALID_TICKERS = new Set([
  "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
  "META", "NVDA", "AMD",  "SPY",
  "XLE",  "RKLB", "SPCX",
  "NET",  "TSM",  "AVGO",
  "ASTS", "QQQ",  "JPM",
])

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TickerSummary {
  ticker:               string
  avg_compound_today:   number | null
  avg_compound_7d:      number | null
  avg_compound_30d:     number | null
  article_count_today:  number
  top_positive_title:   string | null
  top_negative_title:   string | null
  last_updated:         string
}

export interface DailyPoint {
  date:           string
  avg_compound:   number
  article_count:  number
  positive_count: number
  negative_count: number
  neutral_count:  number
}

export interface Headline {
  article_id:   string
  source:       string
  title:        string
  published_at: string
  compound:     number
}

// ─── Core client ──────────────────────────────────────────────────────────────

interface D1Response {
  success: boolean
  errors:  Array<{ message: string }>
  result:  Array<{ results: unknown[] }>
}

async function runQuery<T>(sql: string): Promise<T[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
      cache: "no-store",
    }
  )

  if (!res.ok) throw new Error(`D1: HTTP ${res.status}`)

  const data: D1Response = await res.json()
  if (!data.success) throw new Error(data.errors[0]?.message ?? "D1 query failed")

  return data.result[0].results as T[]
}

function assertTicker(ticker: string): void {
  if (!VALID_TICKERS.has(ticker)) throw new Error(`Unknown ticker: ${ticker}`)
}

// ─── Cached query functions ────────────────────────────────────────────────────
// unstable_cache wraps the async fn with Next.js server-side caching so ISR
// works correctly even though D1 queries use POST (not cacheable by fetch).

export const getTickerSummaries = unstable_cache(
  async (): Promise<TickerSummary[]> =>
    runQuery<TickerSummary>(`
      SELECT
        ticker,
        avg_compound_today,
        avg_compound_7d,
        avg_compound_30d,
        article_count_today,
        top_positive_title,
        top_negative_title,
        last_updated
      FROM ticker_summary
      ORDER BY ticker
    `),
  ["ticker-summaries"],
  { revalidate: 86400, tags: ["sentiment"] }
)

export const getTickerTrend = (ticker: string, days = 30): Promise<DailyPoint[]> => {
  assertTicker(ticker)
  const safeDays = Math.min(Math.max(Math.floor(days), 1), 90)
  return unstable_cache(
    () =>
      runQuery<DailyPoint>(`
        SELECT
          date,
          avg_compound,
          article_count,
          positive_count,
          negative_count,
          neutral_count
        FROM sentiment_daily
        WHERE ticker = '${ticker}'
          AND date >= date('now', '-${safeDays} day')
        ORDER BY date ASC
      `),
    [`ticker-trend-${ticker}-${safeDays}d`],
    { revalidate: 86400, tags: ["sentiment", `ticker-${ticker}`] }
  )()
}

export const getRecentHeadlines = (ticker: string, limit = 20): Promise<Headline[]> => {
  assertTicker(ticker)
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100)
  return unstable_cache(
    () =>
      runQuery<Headline>(`
        SELECT
          article_id,
          source,
          title,
          published_at,
          compound
        FROM sentiment_scores
        WHERE ticker = '${ticker}'
        ORDER BY published_at DESC
        LIMIT ${safeLimit}
      `),
    [`headlines-${ticker}-${safeLimit}`],
    { revalidate: 86400, tags: ["sentiment", `ticker-${ticker}`] }
  )()
}

// Last 7 days for every ticker in one query, for the home-page sparklines.
export const getRecentTrends = unstable_cache(
  async (): Promise<Array<{ ticker: string; date: string; avg_compound: number }>> =>
    runQuery(`
      SELECT
        ticker,
        date,
        avg_compound
      FROM sentiment_daily
      WHERE date >= date('now', '-7 day')
      ORDER BY ticker, date
    `),
  ["recent-trends"],
  { revalidate: 86400, tags: ["sentiment"] }
)
