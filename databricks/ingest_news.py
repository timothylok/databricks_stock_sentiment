# Databricks notebook source
# COMMAND ----------

# MAGIC %pip install feedparser==6.0.11 beautifulsoup4==4.12.3 requests==2.31.0

# COMMAND ----------

import hashlib
import feedparser
import requests
from datetime import datetime, timezone
from bs4 import BeautifulSoup
from pyspark.sql import Row
from pyspark.sql.functions import current_timestamp
from delta.tables import DeltaTable

# COMMAND ----------

# MAGIC %run ./_tickers

# COMMAND ----------

DATABASE = "stock_sentiment"
TABLE = f"{DATABASE}.news_raw"

RSS_SOURCES = [
    ("yahoo_finance",   "https://finance.yahoo.com/rss/topstories"),
    ("marketwatch",     "https://feeds.content.dowjones.io/public/rss/mw_topstories"),
    ("reuters",         "https://feeds.reuters.com/reuters/businessNews"),
]

HEADERS = {"User-Agent": "stocksentiment-poc/1.0 (github.com/timlo/stocksentiment)"}

# COMMAND ----------

def row_id(source: str, url: str) -> str:
    return hashlib.sha256(f"{source}|{url}".encode()).hexdigest()


def parse_ts(entry) -> datetime:
    for attr in ("published_parsed", "updated_parsed"):
        t = getattr(entry, attr, None)
        if t:
            import calendar
            return datetime.fromtimestamp(calendar.timegm(t), tz=timezone.utc).replace(tzinfo=None)
    return datetime.utcnow()


def extract_tickers(text: str) -> list[str]:
    return sorted(set(TICKER_PATTERN.findall(text or "")))


def fetch_rss(source: str, url: str) -> list[Row]:
    feed = feedparser.parse(url, request_headers=HEADERS)
    rows = []
    for e in feed.entries:
        link = getattr(e, "link", "")
        title = getattr(e, "title", "").strip()
        if not title:
            continue
        rows.append(Row(
            id=row_id(source, link),
            source=source,
            tickers=extract_tickers(title),
            title=title,
            url=link,
            published_at=parse_ts(e),
        ))
    print(f"  {source}: {len(rows)} articles")
    return rows


def fetch_reddit() -> list[Row]:
    resp = requests.get(
        "https://www.reddit.com/r/stocks/.json?limit=100&sort=new",
        headers=HEADERS,
        timeout=15,
    )
    resp.raise_for_status()
    posts = resp.json()["data"]["children"]
    rows = []
    for p in posts:
        d = p["data"]
        if d.get("is_self") is False and d.get("stickied"):
            continue
        title = d.get("title", "").strip()
        url = f"https://www.reddit.com{d.get('permalink', '')}"
        if not title:
            continue
        rows.append(Row(
            id=row_id("reddit", url),
            source="reddit",
            tickers=extract_tickers(title),
            title=title,
            url=url,
            published_at=datetime.utcfromtimestamp(d.get("created_utc", 0)),
        ))
    print(f"  reddit: {len(rows)} posts")
    return rows


def fetch_finviz() -> list[Row]:
    resp = requests.get("https://finviz.com/news.ashx", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    rows = []
    for a in soup.select("a.tab-link-news"):
        title = a.get_text(strip=True)
        url = a.get("href", "")
        if not title or not url.startswith("http"):
            continue
        rows.append(Row(
            id=row_id("finviz", url),
            source="finviz",
            tickers=extract_tickers(title),
            title=title,
            url=url,
            published_at=datetime.utcnow(),
        ))
    print(f"  finviz: {len(rows)} articles")
    return rows

# COMMAND ----------

print("Fetching sources...")
all_rows = []
for name, url in RSS_SOURCES:
    try:
        all_rows.extend(fetch_rss(name, url))
    except Exception as e:
        print(f"  WARNING: {name} failed — {e}")

try:
    all_rows.extend(fetch_reddit())
except Exception as e:
    print(f"  WARNING: reddit failed — {e}")

try:
    all_rows.extend(fetch_finviz())
except Exception as e:
    print(f"  WARNING: finviz failed — {e}")

print(f"\nTotal fetched: {len(all_rows)} rows")

# COMMAND ----------

spark.sql(f"CREATE DATABASE IF NOT EXISTS {DATABASE}")

spark.sql(f"""
CREATE TABLE IF NOT EXISTS {TABLE} (
  id           STRING        NOT NULL,
  source       STRING        NOT NULL,
  tickers      ARRAY<STRING> NOT NULL,
  title        STRING        NOT NULL,
  url          STRING,
  published_at TIMESTAMP,
  ingested_at  TIMESTAMP
)
USING DELTA
PARTITIONED BY (source)
""")

# COMMAND ----------

incoming = (
    spark.createDataFrame(all_rows)
    .withColumn("ingested_at", current_timestamp())
    .dropDuplicates(["id"])
)

(
    DeltaTable.forName(spark, TABLE)
    .alias("t")
    .merge(incoming.alias("s"), "t.id = s.id")
    .whenNotMatchedInsertAll()
    .execute()
)

count = spark.table(TABLE).count()
print(f"news_raw total rows: {count}")
