# Session Log

## 2026-07-02
- Set up local dev server; fixed `TABLE_OR_VIEW_NOT_FOUND` crash by wrapping `getTickerSummaries()` in try/catch on `page.tsx`
- Fixed two Vercel build failures: `revalidateTag` requires second `profile` arg in Next.js 16; recharts v3 tooltip `value` type changed to `ValueType | undefined`
- Diagnosed and fixed Databricks job trigger 404 — endpoint is `/api/2.1/jobs/run-now` not `runs/now`
- Fixed serverless workspace rejection of `new_cluster` in job tasks — removed cluster spec entirely
- Fixed `sentiment.py` early exit bug: `dbutils.notebook.exit()` when `new_count == 0` skipped Steps 2 & 3 on retry
- Fixed `DELTA_FAILED_TO_MERGE_FIELDS` on `sentiment_daily`: DDL declared `FLOAT` but Spark returns `Double`; removed DDL, let `saveAsTable` infer schema
- Changed tracked tickers: removed NFLX, added XLE, RKLB, SPCX (updated `clean_news.py` and `databricks.ts`)
- Set up two cron-job.org jobs: trigger ETL at 7:00am NZT, invalidate ISR cache at 7:30am NZT
- Confirmed dashboard live at https://databricks-stock-sentiment.vercel.app/ showing Market Mood Positive +0.1132

## 2026-07-04
- Created README.md with project overview, architecture diagram, setup instructions, and cron job details
- Updated project architecture memory: corrected stack (Next.js 16, recharts), confirmed VADER, documented Databricks Repos setup, dual cron-job pattern, live URL, correct job trigger endpoint
- Added Discord failure alerting (`nextjs/lib/alert.ts`), wired into `/api/refresh` and `/api/refresh/complete`; verified live against the Discord webhook and against a real production failure response
- Centralized the Databricks ticker list into `databricks/_tickers.py` (`%run` from `ingest_news.py`/`clean_news.py`) — fixed a real drift bug where `ingest_news.py` still tagged NFLX and never tagged XLE/RKLB/SPCX
- Automated Databricks repo sync: `/api/refresh` now PATCHes the Repo to latest `main` before triggering, no more manual sync step
- Found and fixed a dead code path: cron-job.org can't forward `run_id` between its two jobs, so `/api/refresh/complete`'s success-check never ran in the real daily flow — now looks up the job's own latest run instead
- Triggered the job manually multiple times to validate end-to-end; found and fixed a real crash: `spark.createDataFrame` in `ingest_news.py` can't infer an `ARRAY<STRING>` column's type when every row's `tickers` list is empty in a batch (only ~2% of historical rows ever had a match) — fixed with an explicit schema
- Fully removed NFLX (not just deprioritized): stripped the tag from the underlying `news_clean` row (a `sentiment_scores`-only delete wasn't durable — the article got rescored right back), then cleared `sentiment_scores`/`sentiment_daily`/`ticker_summary` and rebuilt clean
- Confirmed via a fully successful pipeline run: `ingest_news` → `clean_news` → `sentiment` all `SUCCESS`, 132 raw articles, 0 NFLX anywhere
- What's next: Databricks native failure-email notification still pending manual UI setup; reddit/finviz still return 0 articles on every run (open investigation); XLE/RKLB/SPCX still haven't appeared in any headline yet
- Set Databricks native `email_notifications.on_failure` → timlok@gmail.com via the Jobs UI, verified via `jobs/get`
- Dropped Reddit entirely (anonymous `.json` endpoint returns 403 regardless of User-Agent/host — not fixable without OAuth); fixed FinViz's stale CSS selector (`a.tab-link-news` → `a.nn-tab-link`, ~180 articles now match)
- Validated a second pasted "alternative sources" proposal against reality rather than trusting it — most of the ~11 suggested sources were broken, misdescribed, or required API keys (against this project's no-API-key constraint); added only the 4 that checked out: CNBC Markets RSS, CNBC Tech RSS, Apple Newsroom RSS, per-ticker Yahoo Finance RSS feeds
- Triggered a full validation run (`run_id 568775876979038`) after syncing the repo — all 3 tasks SUCCESS; `ticker_summary` now has data for 10/12 tickers (only SPY, XLE still have zero headline mentions)
- Found the dashboard was still showing only 3 tickers (GOOGL/MSFT/NVDA) with data — root cause: a manual job trigger outside the 7:00/7:30am NZT cron pair doesn't invalidate the ISR cache, since only `/api/refresh/complete` does that. Fixed by manually POSTing `/api/refresh/complete`; confirmed all 10 tickers now render live
- What's next: SPY/XLE still need a few more days of runs to confirm whether they'll ever get headline coverage; remember to manually hit `/api/refresh/complete` after any manual job trigger going forward
