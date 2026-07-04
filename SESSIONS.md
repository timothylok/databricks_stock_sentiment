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
- What's next: NFLX data will age out of 30-day window naturally; XLE/RKLB/SPCX will appear after next pipeline run
