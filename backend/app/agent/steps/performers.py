"""Step 5: artist insights with budget-based popularity banding. Top 5."""
from __future__ import annotations

from ...qloo import endpoints as q
from .. import scoring
from ..context import Context, Section
from .common import has_signal, pick, thin

KEEP = 5


async def run(ctx: Context) -> str:
    if not has_signal(ctx):
        ctx.sections["performers"] = thin("No taste signal to match performers with.")
        return "Skipped: no taste signal"
    lo, hi = scoring.popularity_band(ctx.inp.budget)
    signal = ctx.signal_label()
    ents = await q.insights("artist", tags=ctx.tag_ids, entities=ctx.entity_ids,
                            popularity_min=lo, popularity_max=hi, take=20, explain=bool(ctx.entity_ids))
    quality = scoring.signal_quality(ents)
    ctx.note("performers", f"{ctx.inp.budget.capitalize()} budget → popularity band {lo or 0:.2f}-{hi or 1:.2f} (popularity as a fee proxy).")
    ctx.note("performers", "Qloo ignores the city filter for artists (kill test #2), so these are taste matches, not local acts.")
    if quality in ("flat", "empty"):
        ctx.sections["performers"] = thin("Qloo found no artists that rank on this taste signal.", quality, signal)
        return "Not enough data for performers"
    ranked = [e for e in scoring.rank(ents, quality) if not scoring.is_unscored(e)][:KEEP]
    band = f"{ctx.inp.budget} budget: popularity {lo or 0:.2f}-{hi or 1:.2f}"
    items = [pick(ctx, e, quality, signal) for e in ranked]
    ctx.sections["performers"] = Section(
        items=items, quality=quality, signal=signal,
        note="Matched on taste, not location: Qloo's artist insights ignore the city filter, so check availability.",
        extra={"band": band},
    )
    return f"{len(items)} performers in the {ctx.inp.budget} popularity band"
