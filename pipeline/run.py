"""Daily pipeline: fetch headlines, clean, score with FinBERT, write to D1."""
import calendar
import hashlib
import html
import re
import sys
from datetime import datetime, timezone

import feedparser
import requests
from bs4 import BeautifulSoup

import d1
from tickers import COMPANY_MAP, COMPANY_PATTERN, TICKER_PATTERN, TICKERS

MODEL = "ProsusAI/finbert"
RECOMPUTE_DAYS = 30
# FinBERT compound (P(positive) - P(negative)) clusters near ±1 for clear
# headlines and near 0 for neutral ones, so it needs a wider band than VADER's ±0.05
POS_THRESHOLD = 0.2
NEG_THRESHOLD = -0.2

RSS_SOURCES = [
    ("yahoo_finance",   "https://finance.yahoo.com/rss/topstories"),
    ("marketwatch",     "https://feeds.content.dowjones.io/public/rss/mw_topstories"),
    ("reuters",         "https://feeds.reuters.com/reuters/businessNews"),
    ("cnbc_markets",    "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
    ("cnbc_tech",       "https://www.cnbc.com/id/19854910/device/rss/rss.html"),
    ("apple_newsroom",  "https://www.apple.com/newsroom/rss-feed.rss"),
    ("motley_fool",     "https://www.fool.com/a/feeds/partner/googlechromefollow?apikey=5e092c1f-c5f9-4428-9219-908a47d2e2de"),
    ("forbes_markets",  "https://feeds.forbes.com/markets/feed2/"),
    ("forbes_investing", "https://feeds.forbes.com/investing/feed2/"),
] + [
    (f"yahoo_{t.lower()}", f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={t}&region=US&lang=en-US")
    for t in TICKERS
]

HEADERS = {"User-Agent": "stocksentiment-poc/1.0 (github.com/timlo/stocksentiment)"}


def row_id(source: str, url: str) -> str:
    return hashlib.sha256(f"{source}|{url}".encode()).hexdigest()


def fmt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_ts(entry) -> datetime:
    for attr in ("published_parsed", "updated_parsed"):
        t = getattr(entry, attr, None)
        if t:
            return datetime.fromtimestamp(calendar.timegm(t), tz=timezone.utc).replace(tzinfo=None)
    return utcnow()


def fetch_rss(source: str, url: str) -> list[dict]:
    feed = feedparser.parse(url, request_headers=HEADERS)
    rows = []
    for e in feed.entries:
        title = getattr(e, "title", "").strip()
        if title:
            link = getattr(e, "link", "")
            rows.append({"id": row_id(source, link), "source": source, "title": title, "published_at": parse_ts(e)})
    print(f"  {source}: {len(rows)} articles")
    return rows


def fetch_finviz() -> list[dict]:
    resp = requests.get("https://finviz.com/news.ashx", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    rows = []
    for a in soup.select("a.nn-tab-link"):
        title = a.get_text(strip=True)
        url = a.get("href", "")
        if title and url.startswith("http"):
            rows.append({"id": row_id("finviz", url), "source": "finviz", "title": title, "published_at": utcnow()})
    print(f"  finviz: {len(rows)} articles")
    return rows


def clean_title(title: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(title)).strip()


def normalize(title: str) -> str:
    # lowercase, punctuation stripped: used for dedup
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", title.lower())).strip()


def find_tickers(title: str) -> list[str]:
    found = set(TICKER_PATTERN.findall(title))
    for match in COMPANY_PATTERN.findall(title.lower()):
        found.add(COMPANY_MAP[match])
    return sorted(found)


def finbert_score(titles: list[str]) -> list[dict]:
    from transformers import pipeline

    clf = pipeline("text-classification", model=MODEL, top_k=None)
    out = clf(titles, batch_size=32, truncation=True)
    return [{s["label"]: float(s["score"]) for s in scores} for scores in out]


def main() -> None:
    print("Fetching sources...")
    fetched: list[dict] = []
    for name, url in RSS_SOURCES:
        try:
            fetched.extend(fetch_rss(name, url))
        except Exception as e:
            print(f"  WARNING: {name} failed — {e}")
    try:
        fetched.extend(fetch_finviz())
    except Exception as e:
        print(f"  WARNING: finviz failed — {e}")
    print(f"Total fetched: {len(fetched)}")
    if not fetched:
        sys.exit("No articles fetched from any source")

    # Clean, tag, and dedup within the batch and against what is already stored.
    # id is hash(source|url), so the same story via two feeds needs the title check.
    known = d1.query("SELECT DISTINCT article_id, title_normalized FROM sentiment_scores")
    seen_ids = {r["article_id"] for r in known}
    seen_titles = {r["title_normalized"] for r in known}

    articles = []
    for row in fetched:
        title = clean_title(row["title"])
        norm = normalize(title)
        tickers = find_tickers(title)
        if len(title) < 10 or not tickers or row["id"] in seen_ids or norm in seen_titles:
            continue
        seen_ids.add(row["id"])
        seen_titles.add(norm)
        articles.append({**row, "title": title, "title_normalized": norm, "tickers": tickers})
    print(f"New articles to score: {len(articles)}")

    if articles:
        probs = finbert_score([a["title"] for a in articles])
        now = fmt(utcnow())
        stmts = []
        for a, p in zip(articles, probs):
            for ticker in a["tickers"]:
                stmts.append((
                    "INSERT OR REPLACE INTO sentiment_scores (article_id, ticker, source, title, title_normalized,"
                    " published_at, compound, pos, neu, neg, scored_at, model) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    [a["id"], ticker, a["source"], a["title"], a["title_normalized"], fmt(a["published_at"]),
                     p["positive"] - p["negative"], p["positive"], p["neutral"], p["negative"], now, MODEL],
                ))
        d1.batch(stmts)
        print(f"Inserted {len(stmts)} score rows")

    cutoff = f"-{RECOMPUTE_DAYS} day"
    d1.batch([
        ("DELETE FROM sentiment_daily WHERE date >= date('now', ?)", [cutoff]),
        (
            "INSERT INTO sentiment_daily (ticker, date, avg_compound, article_count, positive_count,"
            " negative_count, neutral_count, computed_at)"
            " SELECT ticker, date(published_at), round(avg(compound), 4), count(*),"
            " sum(compound >= ?), sum(compound <= ?), sum(compound > ? AND compound < ?), datetime('now')"
            " FROM sentiment_scores WHERE published_at >= date('now', ?)"
            " GROUP BY ticker, date(published_at)",
            [POS_THRESHOLD, NEG_THRESHOLD, NEG_THRESHOLD, POS_THRESHOLD, cutoff],
        ),
    ])

    # One transaction, so the dashboard never sees an empty summary
    d1.batch([
        ("DELETE FROM ticker_summary", []),
        (
            "INSERT INTO ticker_summary (ticker, avg_compound_today, avg_compound_7d, avg_compound_30d,"
            " article_count_today, top_positive_title, top_negative_title, last_updated)"
            " SELECT s.ticker,"
            " round(avg(CASE WHEN s.published_at >= date('now', '-1 day') THEN s.compound END), 4),"
            " round(avg(CASE WHEN s.published_at >= date('now', '-7 day') THEN s.compound END), 4),"
            " round(avg(s.compound), 4),"
            " coalesce(sum(s.published_at >= date('now', '-1 day')), 0),"
            " (SELECT title FROM sentiment_scores x WHERE x.ticker = s.ticker"
            "  AND x.published_at >= date('now', '-7 day') ORDER BY compound DESC LIMIT 1),"
            " (SELECT title FROM sentiment_scores x WHERE x.ticker = s.ticker"
            "  AND x.published_at >= date('now', '-7 day') ORDER BY compound ASC LIMIT 1),"
            " datetime('now')"
            " FROM sentiment_scores s WHERE s.published_at >= date('now', '-30 day') GROUP BY s.ticker",
            [],
        ),
    ])
    n = d1.query("SELECT count(*) AS n FROM ticker_summary")[0]["n"]
    print(f"ticker_summary rows: {n}")


if __name__ == "__main__":
    main()
