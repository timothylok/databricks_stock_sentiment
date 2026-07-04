# TODO

Outstanding items for next session.

---

## Verify new tickers appear in dashboard
`ingest_news.py` had a stale ticker list — it still tagged NFLX and never tagged XLE/RKLB/SPCX, out of sync with `clean_news.py`. Fixed 2026-07-04 by centralizing both into `databricks/_tickers.py` (via `%run`). After the next pipeline run (Databricks repo must be re-pulled to latest first), check:
1. `stock_sentiment.news_raw`/`news_clean` start tagging `XLE`/`RKLB`/`SPCX` when headlines mention them
2. Cards for XLE, RKLB, SPCX show up on the dashboard once they have scored articles

As of 2026-07-04 no headlines had mentioned any of the three yet, so absence alone isn't conclusive — needs a few days of runs to judge.

## Investigate reddit/finviz returning 0 articles
As of 2026-07-04, `news_raw` only has rows from `marketwatch` (10) and `yahoo_finance` (86) — 96 total, none from reddit or finviz. Check job run logs for `WARNING: reddit failed` / `WARNING: finviz failed` on the next run.

## NFLX data cleanup (optional)
NFLX was removed from the ticker list; ingestion no longer tags new NFLX mentions (fixed 2026-07-04, see above — this was previously an active bug, not just legacy data). Remaining old rows in `stock_sentiment.sentiment_scores` will age out of the 30-day window naturally (~2026-08). To remove immediately:
1. `DELETE FROM stock_sentiment.sentiment_scores WHERE ticker = 'NFLX'` via Databricks SQL
2. `DROP TABLE IF EXISTS stock_sentiment.sentiment_daily` (force schema rebuild)
3. Trigger Steps 2 & 3 of `sentiment.py` manually (or re-run the full job)
4. Hit `POST /api/refresh/complete` to bust the ISR cache

## Databricks failure email notification (manual step pending)
Add an email address for "on failure" in Databricks Jobs UI → job → Edit → Notifications. Vercel-side failures (trigger/complete routes) already alert to Discord; cron-job.org's own failure notification was skipped per user request — this Databricks step is the only leg not yet wired up.

## Roadmap (from README)
- Add LLM sentiment scoring (FinBERT or GPT-4o mini)
- Add Twitter/X ingestion
- Replace cron-job.org with Databricks Workflows for end-to-end orchestration
- Add anomaly detection for sentiment spikes
