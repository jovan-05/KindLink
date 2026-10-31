"""Runs the "Not yet verified" checks from docs/QLOO_API.md against the live API.

Usage: .venv/Scripts/python scripts/kill_tests.py
Prints a compact table per check and flags results whose affinities are all identical.
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.qloo import client  # noqa: E402
from app.qloo.endpoints import affinities_identical, heatmap, insights, normalize_entity  # noqa: E402

CITY = "Austin"
TAG = "urn:tag:genre:media:animals"


def table(title: str, ents) -> str:
    lines = [f"\n### {title}"]
    if not ents:
        lines.append("  (no results)")
        return "\n".join(lines)
    flat = affinities_identical(ents)
    lines.append(f"  n={len(ents)}  identical_affinity={'YES (signal ignored?)' if flat else 'no'}")
    for e in ents[:8]:
        aff = f"{e.affinity:.3f}" if e.affinity is not None else "  -  "
        pop = f"{e.popularity:.3f}" if e.popularity is not None else "  -  "
        lines.append(f"  aff={aff} pop={pop}  {e.name[:48]}" + (f"  [{e.explain[0]}]" if e.explain else ""))
    return "\n".join(lines)


async def safe(title, coro):
    try:
        res = await coro
        print(table(title, res))
        return res
    except Exception as exc:  # noqa: BLE001
        print(f"\n### {title}\n  ERROR: {exc}")
        return None


async def main() -> None:
    # 1. Artist insights from a tag signal
    await safe("1. artists <- tag", insights("artist", tags=[TAG], take=10))
    # 2. Artist insights with location
    await safe("2. artists <- tag + location=Austin", insights("artist", tags=[TAG], location=CITY, take=10))
    # 3. Popularity banding
    await safe("3a. artists pop.max=0.5", insights("artist", tags=[TAG], popularity_max=0.5, take=10))
    await safe("3b. artists pop.min=0.9", insights("artist", tags=[TAG], popularity_min=0.9, take=10))
    # 4. Brands from tag
    await safe("4. brands <- tag", insights("brand", tags=[TAG], take=10))
    # 5. Podcast + TV from tag
    await safe("5a. podcasts <- tag", insights("podcast", tags=[TAG], take=10))
    await safe("5b. tv_shows <- tag", insights("tv_show", tags=[TAG], take=10))
    # 6. Heatmap in US city with tag
    try:
        raw = await client.get(
            "/v2/insights",
            {"filter.type": "urn:heatmap", "filter.location.query": CITY, "signal.interests.tags": TAG, "take": 50},
        )
        cells = (raw.get("results") or {}).get("heatmap") or []
        print("\n### 6. heatmap <- tag, Austin")
        print(f"  cells={len(cells)} sample={json.dumps(cells[:2])[:400]}")
        hc = await heatmap(CITY, tags=[TAG], take=50)
        affs = [c.affinity for c in hc]
        print(f"  parsed={len(hc)} identical_affinity={affinities_identical(affs)}"
              + (f" aff range {min(a for a in affs if a is not None):.3f}-{max(a for a in affs if a is not None):.3f}" if any(a is not None for a in affs) else ""))
    except Exception as exc:  # noqa: BLE001
        print(f"\n### 6. heatmap\n  ERROR: {exc}")
    # 7. filter.tags on places
    for ft in ("urn:tag:category:place:bar", "urn:tag:category:place:park", "urn:tag:category:place:brewery"):
        await safe(f"7. places <- tag, filter.tags={ft}", insights("place", tags=[TAG], location=CITY, filter_tags=[ft], take=10))
    # 8. Combining tag + entity (Marley & Me movie)
    marley = "1EB7BC58-738E-483A-9EB3-C165D1A85DE7"
    await safe("8a. places <- entity only", insights("place", entities=[marley], location=CITY, take=10))
    await safe("8b. places <- tag + entity", insights("place", tags=[TAG], entities=[marley], location=CITY, take=10))
    # 9. explainability
    try:
        raw = await client.get(
            "/v2/insights",
            {"filter.type": "urn:entity:place", "filter.location.query": CITY, "signal.interests.tags": TAG,
             "signal.interests.entities": marley, "feature.explainability": "true", "take": 3},
        )
        ents = (raw.get("results") or {}).get("entities") or []
        print("\n### 9. feature.explainability")
        if ents:
            print("  query block:", json.dumps(ents[0].get("query"))[:600])
            print("  parsed:", normalize_entity(ents[0]).explain)
        print("  top-level keys:", list(raw.keys()), list((raw.get("results") or {}).keys()))
    except Exception as exc:  # noqa: BLE001
        print(f"\n### 9. explainability\n  ERROR: {exc}")
    print(f"\nnetwork calls={client.stats['network']} cached={client.stats['cached']}")


if __name__ == "__main__":
    asyncio.run(main())
