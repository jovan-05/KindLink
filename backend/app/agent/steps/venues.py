"""Step 4: place insights in the city; LLM keeps the event-suitable ones (top 6) with a reason."""
from __future__ import annotations

import asyncio
import re
import time

from ... import llm
from ...qloo import endpoints as q
from ...qloo.endpoints import Entity
from .. import scoring
from ..context import Context, Section
from .common import has_signal, pick, thin

KEEP = 6
# The whole step must finish inside the pipeline's step timeout (50s). Free LLMs can be slow, so the
# screening call gets whatever is left of this budget and falls back to rule-based screening.
STEP_BUDGET_S = 45.0
MIN_SCREEN_S = 5.0
# Event-suitable Qloo place categories (filter.tags is OR). Without this the pool fills with hotels,
# shops and tourist attractions whenever the taste tag is broad (e.g. "Music").
VENUE_CATEGORIES = [
    "urn:tag:category:place:event_venue", "urn:tag:category:place:banquet_hall",
    "urn:tag:category:place:live_music_venue", "urn:tag:category:place:brewery",
    "urn:tag:category:place:beer_garden", "urn:tag:category:place:winery", "urn:tag:category:place:bar",
    "urn:tag:category:place:art_gallery", "urn:tag:category:place:museum", "urn:tag:category:place:park",
    "urn:tag:category:place:community_center",
]
UNSUITABLE = re.compile(
    r"fast food|gas station|bank|pharmacy|supermarket|grocery|convenience|car wash|auto |dentist|clinic|"
    r"hospital|laundromat|storage|apartment|fraternity|sorority|school district|urgent care|atm|parking|"
    # Places a small nonprofit can't book for a fundraiser.
    r"stadium|ballpark|arena|cathedral|basilica|church|temple|mosque|synagogue|cemetery|airport",
    re.I,
)
SYSTEM = (
    "You are scouting venues for a nonprofit fundraiser. For each candidate place decide if it could host "
    "the event (dog parks, breweries, event spaces, museums, gardens, music venues, restaurants with private "
    "rooms: yes; fast-food chains, banks, shops with no space, private residences: no). Consider the guest "
    "count and budget: avoid huge arenas for small groups and luxury venues on a shoestring. Pick the best up to 6 and give a one-line reason (max 20 words) for each, grounded in the place's "
    "tags/description. Candidates are listed best first by Qloo taste affinity: prefer the top ones and only "
    "skip a high-ranked place if it truly cannot host an event. Use only the given ids."
)


def heuristic_suitable(e: Entity) -> bool:
    text = " ".join([e.name, *e.tags, e.description or ""])
    return not UNSUITABLE.search(text)


async def run(ctx: Context) -> str:
    if not has_signal(ctx):
        ctx.sections["venues"] = thin("No taste signal to rank venues with.")
        return "Skipped: no taste signal"
    t0 = time.monotonic()
    signal = ctx.signal_label()
    # Two pools: event-type categories, plus the unfiltered top (which catches cause-specific places
    # like dog parks). The screening step below picks from the merged, re-ranked list.
    focused, wide = await asyncio.gather(
        q.insights("place", tags=ctx.tag_ids, entities=ctx.entity_ids, location=ctx.location,
                   filter_tags=VENUE_CATEGORIES, take=20, explain=bool(ctx.entity_ids)),
        q.insights("place", tags=ctx.tag_ids, entities=ctx.entity_ids, location=ctx.location,
                   take=15, explain=bool(ctx.entity_ids)),
        return_exceptions=True,
    )
    if isinstance(focused, BaseException) and isinstance(wide, BaseException):
        raise focused
    ents = [] if isinstance(focused, BaseException) else list(focused)
    seen = {e.id for e in ents}
    ents += [e for e in ([] if isinstance(wide, BaseException) else wide) if e.id not in seen]
    quality = scoring.signal_quality(ents)
    n_focus = 0 if isinstance(focused, BaseException) else len(focused)
    ctx.note("venues", f"Pulled {n_focus} event-type places and {len(ents) - n_focus} more top matches in {ctx.inp.city}.")
    if quality in ("flat", "empty") and ctx.keyword_tags:
        ctx.note("venues", "Taste tags didn't rank places here; retrying with keyword tags.")
        # Retry with the keyword tags; sometimes genre tags are too sparse for a city.
        alt = await q.insights("place", tags=[t.id for t in ctx.keyword_tags], entities=ctx.entity_ids,
                               location=ctx.location, take=25)
        if scoring.signal_quality(alt) not in ("flat", "empty"):
            ents, quality, signal = alt, scoring.signal_quality(alt), ctx.signal_label(ctx.keyword_tags)
    ctx.venue_pool = ents
    if quality in ("flat", "empty"):
        ctx.sections["venues"] = thin(
            f"Qloo returned no ranked places for {ctx.inp.city} with this signal (all affinities identical).",
            quality, signal)
        return "Not enough data for venues"

    ranked = [e for e in scoring.rank(ents, quality) if not scoring.is_unscored(e)]
    # Short ids: free models garble UUIDs.
    by_id = {f"V{i + 1}": e for i, e in enumerate(ranked)}
    chosen: list[tuple[Entity, str]] = []
    try:
        listing = "\n".join(
            f"{sid} | {e.name} | {', '.join(e.tags[:6])} | {(e.description or '')[:120]}" for sid, e in by_id.items()
        )
        budget = max(MIN_SCREEN_S, STEP_BUDGET_S - (time.monotonic() - t0))
        data, model = await asyncio.wait_for(llm.chat_json(
            SYSTEM,
            f"Cause: {ctx.inp.cause}\nCity: {ctx.inp.city}\nGuests: {ctx.inp.guests}\nBudget: {ctx.inp.budget}\n"
            f"Candidates:\n{listing}\n"
            'Return {"venues": [{"id": "...", "reason": "..."}]}',
            max_tokens=900,
        ), budget)
        ctx.llm_models.add(model)
        for item in (data.get("venues") or []) if isinstance(data, dict) else []:
            e = by_id.get(str(item.get("id", ""))) if isinstance(item, dict) else None
            if e and all(e.id != c.id for c, _ in chosen):
                chosen.append((e, str(item.get("reason", ""))[:200]))
    except Exception:  # noqa: BLE001
        pass
    if chosen:
        kept = {c.id for c, _ in chosen}
        dropped = [e.name for e in ranked[:8] if e.id not in kept][:3]
        ctx.note("venues", f"AI screened {len(ranked)} places for event fit and guest count; kept {min(len(chosen), KEEP)}."
                 + (f" Passed over: {', '.join(dropped)}." if dropped else ""))
    if not chosen:
        ctx.llm_fallbacks.append("venue screening")
        ctx.note("venues", "AI screening unavailable; filtered out unsuitable place types by rule.")
        chosen = [(e, "") for e in ranked if heuristic_suitable(e)][:KEEP]
    # Keep Qloo's ranking order among the chosen ones.
    order = {e.id: i for i, e in enumerate(ranked)}
    chosen = sorted(chosen[:KEEP], key=lambda c: order.get(c[0].id, 99))
    items = [pick(ctx, e, quality, signal, reason) for e, reason in chosen]
    sec = Section(items=items, quality=quality, signal=signal)
    if len(items) < 3:
        sec.status = "thin"
        sec.note = f"Only {len(items)} event-suitable places matched."
    ctx.sections["venues"] = sec
    return f"{len(items)} venues shortlisted from {len(ents)} places"
