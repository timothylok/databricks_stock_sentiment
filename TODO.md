# TODO

Outstanding items for next session.

---

## Verify new tickers appear in dashboard
After the 2026-07-05 7:00am NZT pipeline run, check that XLE, RKLB, and SPCX cards show up on the dashboard. They were added to `clean_news.py` and `databricks.ts` but no articles have been ingested for them yet.

## NFLX data cleanup (optional)
NFLX was removed from the ticker list but old scored articles remain in `stock_sentiment.sentiment_scores`. NFLX will age out of the 30-day aggregation window naturally (~2026-08). To remove it immediately:
1. `DELETE FROM stock_sentiment.sentiment_scores WHERE ticker = 'NFLX'` via Databricks SQL
2. `DROP TABLE IF EXISTS stock_sentiment.sentiment_daily` (force schema rebuild)
3. Trigger Steps 2 & 3 of `sentiment.py` manually (or re-run the full job)
4. Hit `POST /api/refresh/complete` to bust the ISR cache

## Roadmap (from README)
- Add LLM sentiment scoring (FinBERT or GPT-4o mini)
- Add Twitter/X ingestion
- Replace cron-job.org with Databricks Workflows for end-to-end orchestration
- Add anomaly detection for sentiment spikes
