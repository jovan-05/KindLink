"""Key/value cache for Qloo responses. Postgres when DATABASE_URL is set, else in-memory."""
from __future__ import annotations

import json
import time
from typing import Any

from . import db

_memory: dict[str, tuple[float, Any]] = {}


async def get(key: str) -> Any | None:
    pool = await db.pool()
    if pool is not None:
        try:
            row = await pool.fetchrow(
                "SELECT value FROM qloo_cache WHERE key = $1 AND expires_at > now()", key
            )
            return json.loads(row["value"]) if row else None
        except Exception:
            pass  # fall through to memory
    hit = _memory.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    return None


async def set(key: str, value: Any, ttl_s: int) -> None:
    _memory[key] = (time.time() + ttl_s, value)
    pool = await db.pool()
    if pool is None:
        return
    try:
        await pool.execute(
            """INSERT INTO qloo_cache (key, value, expires_at)
               VALUES ($1, $2, now() + make_interval(secs => $3))
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at""",
            key, json.dumps(value), float(ttl_s),
        )
    except Exception:
        pass
