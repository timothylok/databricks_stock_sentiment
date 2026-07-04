# Databricks notebook source
# COMMAND ----------

# MAGIC %pip install vaderSentiment==3.3.2

# COMMAND ----------

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from pyspark.sql.types import FloatType, StructField, StructType
from delta.tables import DeltaTable
from datetime import date, timedelta

# COMMAND ----------

DATABASE = "stock_sentiment"
CLEAN_TABLE   = f"{DATABASE}.news_clean"
SCORES_TABLE  = f"{DATABASE}.sentiment_scores"
DAILY_TABLE   = f"{DATABASE}.sentiment_daily"
SUMMARY_TABLE = f"{DATABASE}.ticker_summary"

RECOMPUTE_DAYS = 30
POS_THRESHOLD  =  0.05
NEG_THRESHOLD  = -0.05

# COMMAND ----------

score_schema = StructType([
    StructField("compound", FloatType()),
    StructField("pos",      FloatType()),
    StructField("neu",      FloatType()),
    StructField("neg",      FloatType()),
])

@F.udf(score_schema)
def vader_score(text: str):
    # SentimentIntensityAnalyzer is cheap to construct; its lexicon is cached at the module level
    s = SentimentIntensityAnalyzer().polarity_scores(text or "")
    return (float(s["compound"]), float(s["pos"]), float(s["neu"]), float(s["neg"]))

# COMMAND ----------
# MAGIC %md ### Step 1 — Score new articles

# COMMAND ----------

clean = spark.table(CLEAN_TABLE).filter(F.size("tickers") > 0)

if spark.catalog.tableExists(SCORES_TABLE):
    already = spark.table(SCORES_TABLE).select("article_id").distinct()
    to_score = clean.join(already, clean.id == already.article_id, "left_anti")
else:
    to_score = clean

new_count = to_score.count()
print(f"Articles to score: {new_count}")

# COMMAND ----------

if new_count > 0:
    # Score once per article, then explode → one row per (article, ticker)
    scored = (
        to_score
        .withColumn("s",        vader_score("title_normalized"))
        .withColumn("compound", F.col("s.compound"))
        .withColumn("pos",      F.col("s.pos"))
        .withColumn("neu",      F.col("s.neu"))
        .withColumn("neg",      F.col("s.neg"))
        .drop("s", "title_normalized")
        .withColumn("ticker", F.explode("tickers"))
        .drop("tickers")
        .withColumn("scored_at", F.current_timestamp())
        .select(
            F.col("id").alias("article_id"),
            "ticker", "source", "title", "published_at",
            "compound", "pos", "neu", "neg", "scored_at",
        )
    )

    spark.sql(f"""
    CREATE TABLE IF NOT EXISTS {SCORES_TABLE} (
      article_id   STRING    NOT NULL,
      ticker       STRING    NOT NULL,
      source       STRING    NOT NULL,
      title        STRING    NOT NULL,
      published_at TIMESTAMP,
      compound     FLOAT,
      pos          FLOAT,
      neu          FLOAT,
      neg          FLOAT,
      scored_at    TIMESTAMP
    )
    USING DELTA
    PARTITIONED BY (ticker)
    """)

    (
        DeltaTable.forName(spark, SCORES_TABLE)
        .alias("t")
        .merge(scored.alias("s"), "t.article_id = s.article_id AND t.ticker = s.ticker")
        .whenNotMatchedInsertAll()
        .execute()
    )

print(f"sentiment_scores total: {spark.table(SCORES_TABLE).count() if spark.catalog.tableExists(SCORES_TABLE) else 0}")

# COMMAND ----------
# MAGIC %md ### Step 2 — Recompute daily aggregates

# COMMAND ----------

cutoff = date.today() - timedelta(days=RECOMPUTE_DAYS)

daily = (
    spark.table(SCORES_TABLE)
    .filter(F.col("published_at") >= F.lit(cutoff.isoformat()))
    .withColumn("date", F.to_date("published_at"))
    .groupBy("ticker", "date")
    .agg(
        F.round(F.avg("compound"), 4).alias("avg_compound"),
        F.count("*").alias("article_count"),
        F.sum(F.when(F.col("compound") >= POS_THRESHOLD, 1).otherwise(0)).alias("positive_count"),
        F.sum(F.when(F.col("compound") <= NEG_THRESHOLD, 1).otherwise(0)).alias("negative_count"),
        F.sum(F.when(
            (F.col("compound") > NEG_THRESHOLD) & (F.col("compound") < POS_THRESHOLD), 1
        ).otherwise(0)).alias("neutral_count"),
        F.current_timestamp().alias("computed_at"),
    )
)

(
    daily.write.format("delta")
    .mode("overwrite")
    .option("replaceWhere", f"date >= '{cutoff.isoformat()}'")
    .saveAsTable(DAILY_TABLE)
)

print(f"sentiment_daily rows (last {RECOMPUTE_DAYS}d): {daily.count()}")

# COMMAND ----------
# MAGIC %md ### Step 3 — Rebuild ticker_summary

# COMMAND ----------

today     = date.today()
scores    = spark.table(SCORES_TABLE)

def window_avg(days: int, col_alias: str):
    cutoff_str = (today - timedelta(days=days)).isoformat()
    return (
        scores.filter(F.col("published_at") >= F.lit(cutoff_str))
        .groupBy("ticker")
        .agg(
            F.round(F.avg("compound"), 4).alias(col_alias),
            F.count("*").alias(f"article_count_{days}d"),
        )
    )

today_agg = window_avg(1,  "avg_compound_today")
week_agg  = window_avg(7,  "avg_compound_7d")
month_agg = window_avg(30, "avg_compound_30d")

# Top positive and negative headlines in the last 7 days
w7 = scores.filter(F.col("published_at") >= F.lit((today - timedelta(days=7)).isoformat()))
ticker_w = Window.partitionBy("ticker")

headlines = (
    w7
    .withColumn("max_compound", F.max("compound").over(ticker_w))
    .withColumn("min_compound", F.min("compound").over(ticker_w))
    .withColumn("top_pos", F.when(F.col("compound") == F.col("max_compound"), F.col("title")))
    .withColumn("top_neg", F.when(F.col("compound") == F.col("min_compound"), F.col("title")))
    .groupBy("ticker")
    .agg(
        F.first("top_pos", ignorenulls=True).alias("top_positive_title"),
        F.first("top_neg", ignorenulls=True).alias("top_negative_title"),
    )
)

summary = (
    today_agg
    .join(week_agg.drop("article_count_7d"),  "ticker", "left")
    .join(month_agg.drop("article_count_30d"), "ticker", "left")
    .join(headlines, "ticker", "left")
    .withColumnRenamed("article_count_1d", "article_count_today")
    .withColumn("last_updated", F.current_timestamp())
)

(
    summary.write.format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .saveAsTable(SUMMARY_TABLE)
)

print(f"ticker_summary rows: {summary.count()}")
display(spark.table(SUMMARY_TABLE))
