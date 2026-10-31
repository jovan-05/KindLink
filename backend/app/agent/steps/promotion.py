"""Step 8: podcast and TV-show insights for outreach angles. Top 5 combined."""
from __future__ import annotations

import asyncio

from ...qloo import endpoints as q
from .. import scoring
from ..context import Context, Section
from .common import has_signal, pick, thin

KEEP = 5


async def run(ctx: Context) -> str:
    if not has_signal(ctx):
        ctx.sections["promotion"] = thin("No taste signal for promotion channels.")
        return "Skipped: no taste signal"
    tags = ctx.tag_ids + [t.id for t in ctx.keyword_tags[:1]]
    signal = ctx.signal_label(ctx.signal_tags + ctx.keyword_tags[:1])
    pods, tv = await asyncio.gather(
        q.insights("podcast", tags=tags, entities=ctx.entity_ids, take=10),
        q.insights("tv_show", tags=tags, entities=ctx.entity_ids, take=10),
        return_exceptions=True,
    )
    lists = []
    for res, label in ((pods, "podcast"), (tv, "tv_show")):
        if isinstance(res, BaseException):
            continue
        quality = scoring.signal_quality(res)
        if quality in ("flat", "empty"):
            ctx.note("promotion", f"Qloo didn't rank any {label.replace('_', ' ')}s for this signal; channel skipped.")
            continue
        ranked = [e for e in scoring.rank(res, quality) if not scoring.is_unscored(e)]
        lists.append([pick(ctx, e, quality, signal, channel=label) for e in ranked])
    # Interleave podcasts and shows so both channels are represented.
    items = []
    for i in range(10):
        for lst in lists:
            if i < len(lst) and len(items) < KEEP:
                items.append(lst[i])
    if not items:
        ctx.sections["promotion"] = thin("Qloo returned no ranked podcasts or shows for this signal.", "", signal)
        return "Not enough data for promotion"
    ctx.sections["promotion"] = Section(items=items, quality="ranked", signal=signal)
    return f"{len(items)} podcasts and shows for outreach"
