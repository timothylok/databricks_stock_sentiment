"""Minimal Cloudflare D1 client over the REST API."""
import os

import requests

_URL = (
    "https://api.cloudflare.com/client/v4/accounts/"
    f"{os.environ.get('CLOUDFLARE_ACCOUNT_ID')}/d1/database/"
    f"{os.environ.get('CLOUDFLARE_D1_DATABASE_ID')}/query"
)
_HEADERS = {"Authorization": f"Bearer {os.environ.get('CLOUDFLARE_API_TOKEN')}"}
BATCH_SIZE = 50  # statements per request


def _post(body: dict) -> list[dict]:
    r = requests.post(_URL, headers=_HEADERS, json=body, timeout=60)
    if not r.ok:
        raise RuntimeError(f"D1 HTTP {r.status_code}: {r.text[:500]}")
    data = r.json()
    if not data.get("success"):
        raise RuntimeError(f"D1 error: {data.get('errors')}")
    return data["result"]


def query(sql: str, params: list | None = None) -> list[dict]:
    return _post({"sql": sql, "params": params or []})[0]["results"]


def batch(statements: list[tuple[str, list]]) -> None:
    """Runs statements in order, in chunks; each chunk is one transaction."""
    for i in range(0, len(statements), BATCH_SIZE):
        chunk = statements[i : i + BATCH_SIZE]
        _post({"batch": [{"sql": s, "params": p} for s, p in chunk]})
