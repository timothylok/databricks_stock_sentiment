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

## 2026-07-05 (cont'd)
- Fixed `ticker_summary`'s join-base bug: anchored on `month_agg` (30d) instead of `today_agg` (1d), so tickers with only 7d/30d history (like SPY/XLE) no longer get dropped entirely; `avg_compound_today` stays `NULL` (not coalesced to 0) when there's no same-day article
- Updated `TickerCard.tsx` and `ticker/[symbol]/page.tsx` to fall back to the 7d/30d avg with a "no headlines today · showing Nd avg" label instead of a bare dash when today's score is null
- Committed and pushed (`d9380d5`), synced the Databricks repo, and triggered a manual run (`760013672960632`, all 3 tasks SUCCESS) to confirm before the next scheduled cron
- Verified live: `ticker_summary` now has 12/12 tickers; manually busted the ISR cache (`/api/refresh/complete`) and confirmed the dashboard renders SPY/XLE with the new fallback label — caught that my first WebFetch check was serving a stale 15-min-cached copy of the page, re-verified via direct curl
- Validated and added a new RSS source, `motley_fool` (`fool.com/a/feeds/partner/googlechromefollow`) — flagged that its `apikey` looks like a Motley Fool partner credential for Chrome's "Follow" feature, not one issued to this project, so it could be revoked without notice; not yet exercised by a pipeline run
- Rejected `forbes.com/investing/?sh=...` as a source — DataDome anti-bot protected HTML page, not RSS; same risk category as the already-dropped Reddit source
- Found and added the real Forbes feeds instead: `feeds.forbes.com/markets/feed2/` and `feeds.forbes.com/investing/feed2/` — a separate, unprotected RSS subdomain discovered via the `<link rel="alternate">` tag on the investing page. Both validated clean (200, real articles, no anti-bot headers)
- What's next: confirm `motley_fool` and the two Forbes feeds actually contribute articles on the next run; keep watching the 4 quiet sources (`apple_newsroom`/`cnbc_tech`/`yahoo_spy`/`yahoo_xle`) from earlier today

## 2026-07-05
- Checked in on the pipeline (first full day since the Reddit-drop/FinViz-fix/cache-bug fixes); no code changes, verification only
- Confirmed today's 7:00/7:30am NZT cron pair ran cleanly with zero manual intervention: single Databricks job run (`253283687744960`), `SUCCESS`, 177 raw → 136 clean → 48 newly scored articles; dashboard already showed the fresh 10-ticker `ticker_summary` (last_updated 19:05 UTC), so `/api/refresh/complete` busted the ISR cache on its own
- Found the 2026-07-04 "SPY/XLE have zero headline mentions" note was misleading: both have mentions in `sentiment_scores` (via the new per-ticker Yahoo feeds), they just can't reach `ticker_summary` because its join uses a 1-day-window table as the base and drops any ticker absent from it, even with 7d/30d history — flagged as an open product decision in TODO.md, not fixed
- Confirmed the new sources are contributing across multiple independent runs, not just the 07-04 validation run: `cnbc_markets` + 10/12 per-ticker Yahoo feeds delivered new articles again today; `apple_newsroom`, `cnbc_tech`, `yahoo_spy`, `yahoo_xle` have been quiet since validation day — needs more days to know if that's a real gap
- What's next: keep watching SPY/XLE and the 4 quiet sources over the next few daily runs; decide whether `ticker_summary`'s join-base logic should change to surface 7d/30d-only tickers

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
