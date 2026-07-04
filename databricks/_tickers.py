# Databricks notebook source
# COMMAND ----------

# MAGIC %md
# MAGIC Single source of truth for tracked tickers. Included via `%run ./_tickers`
# MAGIC from `ingest_news.py` and `clean_news.py` so both stay in sync.

# COMMAND ----------

import re

# COMMAND ----------

TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "AMD", "SPY", "XLE", "RKLB", "SPCX"]
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
    "rocket lab": "RKLB",
}
COMPANY_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in COMPANY_MAP) + r")\b"
)
