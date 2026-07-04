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
from pyspark.sql.types import StructType, StructField, StringType, ArrayType, TimestampType
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

# Explicit schema — spark.createDataFrame can't infer an ARRAY<STRING> column's
# element type when every row's tickers list happens to be empty in a batch.
ROW_SCHEMA = StructType([
    StructField("id",           StringType(), nullable=False),
    StructField("source",       StringType(), nullable=False),
    StructField("tickers",      ArrayType(StringType()), nullable=False),
    StructField("title",        StringType(), nullable=False),
    StructField("url",          StringType(), nullable=True),
    StructField("published_at", TimestampType(), nullable=True),
])

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


def fetch_finviz() -> list[Row]:
    resp = requests.get("https://finviz.com/news.ashx", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    rows = []
    for a in soup.select("a.nn-tab-link"):
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
    all_rows.extend(fetch_finviz())
except Exception as e:
    print(f"  WARNING: finviz failed — {e}")

print(f"\nTotal fetched: {len(all_rows)} rows")
if len(all_rows) == 0:
    dbutils.notebook.exit("No articles fetched from any source — skipping")

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
    spark.createDataFrame(all_rows, schema=ROW_SCHEMA)
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
