"""Run the pipeline from the CLI and print a compact summary.

Usage: python scripts/run_plan.py [austin|chicago|nyc] [--json out.json]
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agent import pipeline  # noqa: E402
from app.examples import EXAMPLES  # noqa: E402
from app.qloo import client  # noqa: E402


def summarize(plan: dict) -> None:
    p = plan["plan"]
    print(f"\n=== {p['event_name']} ({plan['meta']['seconds']}s, models={plan['meta']['models']})")
    print("concept:", p["concept"])
    print("taste:", [t["name"] for t in plan["profile"]["taste_tags"]], "kw:", plan["profile"]["keywords"])
    for name, sec in plan["sections"].items():
        print(f"\n[{name}] status={sec['status']} quality={sec['quality']} {sec['note']}")
        for i in sec["items"]:
            ev = i["evidence"]
            print(f"   - {i['name'][:40]:40s} aff={ev['affinity']} pop={ev['popularity']} {i.get('reason','')[:60]}")
    print("\nrun_of_show:", [r["title"] for r in p["run_of_show"]])
    print("pitch subject:", p["sponsor_pitch"]["subject"])
    print("grounding removed:", plan["grounding"]["removed"])
    print("baseline:", plan["baseline"].get("event_name"), [v["name"] for v in plan["baseline"].get("venues", [])])
    print("notes:", plan["data_notes"])


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(name)s %(message)s")
    key = sys.argv[1] if len(sys.argv) > 1 else "austin"
    ex = next(e for e in EXAMPLES if e["key"] == key)
    async for ev in pipeline.run(ex["input"], plan_id=ex["id"]):
        if ev["type"] == "step":
            print(f"  {ev['status']:8s} {ev['label']}: {ev['message']}")
            if ev["status"] != "running":
                for n in ev.get("notes", []):
                    print(f"             - {n}")
        else:
            summarize(ev["plan"])
            if "--json" in sys.argv:
                out = sys.argv[sys.argv.index("--json") + 1]
                Path(out).write_text(json.dumps(ev["plan"], indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"\nqloo network={client.stats['network']} cached={client.stats['cached']}")


asyncio.run(main())
