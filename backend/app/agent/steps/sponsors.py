"""Step 6: local businesses likely to sponsor (cafés, bakeries, breweries, pet stores...) + brand insights."""
from __future__ import annotations

import asyncio

from ...qloo import endpoints as q
from .. import scoring
from ..context import Context, Section
from .common import has_signal, pick, thin

LOCAL_KEEP = 5
BRAND_KEEP = 3
SPONSOR_CATEGORIES = [
    "urn:tag:category:place:cafe",
    "urn:tag:category:place:coffee_shop",
    "urn:tag:category:place:bakery",
    "urn:tag:category:place:brewery",
    "urn:tag:category:place:pet_store",
    "urn:tag:category:place:book_store",
    "urn:tag:category:place:ice_cream_shop",
    "urn:tag:category:place:music_store",
]


async def run(ctx: Context) -> str:
    if not has_signal(ctx):
        ctx.sections["sponsors"] = thin("No taste signal to match sponsors with.")
        return "Skipped: no taste signal"
    signal = ctx.signal_label()
    local_res, brand_res = await asyncio.gather(
        q.insights("place", tags=ctx.tag_ids, entities=ctx.entity_ids, location=ctx.location,
                   filter_tags=SPONSOR_CATEGORIES, take=15),
        q.insights("brand", tags=ctx.tag_ids + [t.id for t in ctx.keyword_tags[:1]],
                   entities=ctx.entity_ids, take=10),
        return_exceptions=True,
    )
    items = []
    local_q = brand_q = "empty"
    if not isinstance(local_res, BaseException):
        local_q = scoring.signal_quality(local_res)
        if local_q not in ("flat", "empty"):
            for e in [e for e in scoring.rank(local_res, local_q) if not scoring.is_unscored(e)][:LOCAL_KEEP]:
                items.append(pick(ctx, e, local_q, signal, sponsor_type="local business"))
    if not isinstance(brand_res, BaseException):
        brand_q = scoring.signal_quality(brand_res)
        if brand_q not in ("flat", "empty"):
            for e in scoring.rank(brand_res, brand_q)[:BRAND_KEEP]:
                items.append(pick(ctx, e, brand_q, signal, sponsor_type="brand"))
    if brand_q == "saturated":
        ctx.note("sponsors", "Every brand scored affinity 1.00 (saturated), so brands are ordered by popularity instead.")
    # Chains appear once per location ("Mariano's" x2); keep the best-ranked one.
    unique: dict[str, dict] = {}
    for i in items:
        unique.setdefault(i["name"].lower(), i)
    if len(unique) < len(items):
        ctx.note("sponsors", f"Merged {len(items) - len(unique)} duplicate chain location(s).")
    items = list(unique.values())
    if not items:
        ctx.sections["sponsors"] = thin("Qloo returned no ranked sponsor candidates for this signal.",
                                        local_q, signal)
        return "Not enough data for sponsors"
    note = ""
    if brand_q == "saturated":
        note = "Brand matches all scored the maximum affinity, so brands are ordered by popularity."
    ctx.sections["sponsors"] = Section(items=items, quality=local_q, signal=signal, note=note)
    n_local = sum(1 for i in items if i["sponsor_type"] == "local business")
    return f"{n_local} local businesses, {len(items) - n_local} brands"
