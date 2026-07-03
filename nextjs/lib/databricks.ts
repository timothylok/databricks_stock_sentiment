import { unstable_cache } from "next/cache"

const HOST         = process.env.DATABRICKS_HOST!
const TOKEN        = process.env.DATABRICKS_TOKEN!
// warehouse_id lives in the last segment of the HTTP path: /sql/1.0/warehouses/<id>
const WAREHOUSE_ID =
  process.env.DATABRICKS_WAREHOUSE_ID ??
  process.env.DATABRICKS_SQL_HTTP_PATH?.split("/").at(-1)

const VALID_TICKERS = new Set([
  "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
  "META", "NVDA", "AMD",  "NFLX", "SPY",
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

interface StmtResponse {
  status:    { state: string; error?: { message: string } }
  manifest?: { schema: { columns: Array<{ name: string }> } }
  result?:   { schema: { columns: Array<{ name: string }> }; data_array?: string[][] }
}

async function runQuery<T>(sql: string): Promise<T[]> {
  const res = await fetch(`${HOST}/api/2.0/sql/statements`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      warehouse_id: WAREHOUSE_ID,
      statement:    sql,
      wait_timeout: "30s",
      disposition:  "INLINE",
      format:       "JSON_ARRAY",
    }),
  })

  if (!res.ok) throw new Error(`Databricks: HTTP ${res.status}`)

  const data: StmtResponse = await res.json()

  if (data.status.state === "FAILED") {
    throw new Error(data.status.error?.message ?? "Query failed")
  }

  const columns = (data.manifest ?? data.result)?.schema.columns ?? []
  const rows    = data.result?.data_array ?? []

  return rows.map(
    (row) =>
      Object.fromEntries(
        columns.map((col, i) => [col.name, coerce(row[i])])
      ) as T
  )
}

// Databricks returns all values as strings; cast numerics back to numbers.
function coerce(v: string | null): string | number | null {
  if (v === null || v === "") return null
  const n = Number(v)
  return Number.isNaN(n) ? v : n
}

function assertTicker(ticker: string): void {
  if (!VALID_TICKERS.has(ticker)) throw new Error(`Unknown ticker: ${ticker}`)
}

// ─── Cached query functions ────────────────────────────────────────────────────
// unstable_cache wraps the async fn with Next.js server-side caching so ISR
// works correctly even though Databricks queries use POST (not cacheable by fetch).

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
        CAST(last_updated AS STRING) AS last_updated
      FROM stock_sentiment.ticker_summary
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
          CAST(date AS STRING) AS date,
          avg_compound,
          article_count,
          positive_count,
          negative_count,
          neutral_count
        FROM stock_sentiment.sentiment_daily
        WHERE ticker = '${ticker}'
          AND date >= date_sub(current_date(), ${safeDays})
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
          CAST(published_at AS STRING) AS published_at,
          compound
        FROM stock_sentiment.sentiment_scores
        WHERE ticker = '${ticker}'
        ORDER BY published_at DESC
        LIMIT ${safeLimit}
      `),
    [`headlines-${ticker}-${safeLimit}`],
    { revalidate: 86400, tags: ["sentiment", `ticker-${ticker}`] }
  )()
}
