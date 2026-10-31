"""Pre-run the three example causes and save them to data/examples/*.json (and Postgres if configured)
so they load instantly on the landing page. Also warms the Qloo cache.

Usage: python scripts/precache_examples.py [austin chicago nyc]
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import store  # noqa: E402
from app.agent import pipeline  # noqa: E402
from app.examples import EXAMPLES  # noqa: E402


async def main() -> None:
    wanted = set(sys.argv[1:]) or {e["key"] for e in EXAMPLES}
    for ex in EXAMPLES:
        if ex["key"] not in wanted:
            continue
        print(f"-> {ex['title']} ({ex['city_label']})")
        async for ev in pipeline.run(ex["input"], plan_id=ex["id"]):
            if ev["type"] == "step" and ev["status"] != "running":
                print(f"   {ev['status']:6s} {ev['label']}: {ev['message']}")
            elif ev["type"] == "result":
                plan = ev["plan"]
                await store.save(plan)
                path = store.save_example_file(plan)
                print(f"   saved {path.name} ({plan['meta']['seconds']}s, fallbacks={plan['meta']['llm_fallbacks']})")


asyncio.run(main())
