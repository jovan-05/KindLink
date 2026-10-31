"""Step 1: extract 3-6 keywords from the cause description."""
from __future__ import annotations

import re

from ... import llm
from ..context import Context

STOP = set(
    "a an and the of for to in on at with that who which our we us is are be by from as this their they "
    "them it its into about nonprofit organization organisation charity free local helps help provide "
    "provides providing program programs serving serve serves through".split()
)

SYSTEM = (
    "You help a nonprofit fundraiser planner. Extract 3-6 short, lowercase keywords (1-2 words each) "
    "describing the cause's subject matter and what its supporters care about. Prefer concrete nouns "
    "useful for searching a taste database (e.g. 'dogs', 'animals', 'pets', 'rescue')."
)


def heuristic_keywords(cause: str) -> list[str]:
    words = [w for w in re.findall(r"[a-z]+", cause.lower()) if w not in STOP and len(w) > 2]
    return list(dict.fromkeys(words))[:5]


async def run(ctx: Context) -> str:
    kws: list[str] = []
    try:
        data, model = await llm.chat_json(
            SYSTEM, f'Cause: "{ctx.inp.cause}"\nReturn {{"keywords": [...]}}', max_tokens=300
        )
        ctx.llm_models.add(model)
        raw = data.get("keywords") if isinstance(data, dict) else data
        kws = [str(k).strip().lower() for k in (raw or []) if str(k).strip()]
        kws = [k for k in kws if len(k) <= 30][:6]
    except Exception:  # noqa: BLE001
        kws = []
    if len(kws) < 2:
        ctx.llm_fallbacks.append("keywords")
        ctx.note("understand", "AI unavailable; extracted keywords from the description directly.")
        kws = kws + heuristic_keywords(ctx.inp.cause)
    ctx.keywords = list(dict.fromkeys(kws))[:6]
    return "Keywords: " + ", ".join(ctx.keywords)
