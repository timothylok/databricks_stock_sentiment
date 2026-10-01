// Display metadata per ticker. `logo` means /logos/<TICKER>.svg exists (white
// Simple Icons glyph, drawn on the brand color); otherwise the tile shows `mark`.
export interface TickerMeta {
  name:  string
  color: string
  logo?: boolean
  mark?: string
}

export const TICKER_META: Record<string, TickerMeta> = {
  AAPL:  { name: "Apple",                       color: "#000000", logo: true },
  MSFT:  { name: "Microsoft",                   color: "#00A4EF", logo: true },
  GOOGL: { name: "Alphabet",                    color: "#4285F4", logo: true },
  AMZN:  { name: "Amazon",                      color: "#FF9900", logo: true },
  TSLA:  { name: "Tesla",                       color: "#CC0000", logo: true },
  META:  { name: "Meta Platforms",              color: "#0467DF", logo: true },
  NVDA:  { name: "NVIDIA",                      color: "#76B900", logo: true },
  AMD:   { name: "AMD",                         color: "#ED1C24", mark: "AMD" },
  NET:   { name: "Cloudflare",                  color: "#F38020", logo: true },
  SPCX:  { name: "SpaceX",                      color: "#000000", logo: true },
  RKLB:  { name: "Rocket Lab",                  color: "#1F2937", mark: "RL" },
  SPY:   { name: "SPDR S&P 500 ETF",            color: "#003B71", mark: "SPY" },
  XLE:   { name: "Energy Select Sector SPDR",   color: "#C2410C", mark: "XLE" },
  TSM:   { name: "TSMC",                        color: "#C4161C", mark: "TSM" },
  AVGO:  { name: "Broadcom",                    color: "#E31837", logo: true },
  ASTS:  { name: "AST SpaceMobile",             color: "#0B1F3A", mark: "AST" },
  QQQ:   { name: "Invesco QQQ (Nasdaq-100)",    color: "#1E3A8A", mark: "QQQ" },
  JPM:   { name: "JPMorgan Chase",              color: "#117ACA", logo: true },
}

export type Bucket = "positive" | "neutral" | "negative"

// Same ±0.2 cut-offs as sentiment.py
export function bucketOf(v: number): Bucket {
  return v >= 0.2 ? "positive" : v <= -0.2 ? "negative" : "neutral"
}
