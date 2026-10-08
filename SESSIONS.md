# Session Log

## 2026-09-29
- User reported the Vercel site broken; site returned 200 but showed "No data yet" and ticker pages 404'd. The query errors were being hidden by the try/catch in `page.tsx` and `ticker/[symbol]/page.tsx`
- Root cause: Databricks had marked the workspace inactive on 2026-08-27 (`DENY_NEW_AND_EXISTING_RESOURCES`, denyReason `INACTIVE`), so the SQL warehouse couldn't start. Last successful job run before that was 2026-08-26
- Fixed by the user completing a "verify you are human" check on the Databricks homepage; no billing change needed. Warehouse started, a job run succeeded at 00:29 UTC, then a manual POST to `/api/refresh/complete` busted the ISR cache
- Verified live: dashboard shows "Data last updated 29 Sept 2026, 1:33 pm NZT"; 11/12 ticker pages return 200. XLE still 404s because its newest article (2026-08-25) is outside the 30-day window, so it's absent from `ticker_summary`
- `/api/refresh` Discord alerts did fire during the outage ("Triggering new runs ... disabled", plus a repo-sync "invalid type" error that cleared once the workspace came back). `/api/refresh/complete` stayed silent: it picked up the Aug 26 success as the latest run and re-cached the empty page every day
- Closed that gap (uncommitted): `/api/refresh/complete` now alerts and skips cache invalidation when the latest run is >6h old; the home page alerts to Discord when its Databricks query fails
- Committed/pushed the alerting changes (`75e91d4`)
- Switched sentiment from VADER to FinBERT (`ProsusAI/finbert`, `4f39a8a`) after a local comparison on 61 real headlines: VADER misread most "stock drops/tumbles" headlines. A new `model` column triggers automatic rescoring of older rows; verified all 6,099 rows are FinBERT. Positive/negative cut-offs moved from ±0.05 to ±0.2 in the pipeline and dashboard; chart y-axis is now ±1
- Found `DATABRICKS_REPO_ID` was never set on Vercel, so `/api/refresh`'s repo sync had been failing with "invalid type" and Databricks was stuck on the 2026-07-05 commit. Added it to Production and redeployed; synced the repo by hand for today's run
- Upgraded `next` to 16.3.5 and pinned `sharp` 0.35.4 / `postcss` ^8.5.23, which cleared the critical `next` advisories. Deliberately avoided `npm audit fix`, which would have pulled releases only 1–7 days old (`c509ecc`)
- Fixed duplicate headlines across feeds: `clean_news.py` now dedupes titles against existing `news_clean` (`efb8add`). One-time cleanup deleted 3,331 duplicate articles and 1,771 duplicate scores (about 29% of scores), then rebuilt all `sentiment_daily` history with FinBERT and ±0.2 cut-offs. Verified 0 duplicates after a live `/api/refresh` run, which also confirmed the Vercel repo-ID fix
- Investigated reported mojibake (`â€™`) in titles: a false alarm. Stored titles and the live site are correct UTF-8; the garbling came from local Windows tooling decoding as cp1252/ANSI
- Added a "N of 30 days have data" label to the ticker trend chart, since the outage leaves most charts nearly empty (`b11823b`)
- Explained AAPL's extra September points: Apple Newsroom's feed keeps weeks of press releases, so 13 outage-period items were picked up (all upbeat PR)
- Trialled a GDELT backfill for TSLA's outage gap: 8–18 relevant headlines/day where it worked, but heavy HTTP 429 limits (7 of 33 days fetched) and non-finance noise. Decided to leave the gap; it fills naturally by late October
- What's next: confirm tomorrow's 7am cron runs clean with no Discord alerts; watch FinBERT averages as history rebuilds; XLE returns once new XLE headlines arrive; `CLAUDE.md` still says VADER

## 2026-07-09
- User reported dashboard showing no data; verified end-to-end (Databricks job runs, `news_raw` ingest counts, `ticker_summary` contents, live site via WebFetch) — everything was actually healthy, most likely a stale browser/ISR cache view
- Added a "Data last updated" line to the dashboard header (`nextjs/app/page.tsx`) using the existing `ticker_summary.last_updated` timestamp, formatted in NZT via `Intl.DateTimeFormat`, so users can tell a stale view from a real outage without asking
- Committed and pushed (`d950651`); confirmed live on Vercel post-deploy
- What's next: nothing pending; keep watching SPY/XLE and the previously-flagged quiet sources per 2026-07-05 notes

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

## 2026-09-30
- The scheduled 7am NZT run didn't happen. cron-job.org Job 1 was sending GET, which got a silent 405. The user switched it to POST.
- `/api/refresh` now sends a Discord alert on 401 and on GET (`d63e719`).
- Started today's run manually (`853100039835826`, SUCCESS) and cleared the site cache.
- Databricks auto-scoped the PAT (jobs/sql/workspace etc.). Verified that all API calls still work.
- Next: confirm tomorrow's 7am cron run fires on its own.
- Headline times on ticker pages now show in NZ time (`c2e8b44`). Before, they rendered in UTC, so this morning's news looked like yesterday's.
- Added NET (Cloudflare) to the tracked tickers: `_tickers.py` (symbol, "cloudflare" name match, and the `yahoo_net` feed via the TICKERS loop) plus `VALID_TICKERS`.
- Headline times now show an "NZT" suffix and are parsed as UTC regardless of server timezone. The trend chart is labelled "UTC dates".

## 2026-10-01
- Cron health pass: the 7am NZT trigger didn't fire again. Root cause: cron-job.org Job 1 was disabled (Inactive, last executed 09-22), not just the GET/POST issue diagnosed yesterday.
- Triggered the run manually via `/api/refresh` (`930012449504605`, SUCCESS; repo synced to `e171d84`), then busted the cache. The site shows 1 Oct 8:44am NZT, and NET appears with 6 articles.
- Re-enabled Job 1 after confirming POST, Pacific/Auckland, and the Authorization header. Next run Fri 2 Oct 7:00am NZT (18:00 UTC during NZ daylight time).
- The "job disabled" notification was already on (email to the account address). Nothing changed.
- Next: confirm tomorrow's run fires on its own.

## 2026-10-02
- Cron health pass: the 7am NZT trigger fired on its own (run `914310688469613` at 18:01 UTC, SUCCESS; repo auto-synced to `7a50008`). The re-enabled Job 1 works.
- But the site showed "No data yet", and AAPL/GOOGL ticker pages returned 404. Cause: a burst of page renders at 20:37 UTC hit a cold SQL warehouse, and queries took 33–40s, longer than `wait_timeout: 30s`. `runQuery` read the PENDING response as zero rows, so the empty page was cached for 24h with no alert. Restored by busting the cache once the warehouse was warm.
- Fix (local, not yet pushed): `runQuery` polls PENDING/RUNNING statements up to 2 min and throws on any non-SUCCEEDED state.
- Added light mode with a header toggle: Tailwind `darkMode: "class"`, a pre-paint inline script (localStorage `theme`, falling back to the OS setting), and chart colors via CSS variables. Verified both themes locally.
- Next: push both changes, then confirm tomorrow's run renders without a manual cache bust.
- Brand logos + UI pass (local, not yet pushed): `lib/tickerMeta.ts` holds each ticker's name and brand color. Logos are white Simple Icons (CC0) SVGs in `public/logos/` on a brand-color tile. RKLB, SPY, XLE and AMD use lettered tiles (no icon, or the icon was unreadable at tile size).
- Cards now show the logo and company name, a 7-day sparkline (one batched `getRecentTrends` query), and a diverging sentiment bar. The home page has positive/neutral/negative counts plus most bullish/bearish tickers, and sort (A–Z/score/articles) and filter controls. The ticker page has a logo header and today/7d/30d pills.
- Next: push. A new ticker now also needs a `TICKER_META` entry (and optionally a logo).
- Added TSM, AVGO, ASTS, QQQ, JPM (18 tickers): `_tickers.py` (symbols plus name matches tsmc/taiwan semiconductor, broadcom, ast spacemobile, jpmorgan/jp morgan; QQQ is symbol-only like SPY), `VALID_TICKERS`, and `TICKER_META`. Simple Icons logos for AVGO (Broadcom) and JPM (the Chase octagon); lettered tiles for TSM, ASTS, QQQ. Known noise: "jpmorgan" also tags analyst-note headlines about other stocks.
- Next: the new tickers appear after the next pipeline run, once they have articles.
- Labels: "Most bullish/bearish" only when the ticker clears ±0.2, otherwise "Highest/Lowest score". Added display-only "Leaning positive/negative" for ±0.05–0.2 (shared `moodLabel` in `tickerMeta.ts`, used by card badges and Market Mood). Counts, filter, and stored labels still use ±0.2.
- Decided to keep the ±0.05 lean threshold: AMZN at −0.032 stays "Neutral" (lowering to ±0.02 would mostly label noise).
- Next: confirm tomorrow's 7am NZT run (3 Oct) renders without a manual cache bust (slow-query polling fix) and that TSM/AVGO/ASTS/QQQ/JPM appear once they have articles; watch JPM for analyst-note noise.
- Assessed moving the Databricks notebooks to GitHub Actions triggered by a Cloudflare Worker cron (no code changed). All four scripts are portable: ingest is plain Python apart from the Delta MERGE; clean needs its Spark UDFs/anti-joins rewritten (pandas or SQL MERGE); FinBERT already scores on the driver; the daily/summary aggregations fit as warehouse SQL. Recommended option A: GHA does fetch/clean/score and writes to the existing Delta tables via the SQL warehouse (Next.js unchanged); this drops the Databricks job, the repo-PATCH sync, and both cron-job.org jobs (cache bust becomes the workflow's final step). Worker cron fires 18:00 and 19:00 UTC and only dispatches when Pacific/Auckland hour is 7.
- Confirmed nothing on the laptop runs this project (no scheduled task or process); the laptop's Task Scheduler only runs other projects (TD Sequential, Tesla history, VoiceOS).
- Next: user to choose option A (keep Databricks storage) or B (move off Databricks) before implementing; test FinViz/Yahoo from GHA runner IPs first.

## 2026-10-03
- User reported the site hadn't refreshed. Checked: the 7am NZT cron ran on its own (run `309754088441732`, 18:01 UTC, SUCCESS) and the live site shows "Data last updated 3 Oct 2026, 7:05 am NZT" with all 18 tickers, including TSM/AVGO/ASTS/QQQ/JPM. No manual cache bust was needed, so the slow-query polling fix held. The stale view was on the client side (an old tab or a visit before the 7:30 bust).
- Then AMZN's page still ended at 1 Oct (NVDA too), while TSLA/AAPL were current. Cause: `/api/refresh/complete` calls `revalidateTag("sentiment", "default")`, which is stale-while-revalidate. The first visit to each page after the bust gets the old copy and starts a rebuild; the second visit is fresh. Re-fetching AMZN/NVDA fixed both.
- While checking, the whole site went to "No data yet" and every ticker page returned 404. My curl visits started rebuilds against a sleeping warehouse, the queries stayed PENDING past the 2-min poll limit, and `page.tsx` cached the empty and 404 pages for 24h. The queries themselves finished at 01:29 UTC.
- Fix: query errors now propagate (home and ticker pages) so ISR keeps the last good page. Only unknown symbols return 404 (`VALID_TICKERS` check). `/api/refresh/complete` now loads `/` and every ticker page after `revalidateTag` so real visitors don't get the stale copy. Dropped `expire: 0`: with a cold warehouse at 7:30 it would make the first visit fail outright. Pushed, and the deploy restored the site.
- Verified after the deploy: home shows 3 Oct 7:05am NZT, AMZN/NVDA/JPM pages go to 2 Oct, an unknown ticker returns 404, and no runtime errors since the deploy. Open items moved into TODO.md.
- Next: confirm tomorrow's 7:30 bust leaves every page fresh; keep watching JPM for analyst-note noise.
- Root-caused the "Databricks query failed" Discord alert (14:29 NZT): the cold warehouse took >2 min to start, so `runQuery` gave up with "query still PENDING after 2 min". Nothing failed on the warehouse side; the batch started running exactly when the poll timed out. This was the same incident as above, before `4d1bfdf`.
- Fix (`ca65d6d`, pushed and deployed; live home still shows 3 Oct 7:05am NZT): `/api/refresh/complete` now calls `wakeWarehouse()` (`lib/databricks.ts`: POST `/sql/warehouses/{id}/start`, poll for up to 3 min until RUNNING) before `revalidateTag` and the page warm-up; `maxDuration = 300`. Verified the PAT can start the warehouse (STOPPED → RUNNING in ~10s).
- Diagnostic used: Vercel CLI `vercel logs --environment production --since 3h --level error -x` from a scratch-linked folder showed the exact error text (Hobby keeps ~1h–3h).
- Next: confirm tomorrow's 7:30 NZT bust sends no Discord alert and every page is fresh (the cold-start path of `wakeWarehouse` is only tested then).

## 2026-10-04
- The 7:00 NZT trigger failed: `/api/refresh` reached Databricks, but `run-now` returned `FEATURE_DISABLED` ("Triggering new runs for organization 7474648457045957 is currently disabled temporarily"), and the Discord alert fired. It was still blocked at 13:02 NZT, and the SQL warehouse was rejecting queries. This looks like the same workspace block as the Aug 27 outage. cron-job.org Job 1 did fire (7:00:58 NZT, 502 Bad Gateway, which is our route passing on the Databricks error). The site kept showing the 3 Oct pages instead of going empty, so `4d1bfdf` worked as intended.
- The user signed in to Databricks (no human-verification prompt this time, so unclear whether signing in or the block expiring cleared it) and started the job from the UI. Run `368040012974715` succeeded (359 raw articles since 3 Oct; `ticker_summary` updated at 00:10 UTC). A manual `/api/refresh/complete` returned 200 in 7s. The warehouse was already RUNNING, so the `wakeWarehouse()` cold-start path is still untested.
- Finding: the post-bust warm-up doesn't make pages fresh on the first real visit. The home page needed a second visit, and several ticker pages (AMD, META, TSLA, RKLB, ...) needed 2–3 visits before they matched `sentiment_daily`. The warm-up fetch is served stale and only starts a background rebuild. All pages matched the DB by 13:20 NZT.
- The Databricks query-profile hints the user pasted (unfiltered partition key on `sentiment_scores`/`news_clean`, small files) are performance advisories, not errors. The full scans are intentional and the tables are tiny. No action taken.
- Next: tomorrow's 7:00/7:30 run, the first scheduled one since this block. Decide whether the warm-up should fetch each page twice. Option B on the GHA/Cloudflare migration now has a second outage behind it.

## 2026-10-05
- Handoff check: the 7:00 NZT run fired on its own (run `933142644540379`, 18:01 UTC, SUCCESS; `ticker_summary` updated 18:05 UTC). The Databricks block is gone.
- But the site still showed 4 Oct 1:10pm NZT at 10:09 NZT: the 7:30 cache bust had no effect, and no Vercel logs survived to show why. A manual `/api/refresh/complete` (200, 32s) fixed it. Home and all spot-checked ticker pages matched `sentiment_daily` on the first visit.
- Finding: in a route handler, `revalidateTag` only takes effect after the handler returns (`next/dist/server/route-modules/app-route/module.js`, `executeRevalidates` → `pendingWaitUntil`). So both warm-up passes in `/complete` render against the old cache. They can't help, and `04f9004` made the route take ~32s.
- Confirmed cause: cron-job.org Job 2 fired at 7:30 but reported "did not fully respond within the configured timeout". The ~32s call was cut off before the handler returned, so the tag was never invalidated, and nothing alerts on that path.
- Fix (`8674235`, pushed and deployed): `/complete` no longer warms pages or sleeps. It sends the warehouse start request without waiting for RUNNING (`wakeWarehouse(0)`), then calls `revalidateTag`. Dropped `maxDuration = 300`. A test POST on production returned 200 in 1.9s, and the site still shows 5 Oct 7:05am NZT.
- Next: on 6 Oct, check that cron-job.org Job 2 shows success at 7:30 NZT (no timeout) and the site shows 6 Oct data without a manual bust. If the first visit after a cold warehouse ever fails (Discord "keeping the previous page" alert), consider a warm-up in `after()` instead of in the handler body.
- Spot-checked one AMZN article: TheStreet's "Amazon AWS CEO warns AI data center backlash could hurt US economy" (MSN headline). It reached us via `yahoo_amzn` with a different headline, "Amazon AWS CEO reveals surprising risk to AI stocks and U.S. economy" (2026-10-04 16:03 UTC). Databricks stored +0.057 (pos 0.477 / neg 0.420), so it shows as "Leaning positive".
- Local FinBERT (scratch venv, torch 2.14.0 CPU + transformers 5.17.0) reproduced the stored score (+0.064). It scored the MSN headline at −0.948. Averaging the 36 body sentences gives −0.031, because the market-context sentences cancel out the risk sentences. My reading of the article: negative, about −0.35. Takeaway: a headline-only score depends on which outlet's wording we receive. No code changed.
- Full article text without a browser: `https://assets.msn.com/content/view/v2/Detail/en-us/<AA id>` returns JSON with `body` HTML. msn.com pages are client-rendered, and thestreet.com returns 403 to WebFetch.
- Next: decide whether headline-wording variance needs a fix (score the RSS description too, or accept it as noise). Leaning towards no change based on one article.

## 2026-10-07
- "Cron broken" check: cron-job.org Job 1 (7:01 NZT, 5.78s) and Job 2 (7:30 NZT, 2.13s) both succeeded, and the site showed 7 Oct 7:05am NZT. This confirms the `8674235` fix from 10-05. Nothing was broken in the pipeline.
- Real issue: SPY had data on only 4 of 30 days. Tagging only matches the literal symbol in the title (or `COMPANY_MAP` names), and ETFs have no name match. The `yahoo_spy` feed returns ~20 articles/day, mostly general-market stories, and only 1 of 20 said "SPY".
- Fix (`081b73a`, pushed): `_tickers.py` maps "s&p 500" → SPY and "nasdaq 100" → QQQ. Applies to new articles only; no backfill. XLE has the same gap and wasn't changed.
- Next: after the 7 Oct 18:00 UTC run, check SPY/QQQ article counts rose. Consider an XLE name match ("energy select sector") if it matters.
- Tagging scan of all 18 `yahoo_<t>` feeds: found SPCX (SpaceX unmapped, 2/16 tagged) and META (bare "Meta" unmapped) as real gaps; other tickers' untagged titles are general-market noise. Added "spacex", "space exploration technologies", "meta", plus XLE names ("energy stocks/sector/etf/etfs"). After: SPCX 10/16, META 6/15, XLE 11/19 self-tagged. New articles only, no backfill.
- Next: after the 7 Oct 18:00 UTC run, check SPY/QQQ/XLE/SPCX/META counts rose. Watch for false tags from bare "meta" and "energy stocks" (clean-energy headlines tag XLE).
- Client cache: stale ticker data when clicking between pages in one session came from Next's 5-min client router cache (HTML itself is `max-age=0, must-revalidate`). `740ece5` sets `experimental.staleTimes` to `{ dynamic: 0, static: 30 }` in `nextjs/next.config.mjs` (30s is the minimum allowed for static). SPCX data was fine on the server (rows through 6 Oct).
- Handoff for 8 Oct: (1) check cron-job.org Jobs 1/2 succeeded and the site shows 8 Oct data; (2) after the run, confirm SPY/QQQ/XLE/SPCX/META article counts rose vs 7 Oct; (3) confirm the `740ece5` deploy went live; (4) the "Notion DeMark Backfill" job showed an orange icon in cron-job.org — a different project, not looked at.

## 2026-10-09
- 7:00 NZT trigger got 502 (Databricks workspace block; warehouse rejected `select 1`). User opened the Databricks UI, block cleared; triggered `/api/refresh` (run 290438428609350, succeeded) and `/api/refresh/complete` by hand, site fresh at 10:22 NZT.
- Cause found from `system.access.audit`: blocks land ~4.75 days after the last interactive browser login (09-29, 10-04, 10-08). Not a usage quota.
- Next: log in to Databricks in a browser every ~3 days (next by 10-11), or decide on the GHA/Cloudflare migration. 8 Oct's cache bust never showed on the site; cause not confirmed.
- Left Databricks Free Edition: pipeline now `pipeline/run.py` (fetch, clean, FinBERT, aggregate) in `.github/workflows/daily.yml`, writing to Cloudflare D1 (`stocksentiment`, 5,334 score rows seeded from Delta). Next.js reads D1 via `nextjs/lib/d1.ts`; `/api/refresh` deleted, `/api/refresh/complete` is called by the workflow's last step. Commit `d65b841`.
- cron-job.org Job 1 (7994674) was edited in place to POST GitHub's `workflow_dispatch` for `daily.yml` (test run 204, workflow run succeeded). GitHub secrets and Vercel `CLOUDFLARE_*` env vars set. Runners are not blocked by FinViz/Yahoo.
- Next: confirm the 10 Oct 7:00 NZT run; disable cron-job.org Job 2; then, with approval, delete `databricks/`, the Databricks job and `DATABRICKS_*` env vars. `yahoo_finance` and `reuters` feeds return 0 articles.
- Job 2 disabled in cron-job.org; old Job 1 (7994674) now dispatches the workflow. A GitHub token was pasted into chat once and had to be revoked and regenerated; keep tokens out of chat.
- Handoff for 10 Oct: (1) check `gh run list -R timothylok/databricks_stock_sentiment` shows a 7:00 NZT `workflow_dispatch` run that succeeded, and the site's "Data last updated" is 10 Oct (first visit after the bust may still show old data); (2) confirm the old `github_pat_11ACHB…` token is deleted; (3) if all good, ask before deleting `databricks/`, the Databricks job and `DATABRICKS_*` env vars (Vercel, `nextjs/.env`); (4) check `yahoo_finance` and `reuters` feeds (0 articles each, may be dead); (5) untracked strays to delete by hand: `nextjs/.env.bak`, `nextjs/AGENTS.md`, `nextjs/CLAUDE.md`, `pipeline/__pycache__/`.
