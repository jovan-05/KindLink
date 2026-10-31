"""Step 10: LLM-only plan with the same inputs and no Qloo data, for the comparison tab.

Its picks are shown labeled "no data" and are never mixed into the KindLink plan.
"""
from __future__ import annotations

from typing import Any

from .. import llm
from .context import PlanInput

SYSTEM = "You are an event planner for small nonprofits. Suggest a fundraising event plan."
PROMPT = """Nonprofit: {cause}
City: {city}. Guests: {guests}. Budget: {budget}. Preferred month: {month}.
Supporter interests: {interests}
Return JSON: {{"event_name": "...", "concept": "2 sentences",
 "venues": [{{"name": "...", "reason": "..."}}], "performers": [{{"name": "...", "reason": "..."}}],
 "sponsors": [{{"name": "...", "reason": "..."}}], "promotion": [{{"name": "...", "reason": "..."}}]}}
3-5 items per list. Keep reasons under 15 words."""


def _items(v: Any) -> list[dict[str, str]]:
    out = []
    for i in v if isinstance(v, list) else []:
        if isinstance(i, dict) and i.get("name"):
            out.append({"name": str(i["name"])[:100], "reason": str(i.get("reason", ""))[:200]})
        elif isinstance(i, str):
            out.append({"name": i[:100], "reason": ""})
    return out[:5]


async def run(inp: PlanInput) -> dict[str, Any]:
    try:
        data, model = await llm.chat_json(
            SYSTEM,
            PROMPT.format(cause=inp.cause, city=inp.city, guests=inp.guests, budget=inp.budget,
                          month=inp.month or "any", interests=", ".join(inp.interests) or "not given"),
            max_tokens=1200, temperature=0.7,
        )
        if not isinstance(data, dict):
            raise llm.LLMError("baseline not an object")
        return {
            "status": "ok", "model": model,
            "event_name": str(data.get("event_name", ""))[:120],
            "concept": str(data.get("concept", ""))[:600],
            **{k: _items(data.get(k)) for k in ("venues", "performers", "sponsors", "promotion")},
        }
    except Exception as exc:  # noqa: BLE001
        return {"status": "failed", "note": f"The generic AI plan could not be generated ({type(exc).__name__}).",
                "venues": [], "performers": [], "sponsors": [], "promotion": []}
