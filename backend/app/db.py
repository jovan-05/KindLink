"""Optional Postgres pool. Returns None when DATABASE_URL is unset or unreachable."""
from __future__ import annotations

import logging

from . import config

log = logging.getLogger("kindlink.db")
_pool = None
_failed = False

SCHEMA = """
CREATE TABLE IF NOT EXISTS qloo_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


async def pool():
    global _pool, _failed
    if _pool is not None or _failed or not config.DATABASE_URL:
        return _pool
    try:
        import asyncpg

        _pool = await asyncpg.create_pool(config.DATABASE_URL, min_size=1, max_size=5, timeout=10)
        await _pool.execute(SCHEMA)
        log.info("Postgres connected")
    except Exception as exc:  # noqa: BLE001
        _failed = True
        log.warning("Postgres unavailable, using memory: %s", type(exc).__name__)
    return _pool
