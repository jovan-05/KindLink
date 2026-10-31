"""Step 2: Qloo tag search per keyword; the LLM proposes taste tags, then the agent tests each candidate
against Qloo in the actual city and keeps the one(s) that rank places best (self-correction)."""
from __future__ import annotations

import asyncio

from ... import llm
from ...qloo import endpoints as q
from ...qloo.endpoints import Tag
from .. import scoring
from ..context import Context

# Kill tests: 1-2 media-genre tags rank places best; place-genre tags dilute the signal.
TASTE_PREFIXES = ("urn:tag:genre:media:", "urn:tag:genre:music:", "urn:tag:theme:qloo:")
MAX_TASTE = 2
MAX_CANDIDATES = 4
PROBE_TAKE = 10
KEYWORD_PREFIX = "urn:tag:keyword:qloo:"
ORG_PREFIX = "urn:tag:category:place:"
# Tags that match the words but describe menu items, hotel features, nearby sights, etc.
NOISE = ("specialty_dish", "nearby_attraction", ":restaurant:", ":hotel:", "occupation:wikidata", "clothing")

SYSTEM = (
    "You are choosing Qloo taste tags for a fundraiser. From the candidate tag list, choose:\n"
    "- taste: 2-3 tag ids describing what the cause's SUPPORTERS ENJOY, best first. Must start with "
    "urn:tag:genre:media:, urn:tag:genre:music: or urn:tag:theme:qloo:. Prefer broad, central subjects "
    "(e.g. Animals, Dogs).\n"
    "- keyword: 0-2 ids starting with urn:tag:keyword:qloo: that match the cause's subject.\n"
    "- org: 0-3 ids starting with urn:tag:category:place: for organizations similar to the nonprofit itself.\n"
    "Only use ids copied exactly from the list."
)


def heuristic_pick(cands: list[Tag], keywords: list[str]) -> tuple[list[Tag], list[Tag], list[Tag]]:
    def kw_match(t: Tag) -> bool:
        return any(k.replace(" ", "_") in t.id or k in t.name.lower() for k in keywords)

    taste = [t for t in cands if t.id.startswith(TASTE_PREFIXES) and kw_match(t)][:MAX_CANDIDATES]
    kwt = [t for t in cands if t.id.startswith(KEYWORD_PREFIX) and kw_match(t)][:2]
    org = [t for t in cands if t.id.startswith(ORG_PREFIX) and kw_match(t)][:3]
    return taste, kwt, org


def _ids(data: object, key: str) -> list[str]:
    val = data.get(key) if isinstance(data, dict) else None
    return [str(v) for v in val] if isinstance(val, list) else []


def candidate_pool(proposed: list[Tag], heuristic: list[Tag], limit: int = MAX_CANDIDATES) -> list[Tag]:
    """The AI's picks first, then keyword matches; one tag per name ("Gardening" exists in several families)."""
    def key(t: Tag) -> str:  # "Children" and "Childrens" are the same idea
        return t.name.lower().rstrip("s")

    pool: list[Tag] = []
    for t in proposed + heuristic:
        if t.id.startswith(TASTE_PREFIXES) and key(t) not in {key(p) for p in pool}:
            pool.append(t)
    return pool[:limit]


async def run(ctx: Context) -> str:
    results = await asyncio.gather(*(q.find_tags(k, take=15) for k in ctx.keywords), return_exceptions=True)
    cands: dict[str, Tag] = {}
    for res in results:
        if isinstance(res, BaseException):
            continue
        for t in res:
            if not any(n in t.id for n in NOISE):
                cands.setdefault(t.id, t)
    if not cands:
        ctx.data_notes.append("Qloo tag search found no tags for this cause; picks rely on supporter interests only.")
        return "No matching taste tags found"
    ctx.note("tags", f"Qloo tag search returned {len(cands)} candidate tags for {len(ctx.keywords)} keywords.")

    listing = "\n".join(f"{t.id} | {t.name}" for t in list(cands.values())[:90])
    proposed: list[Tag] = []
    kwt: list[Tag] = []
    org: list[Tag] = []
    try:
        data, model = await llm.chat_json(
            SYSTEM,
            f'Cause: "{ctx.inp.cause}"\nKeywords: {", ".join(ctx.keywords)}\nCandidates:\n{listing}\n'
            'Return {"taste": [ids], "keyword": [ids], "org": [ids]}',
            max_tokens=500,
        )
        ctx.llm_models.add(model)
        # Grounding: keep only ids that Qloo actually returned.
        proposed = [cands[i] for i in _ids(data, "taste") if i in cands and i.startswith(TASTE_PREFIXES)]
        kwt = [cands[i] for i in _ids(data, "keyword") if i in cands and i.startswith(KEYWORD_PREFIX)][:2]
        org = [cands[i] for i in _ids(data, "org") if i in cands and i.startswith(ORG_PREFIX)][:3]
    except Exception:  # noqa: BLE001
        pass
    h_taste, h_kw, h_org = heuristic_pick(list(cands.values()), ctx.keywords)
    if proposed:
        ctx.note("tags", "AI proposed: " + ", ".join(dict.fromkeys(t.name for t in proposed[:4])) + ".")
    else:
        ctx.llm_fallbacks.append("tag selection")
        ctx.note("tags", "AI tag choice unavailable; proposing tags by keyword match instead.")
        kwt, org = kwt or h_kw, org or h_org

    pool = candidate_pool(proposed, h_taste)
    taste = await self_check(ctx, pool, proposed)
    if not taste and kwt:
        taste = kwt[:1]
        ctx.note("tags", f"Falling back to keyword tag '{taste[0].name}'.")
    names = {t.name.lower() for t in taste}
    kwt = [t for t in kwt if t.name.lower() not in names]
    ctx.taste_tags, ctx.keyword_tags, ctx.org_tags = taste, kwt, org
    if not taste:
        ctx.data_notes.append("No usable taste tag matched this cause.")
        return "No usable taste tags"
    return "Taste tags: " + ", ".join(t.name for t in taste)


async def self_check(ctx: Context, pool: list[Tag], proposed: list[Tag]) -> list[Tag]:
    """Test each candidate tag against Qloo places in the actual city and keep the one(s) that rank best.
    A tag Qloo ignores here (every affinity 0.765) is dropped even if the AI liked it."""
    if not pool:
        return []
    probes = await asyncio.gather(
        *(q.insights("place", tags=[t.id], location=ctx.location, take=PROBE_TAKE) for t in pool),
        return_exceptions=True,
    )
    scored: list[tuple[Tag, float]] = []
    for t, res in zip(pool, probes):
        if isinstance(res, BaseException):
            ctx.note("tags", f"Tested '{t.name}': Qloo error, skipped.")
            continue
        quality, score = scoring.probe_score(res)
        if quality in ("flat", "empty"):
            ctx.note("tags", f"Tested '{t.name}': Qloo ignored it in {ctx.inp.city} (no ranking). Dropped.")
        else:
            ctx.note("tags", f"Tested '{t.name}': top {ctx.inp.city} places score {score:.2f}.")
        scored.append((t, score))
    chosen = scoring.pick_tags(scored, max_keep=MAX_TASTE)
    if not chosen:
        ctx.note("tags", "No candidate tag ranked places here; results may be thin.")
        return []
    names = ", ".join(f"'{t.name}'" for t in chosen)
    first = proposed[0] if proposed else None
    if first and first.id not in {t.id for t in chosen}:
        ctx.note("tags", f"Switched from '{first.name}' to {names}: stronger Qloo ranking.")
    else:
        ctx.note("tags", f"Kept {names}: strongest Qloo ranking.")
    return chosen
