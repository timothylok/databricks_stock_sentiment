# Databricks notebook source
# COMMAND ----------

import html
import re
from pyspark.sql import functions as F
from pyspark.sql.types import ArrayType, StringType
from delta.tables import DeltaTable

# COMMAND ----------

DATABASE = "stock_sentiment"
SOURCE_TABLE = f"{DATABASE}.news_raw"
TARGET_TABLE = f"{DATABASE}.news_clean"

TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "AMD", "NFLX", "SPY"]
TICKER_PATTERN = re.compile(r"\b(" + "|".join(TICKERS) + r")\b")

# Company name → ticker for enrichment beyond raw symbol matching
COMPANY_MAP = {
    "apple": "AAPL",
    "microsoft": "MSFT",
    "google": "GOOGL",
    "alphabet": "GOOGL",
    "amazon": "AMZN",
    "tesla": "TSLA",
    "meta platforms": "META",
    "facebook": "META",
    "nvidia": "NVDA",
    "netflix": "NFLX",
}
COMPANY_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in COMPANY_MAP) + r")\b"
)

# COMMAND ----------

@F.udf(StringType())
def clean_title(title: str) -> str:
    if not title:
        return None
    t = html.unescape(title)           # decode &amp; &quot; etc.
    t = re.sub(r"\s+", " ", t).strip()
    return t


@F.udf(ArrayType(StringType()))
def enrich_tickers(title: str, existing: list) -> list:
    """Adds company-name matches on top of the symbol matches from ingestion."""
    found = set(existing or [])
    if title:
        found.update(TICKER_PATTERN.findall(title))
        for match in COMPANY_PATTERN.findall(title.lower()):
            ticker = COMPANY_MAP.get(match)
            if ticker:
                found.add(ticker)
    return sorted(found)

# COMMAND ----------

# Incremental: skip rows already in news_clean
raw = spark.table(SOURCE_TABLE)

if spark.catalog.tableExists(TARGET_TABLE):
    incoming = raw.join(spark.table(TARGET_TABLE).select("id"), on="id", how="left_anti")
else:
    incoming = raw

new_count = incoming.count()
print(f"Rows to process: {new_count}")
if new_count == 0:
    dbutils.notebook.exit("news_clean is already up to date")

# COMMAND ----------

cleaned = (
    incoming
    .withColumn("title", clean_title(F.col("title")))
    .filter(F.length("title") >= 10)
    .withColumn("tickers", enrich_tickers(F.col("title"), F.col("tickers")))
    # title_normalized is for dedup + NLP input: lowercase, punctuation stripped
    .withColumn(
        "title_normalized",
        F.trim(F.regexp_replace(F.lower(F.col("title")), r"[^a-z0-9\s]", " "))
    )
    .withColumn(
        "title_normalized",
        F.regexp_replace(F.col("title_normalized"), r"\s+", " ")
    )
    # Within this batch, collapse near-identical headlines from different sources
    .dropDuplicates(["title_normalized"])
    .withColumn("cleaned_at", F.current_timestamp())
    .select("id", "source", "tickers", "title", "title_normalized", "url", "published_at", "cleaned_at")
)

print(f"After dedup + filtering: {cleaned.count()} rows")

# COMMAND ----------

spark.sql(f"""
CREATE TABLE IF NOT EXISTS {TARGET_TABLE} (
  id               STRING        NOT NULL,
  source           STRING        NOT NULL,
  tickers          ARRAY<STRING> NOT NULL,
  title            STRING        NOT NULL,
  title_normalized STRING        NOT NULL,
  url              STRING,
  published_at     TIMESTAMP,
  cleaned_at       TIMESTAMP
)
USING DELTA
PARTITIONED BY (source)
""")

(
    DeltaTable.forName(spark, TARGET_TABLE)
    .alias("t")
    .merge(cleaned.alias("s"), "t.id = s.id")
    .whenNotMatchedInsertAll()
    .execute()
)

total = spark.table(TARGET_TABLE).count()
print(f"news_clean total rows: {total}")
