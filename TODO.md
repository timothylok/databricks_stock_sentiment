# TODO

Outstanding items for next session.

---

## Verify new tickers appear in dashboard
`ingest_news.py` had a stale ticker list — it still tagged NFLX and never tagged XLE/RKLB/SPCX, out of sync with `clean_news.py`. Fixed 2026-07-04 by centralizing both into `databricks/_tickers.py` (via `%run`). Confirmed working via manual job runs the same day (`ingest_news`/`clean_news`/`sentiment` all `SUCCESS`). RKLB and SPCX now have dashboard cards. XLE and SPY still don't, as of 2026-07-05 — see below.

## SPY/XLE: have scored mentions, but never surface in `ticker_summary` — needs a design decision
Checked 2026-07-05: `sentiment_scores` actually has 2 SPY mentions (published 2026-07-02, via new `yahoo_spy` feed) and 1 XLE mention (published 2026-06-29, via `yahoo_xle`) — so it's not a total headline drought like the 2026-07-04 note assumed. They don't reach `ticker_summary` because `sentiment.py`'s `summary` join uses `today_agg` (1-day window) as its base and left-joins 7d/30d onto it — a ticker with zero articles in the *current* 1-day window is dropped entirely, even if it has 7d/30d history. Since these SPY/XLE articles were already >1 day old by the time they were scored, they never had a shot at appearing. Today's cron run (2026-07-05) added zero new SPY/XLE mentions, so this hasn't self-resolved yet. Worth flagging to the user next session: either this is fine (thin per-ticker feeds are genuinely quiet) or `summary`'s join base should change to include tickers with 7d/30d-only data — that's a product decision, not obviously a bug.

## New sources (CNBC/Apple/per-ticker Yahoo): partially confirmed across multiple runs
Checked 2026-07-05, comparing the 2026-07-04 validation run against today's independent cron run: `cnbc_markets` and 10 of 12 per-ticker `yahoo_*` feeds (all except `yahoo_spy`/`yahoo_xle`) contributed **new** articles in today's run too — confirms they're not one-off. `apple_newsroom`, `cnbc_tech`, `yahoo_spy`, and `yahoo_xle` had zero new articles today (same rows as 07-04, deduped by `whenNotMatchedInsertAll` on URL hash) — could be genuinely quiet feeds or could mean something's off with those 4. Watch over the next few daily runs.

## ~~Investigate reddit/finviz returning 0 articles~~ — resolved 2026-07-04
Reddit's anonymous `.json` endpoint is blocked outright (403 regardless of User-Agent or `old.reddit.com` vs `www.reddit.com`) — dropped the source rather than add OAuth. FinViz's CSS selector was stale after a site redesign (`a.tab-link-news` → `a.nn-tab-link`); fixed and confirmed ~180 matching articles. Also added CNBC Markets/Tech RSS, Apple Newsroom RSS, and per-ticker Yahoo feeds after validating each against a second pasted source-list proposal (most of that list was inaccurate or required API keys — only these 4 checked out). Confirmed via a full validation run (`run_id 568775876979038`, all 3 tasks SUCCESS) — `ticker_summary` now has data for 10/12 tickers (AAPL, AMD, AMZN, GOOGL, META, MSFT, NVDA, RKLB, SPCX, TSLA); only SPY and XLE still have zero headline mentions.

## Manual job triggers don't auto-refresh the site — watch for this
Discovered 2026-07-04: after manually triggering a job run (outside the 7:00/7:30am NZT cron pair), the dashboard kept serving a stale ISR snapshot because nothing called `/api/refresh/complete` to invalidate the cache. Fix was a one-off manual `POST /api/refresh/complete`. If you trigger a job manually again to test something, remember to also manually hit `/api/refresh/complete` afterward (with `Authorization: Bearer <CRON_SECRET>`) or the site won't reflect it until the next scheduled run.

**2026-07-05: first full day since the Reddit-drop/FinViz-fix/cache-bug fixes — confirmed clean.** The Databricks job ran exactly once (`run_id 253283687744960`, started 2026-07-04T19:01:15Z = 07:01am NZT, `SUCCESS`, all 3 tasks), with no concurrent or retry runs nearby. It processed 177 new raw articles → 136 clean → 48 newly scored. `ticker_summary.last_updated` = 2026-07-04T19:05:04Z, and the live dashboard shows exactly those 10 tickers — so `/api/refresh/complete` found the run's SUCCESS state and busted the ISR cache on its own, no manual `POST` needed this time.

## ~~NFLX data cleanup~~ — done 2026-07-04
Fully removed: `sentiment_scores`/`sentiment_daily` cleaned, and the stale `NFLX` tag stripped from the underlying `news_clean` row via `array_except(tickers, array('NFLX'))` (the first DELETE-only attempt didn't stick — the article was still tagged in `news_clean`, so the next `sentiment.py` run just rescored and reinserted it). Verified 0 NFLX rows in `sentiment_scores`/`ticker_summary` after a clean rerun, and ISR cache busted.

## ingest_news.py crash on all-empty ticker batches — fixed 2026-07-04
`spark.createDataFrame(all_rows)` relied on type inference and crashed (`CANNOT_DETERMINE_TYPE`) whenever every fetched headline in a batch had zero literal ticker-symbol matches (common — `ingest_news.py` only matches bare symbols like `AAPL`, not company names). Only 2 of 96 historical rows ever had a match at ingest time, so this was a latent bug, not a regression. Fixed with an explicit `StructType` schema instead of inference. Confirmed via two full successful pipeline runs afterward.

## ~~Databricks failure email notification~~ — done 2026-07-04
`on_failure` email notification set to timlok@gmail.com in the job's Databricks settings (`email_notifications.on_failure`, verified via `jobs/get`). Combined with Vercel-side Discord alerts (trigger/complete routes) — cron-job.org's own failure notification was skipped per user request — all failure legs are now covered.

## Repo sync failed once on 2026-07-05 — transient, no impact, watch for recurrence
7:01am NZT run's `syncRepo()` step got `RESOURCE_DOES_NOT_EXIST: Git folder (Repo) has invalid type` from `PATCH /api/2.0/repos/{id}`, alerted to Discord as designed, and let the job trigger anyway (best-effort sync, see `route.ts`). No functional impact — the only commit the repo missed was `5de7054`, which is docs-only. Manually re-ran the identical PATCH afterward and it succeeded with no config changes, syncing to `5de7054` — looks like a transient Databricks-side hiccup, not something wrong on our end. If this recurs and a future commit actually changes notebook code, a failed sync would mean the job silently runs stale code — that'd be the point to add retry-with-backoff to `syncRepo()`, not before.

## Roadmap (from README)
- Add LLM sentiment scoring (FinBERT or GPT-4o mini)
- Add Twitter/X ingestion
- Replace cron-job.org with Databricks Workflows for end-to-end orchestration
- Add anomaly detection for sentiment spikes
