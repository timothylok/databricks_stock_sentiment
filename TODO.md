# TODO

Outstanding items for next session.

---

## Verify new tickers appear in dashboard
`ingest_news.py` had a stale ticker list — it still tagged NFLX and never tagged XLE/RKLB/SPCX, out of sync with `clean_news.py`. Fixed 2026-07-04 by centralizing both into `databricks/_tickers.py` (via `%run`). Confirmed working via manual job runs the same day (`ingest_news`/`clean_news`/`sentiment` all `SUCCESS`), but as of 2026-07-04 no headlines had mentioned XLE, RKLB, or SPCX at all — still no cards for them. Needs a few more days of runs before their absence means anything.

## ~~Investigate reddit/finviz returning 0 articles~~ — resolved 2026-07-04
Reddit's anonymous `.json` endpoint is blocked outright (403 regardless of User-Agent or `old.reddit.com` vs `www.reddit.com`) — dropped the source rather than add OAuth. FinViz's CSS selector was stale after a site redesign (`a.tab-link-news` → `a.nn-tab-link`); fixed and confirmed ~180 matching articles. Also added CNBC Markets/Tech RSS, Apple Newsroom RSS, and per-ticker Yahoo feeds after validating each against a second pasted source-list proposal (most of that list was inaccurate or required API keys — only these 4 checked out). Confirmed via a full validation run (`run_id 568775876979038`, all 3 tasks SUCCESS) — `ticker_summary` now has data for 10/12 tickers (AAPL, AMD, AMZN, GOOGL, META, MSFT, NVDA, RKLB, SPCX, TSLA); only SPY and XLE still have zero headline mentions.

## Manual job triggers don't auto-refresh the site — watch for this
Discovered 2026-07-04: after manually triggering a job run (outside the 7:00/7:30am NZT cron pair), the dashboard kept serving a stale ISR snapshot because nothing called `/api/refresh/complete` to invalidate the cache. Fix was a one-off manual `POST /api/refresh/complete`. If you trigger a job manually again to test something, remember to also manually hit `/api/refresh/complete` afterward (with `Authorization: Bearer <CRON_SECRET>`) or the site won't reflect it until the next scheduled run.

## ~~NFLX data cleanup~~ — done 2026-07-04
Fully removed: `sentiment_scores`/`sentiment_daily` cleaned, and the stale `NFLX` tag stripped from the underlying `news_clean` row via `array_except(tickers, array('NFLX'))` (the first DELETE-only attempt didn't stick — the article was still tagged in `news_clean`, so the next `sentiment.py` run just rescored and reinserted it). Verified 0 NFLX rows in `sentiment_scores`/`ticker_summary` after a clean rerun, and ISR cache busted.

## ingest_news.py crash on all-empty ticker batches — fixed 2026-07-04
`spark.createDataFrame(all_rows)` relied on type inference and crashed (`CANNOT_DETERMINE_TYPE`) whenever every fetched headline in a batch had zero literal ticker-symbol matches (common — `ingest_news.py` only matches bare symbols like `AAPL`, not company names). Only 2 of 96 historical rows ever had a match at ingest time, so this was a latent bug, not a regression. Fixed with an explicit `StructType` schema instead of inference. Confirmed via two full successful pipeline runs afterward.

## ~~Databricks failure email notification~~ — done 2026-07-04
`on_failure` email notification set to timlok@gmail.com in the job's Databricks settings (`email_notifications.on_failure`, verified via `jobs/get`). Combined with Vercel-side Discord alerts (trigger/complete routes) — cron-job.org's own failure notification was skipped per user request — all failure legs are now covered.

## Roadmap (from README)
- Add LLM sentiment scoring (FinBERT or GPT-4o mini)
- Add Twitter/X ingestion
- Replace cron-job.org with Databricks Workflows for end-to-end orchestration
- Add anomaly detection for sentiment spikes
