# TODO

Outstanding items for next session.

---

## Verify new tickers appear in dashboard
`ingest_news.py` had a stale ticker list — it still tagged NFLX and never tagged XLE/RKLB/SPCX, out of sync with `clean_news.py`. Fixed 2026-07-04 by centralizing both into `databricks/_tickers.py` (via `%run`). Confirmed working via manual job runs the same day (`ingest_news`/`clean_news`/`sentiment` all `SUCCESS`), but as of 2026-07-04 no headlines had mentioned XLE, RKLB, or SPCX at all — still no cards for them. Needs a few more days of runs before their absence means anything.

## Investigate reddit/finviz returning 0 articles
Still open as of 2026-07-04. `news_raw` only ever gets rows from `marketwatch`/`yahoo_finance` — reddit and finviz contribute nothing across multiple manual runs today. Check job run logs for `WARNING: reddit failed` / `WARNING: finviz failed`.

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
