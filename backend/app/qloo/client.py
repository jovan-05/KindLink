"""Qloo HTTP client: auth header, <=4 req/s, retry with backoff on 429/5xx, 7-day cache.

The API key is only read from config here and is never logged or returned.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from typing import Any

import httpx

from .. import cache, config
from ..http import SSL_CONTEXT

log = logging.getLogger("kindlink.qloo")

MAX_RPS = 4
MAX_RETRIES = 4


class QlooError(Exception):
    pass


class _RateLimiter:
    """Sliding window: at most MAX_RPS requests in any 1-second window."""

    def __init__(self, rps: int) -> None:
        self.rps = rps
        self.stamps: list[float] = []
        self.lock = asyncio.Lock()

    async def wait(self) -> None:
        async with self.lock:
            while True:
                now = time.monotonic()
                self.stamps = [t for t in self.stamps if now - t < 1.0]
                if len(self.stamps) < self.rps:
                    self.stamps.append(now)
                    return
                await asyncio.sleep(1.0 - (now - self.stamps[0]) + 0.01)


_limiter = _RateLimiter(MAX_RPS)
_client: httpx.AsyncClient | None = None
stats = {"network": 0, "cached": 0}


def cache_key(path: str, params: dict[str, Any]) -> str:
    items = "&".join(f"{k}={params[k]}" for k in sorted(params))
    return "qloo:" + hashlib.sha256(f"{path}?{items}".encode()).hexdigest()


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=config.QLOO_BASE_URL,
            timeout=config.QLOO_TIMEOUT_S,
            verify=SSL_CONTEXT,
            headers={"X-Api-Key": config.QLOO_API_KEY, "Accept": "application/json"},
        )
    return _client


async def get(path: str, params: dict[str, Any], timeout: float | None = None) -> dict[str, Any]:
    if not config.QLOO_API_KEY:
        raise QlooError("QLOO_API_KEY is not configured")
    params = {k: v for k, v in params.items() if v is not None and v != ""}
    key = cache_key(path, params)
    hit = await cache.get(key)
    if hit is not None:
        stats["cached"] += 1
        return hit

    delay = 0.5
    last = ""
    for attempt in range(MAX_RETRIES + 1):
        await _limiter.wait()
        try:
            stats["network"] += 1
            resp = await _http().get(path, params=params, timeout=timeout or config.QLOO_TIMEOUT_S)
        except httpx.HTTPError as exc:
            last = type(exc).__name__
        else:
            if resp.status_code == 200:
                data = resp.json()
                await cache.set(key, data, config.CACHE_TTL_S)
                return data
            if resp.status_code != 429 and resp.status_code < 500:
                # 4xx other than 429: not retryable. Don't cache errors.
                raise QlooError(f"{path} -> HTTP {resp.status_code}: {resp.text[:200]}")
            last = f"HTTP {resp.status_code}"
            retry_after = resp.headers.get("retry-after")
            if retry_after and retry_after.isdigit():
                delay = max(delay, float(retry_after))
        if attempt < MAX_RETRIES:
            log.info("qloo retry %s %s (%s)", attempt + 1, path, last)
            await asyncio.sleep(delay)
            delay *= 2
    raise QlooError(f"{path} failed after retries: {last}")
