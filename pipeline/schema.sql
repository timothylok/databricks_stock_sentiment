CREATE TABLE IF NOT EXISTS sentiment_scores (
  article_id       TEXT NOT NULL,
  ticker           TEXT NOT NULL,
  source           TEXT NOT NULL,
  title            TEXT NOT NULL,
  title_normalized TEXT NOT NULL,
  published_at     TEXT,
  compound         REAL,
  pos              REAL,
  neu              REAL,
  neg              REAL,
  scored_at        TEXT,
  model            TEXT,
  PRIMARY KEY (article_id, ticker)
);
CREATE INDEX IF NOT EXISTS idx_scores_ticker_pub ON sentiment_scores (ticker, published_at);
CREATE INDEX IF NOT EXISTS idx_scores_norm ON sentiment_scores (title_normalized);

CREATE TABLE IF NOT EXISTS sentiment_daily (
  ticker         TEXT NOT NULL,
  date           TEXT NOT NULL,
  avg_compound   REAL,
  article_count  INTEGER,
  positive_count INTEGER,
  negative_count INTEGER,
  neutral_count  INTEGER,
  computed_at    TEXT,
  PRIMARY KEY (ticker, date)
);

CREATE TABLE IF NOT EXISTS ticker_summary (
  ticker              TEXT PRIMARY KEY,
  avg_compound_today  REAL,
  avg_compound_7d     REAL,
  avg_compound_30d    REAL,
  article_count_today INTEGER,
  top_positive_title  TEXT,
  top_negative_title  TEXT,
  last_updated        TEXT
);
