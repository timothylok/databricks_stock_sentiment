# Daily Stock Sentiment Pipeline

Daily stock‑sentiment pipeline — RSS + Reddit ingestion → Databricks Delta → VADER scoring → Next.js 16 dashboard on Vercel

A lightweight, end‑to‑end proof‑of‑concept showing how to ingest financial news + Reddit discussions, store them in Delta Lake, compute sentiment, and visualize trends in a modern Next.js dashboard.

## 🚀 Features

- Daily ingestion from RSS feeds + Reddit API
- Databricks Delta Lake storage for clean, queryable data
- VADER sentiment scoring (finance‑friendly lexicon)
- Next.js 16 App Router dashboard
- Vercel deployment with serverless API routes
- Cron-job.org scheduled refresh hitting `/api/refresh`
- Interactive charts for sentiment over time
- Minimal, modular codebase — easy to extend

## 🧭 Architecture Overview

```
┌──────────────────────────┐
│        RSS Feeds         │
└─────────────┬────────────┘
              │
┌─────────────▼────────────┐
│        Ingestion          │
│  (Python on Databricks)   │
└─────────────┬────────────┘
              │
┌─────────────▼────────────┐
│     Delta Lake Tables     │
│  clean_news / sentiment   │
└─────────────┬────────────┘
              │
┌─────────────▼────────────┐
│     Next.js API Routes    │
│   (fetch from Databricks) │
└─────────────┬────────────┘
              │
┌─────────────▼────────────┐
│         Dashboard         │
│   Vercel Deployment       │
└──────────────────────────┘
```

## 📂 Project Structure

```
databricks_stock_sentiment/
├── databricks/
│   ├── ingest_news.py
│   ├── clean_news.py
│   └── sentiment.py
├── nextjs/
│   ├── app/
│   ├── components/
│   └── lib/
└── README.md
```

## ⚙️ Getting Started

### Prerequisites

- Node.js 18+
- Databricks workspace
- Vercel account
- Cron-job.org (optional for scheduling)

### Environment Variables

Create `nextjs/.env.local`:

```
DATABRICKS_HOST=
DATABRICKS_TOKEN=
DATABRICKS_SQL_HTTP_PATH=
DATABRICKS_JOB_ID=
CRON_SECRET=
```

### Run the dashboard locally

```bash
cd nextjs
npm install
npm run dev
```

### Run ingestion (Databricks)

Import the repo into a Databricks workspace via Repos, then run the notebooks in order:

1. `databricks/ingest_news.py` — pulls RSS + Reddit, writes to `news_raw`
2. `databricks/clean_news.py` — deduplicates and normalises, writes to `news_clean`
3. `databricks/sentiment.py` — scores headlines with VADER, aggregates to `sentiment_daily` and `ticker_summary`

## 🔄 Scheduled Refresh (cron-job.org)

Two cron jobs run daily:

1. **7:00am NZT** — `POST https://databricks-stock-sentiment.vercel.app/api/refresh` — triggers the Databricks ETL job
2. **7:30am NZT** — `POST https://databricks-stock-sentiment.vercel.app/api/refresh/complete` — invalidates the Next.js ISR cache after the job finishes

Both requests include `Authorization: Bearer <CRON_SECRET>`.

## 📊 Dashboard Preview

Live at: [https://databricks-stock-sentiment.vercel.app](https://databricks-stock-sentiment.vercel.app)

## 📈 Roadmap

- Add LLM sentiment scoring (FinBERT, GPT‑4o mini)
- Add Twitter/X ingestion
- Add multi‑ticker support
- Add Databricks Workflows instead of cron-job.org
- Add anomaly detection for sentiment spikes

## 🤝 Contributing

PRs welcome — please follow:

- Conventional commits
- Feature branches
- Prettier formatting

## 📜 License

MIT License

## 🙏 Acknowledgements

- [Databricks](https://databricks.com)
- [VADER Sentiment](https://github.com/cjhutto/vaderSentiment)
- [Next.js](https://nextjs.org)
- [Vercel](https://vercel.com)
- [cron-job.org](https://cron-job.org)
