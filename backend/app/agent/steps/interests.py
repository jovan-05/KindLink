"""Step 3: resolve free-text supporter interests to Qloo signals.

Genre-like interests ("indie folk", "craft beer") become tags; titles ("Marley & Me") become entities.
"""
from __future__ import annotations

import asyncio
import re

from ...qloo import endpoints as q
from ...qloo.endpoints import Entity, Tag
from ..context import Context
from ..grounding import normalize

# Places/localities are city-specific; a generic interest ("farmers markets") matches a random one.
SKIP_TYPES = ("urn:entity:place", "urn:entity:locality")
# Tag families usable as a taste signal, best first.
TAG_PREFIXES = ("urn:tag:genre:music:", "urn:tag:genre:media:", "urn:tag:keyword:qloo:")


def _singular(s: str) -> str:
    return re.sub(r"s\b", "", s)


def match_tag(text: str, tags: list[Tag]) -> Tag | None:
    want = _singular(normalize(text))
    hits = [t for t in tags if t.id.startswith(TAG_PREFIXES) and _singular(normalize(t.name)) == want]
    return min(hits, key=lambda t: next(i for i, p in enumerate(TAG_PREFIXES) if t.id.startswith(p)), default=None)


def match_entity(text: str, ents: list[Entity]) -> Entity | None:
    ents = [e for e in ents if e.subtype not in SKIP_TYPES and e.id]
    want = normalize(text)
    exact = next((e for e in ents if normalize(e.name) == want), None)
    if exact:
        return exact
    words = {w for w in want.split() if len(w) > 2}
    return next((e for e in ents if words & set(normalize(e.name).split())), None)


async def run(ctx: Context) -> str:
    if not ctx.inp.interests:
        return "No supporter interests given (optional)"
    searches = await asyncio.gather(
        *(asyncio.gather(q.find_tags(i, take=10), q.search_entities(i, take=5), return_exceptions=True)
          for i in ctx.inp.interests)
    )
    for text, (tags, ents) in zip(ctx.inp.interests, searches):
        tag = match_tag(text, [] if isinstance(tags, BaseException) else tags)
        if tag:
            ctx.note("interests", f"'{text}' matched Qloo taste tag '{tag.name}'.")
            if tag.id not in {t.id for t in ctx.interest_tags}:
                ctx.interest_tags.append(tag)
            continue
        ent = match_entity(text, [] if isinstance(ents, BaseException) else ents)
        if ent:
            kind = ent.subtype.split(":")[-1].replace("_", " ") or "entity"
            ctx.note("interests", f"'{text}' matched Qloo {kind} '{ent.name}'.")
            if ent.id not in ctx.entity_ids:
                ctx.interest_entities.append(ent)
            continue
        ctx.unresolved_interests.append(text)
        ctx.note("interests", f"'{text}': no reliable Qloo match, left out rather than guessed.")
    if ctx.unresolved_interests:
        ctx.data_notes.append("Could not match these interests in Qloo: " + ", ".join(ctx.unresolved_interests))
    matched = [t.name for t in ctx.interest_tags] + [e.name for e in ctx.interest_entities]
    return "Matched: " + ", ".join(matched) if matched else "No interests matched in Qloo"
