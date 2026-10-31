"""Plan storage: Postgres when DATABASE_URL is set, else memory. Example plans also load from data/examples."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from . import db

log = logging.getLogger("kindlink.store")
EXAMPLES_DIR = Path(__file__).resolve().parents[1] / "data" / "examples"
MAX_MEMORY_PLANS = 500

_memory: dict[str, dict[str, Any]] = {}


def _load_example(plan_id: str) -> dict[str, Any] | None:
    path = EXAMPLES_DIR / f"{plan_id}.json"
    if path.is_file() and path.parent == EXAMPLES_DIR:
        return json.loads(path.read_text(encoding="utf-8"))
    return None


async def save(plan: dict[str, Any]) -> None:
    pid = plan["id"]
    _memory[pid] = plan
    while len(_memory) > MAX_MEMORY_PLANS:
        _memory.pop(next(iter(_memory)))
    pool = await db.pool()
    if pool is None:
        return
    try:
        await pool.execute(
            "INSERT INTO plans (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
            pid, json.dumps(plan, ensure_ascii=False),
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("plan save to Postgres failed: %s", type(exc).__name__)


async def get(plan_id: str) -> dict[str, Any] | None:
    if plan_id in _memory:
        return _memory[plan_id]
    pool = await db.pool()
    if pool is not None:
        try:
            row = await pool.fetchrow("SELECT data FROM plans WHERE id = $1", plan_id)
            if row:
                return json.loads(row["data"])
        except Exception as exc:  # noqa: BLE001
            log.warning("plan read from Postgres failed: %s", type(exc).__name__)
    if plan_id.startswith("example-"):
        return _load_example(plan_id)
    return None


def save_example_file(plan: dict[str, Any]) -> Path:
    EXAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    path = EXAMPLES_DIR / f"{plan['id']}.json"
    path.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")
    return path
