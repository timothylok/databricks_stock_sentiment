"""Single source of truth for tracked tickers and name matching."""

import re

TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "AMD", "SPY", "XLE", "RKLB", "SPCX", "NET", "TSM", "AVGO", "ASTS", "QQQ", "JPM", "ORCL", "CRWV", "MU", "MRVL", "INTC", "SMCI"]
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
    "meta": "META",
    "spacex": "SPCX",
    "space exploration technologies": "SPCX",
    "nvidia": "NVDA",
    "rocket lab": "RKLB",
    "cloudflare": "NET",
    "tsmc": "TSM",
    "taiwan semiconductor": "TSM",
    "broadcom": "AVGO",
    "oracle": "ORCL",
    "coreweave": "CRWV",
    "micron": "MU",
    "marvell": "MRVL",
    "intel": "INTC",
    "super micro": "SMCI",
    "supermicro": "SMCI",
    "ast spacemobile": "ASTS",
    # Also tags "JPMorgan upgrades X" analyst-note headlines; accepted for coverage
    "jpmorgan": "JPM",
    "jp morgan": "JPM",
    # Index names: ETF tickers rarely appear literally in headlines
    "s&p 500": "SPY",
    "nasdaq 100": "QQQ",
    "energy stocks": "XLE",
    "energy sector": "XLE",
    "energy etf": "XLE",
    "energy etfs": "XLE",
}
COMPANY_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in COMPANY_MAP) + r")\b"
)
