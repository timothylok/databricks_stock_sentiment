"""One-off: re-score stored rows of multi-ticker headlines (last 30 days) per ticker.
Then run the daily workflow to recompute sentiment_daily / ticker_summary."""
import d1
from aspect import MODEL, aspect_score
from tickers import TICKER_NAMES

rows = d1.query(
    "SELECT article_id, ticker, title FROM sentiment_scores WHERE published_at >= date('now', '-30 day')"
    " AND article_id IN (SELECT article_id FROM sentiment_scores GROUP BY article_id HAVING count(*) > 1)")
rows = [r for r in rows if r["ticker"] in TICKER_NAMES]
print(f"{len(rows)} rows to re-score")
scores = aspect_score([(r["title"], TICKER_NAMES[r["ticker"]]) for r in rows])
for i in range(0, len(rows), 50):
    d1.batch([
        ("UPDATE sentiment_scores SET compound=?, pos=?, neu=?, neg=?, model=? WHERE article_id=? AND ticker=?",
         [s["compound"], s["pos"], s["neu"], s["neg"], MODEL, r["article_id"], r["ticker"]])
        for r, s in zip(rows[i:i + 50], scores[i:i + 50])
    ])
print("done")
