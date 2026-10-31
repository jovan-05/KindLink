"""Orchestrates the 10 steps in docs/SPEC.md (plus a visible grounding check) and yields status events.

Every step event carries `notes`: the agent's decision lines for that step ("Tested 'Adoption': ...",
"Switched to 'Dogs' ..."), so the UI can show why the agent did what it did.
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import datetime, timezone
from typing import Any

from . import baseline, compose
from .context import Context, PlanInput, Section
from .steps import interests, neighborhoods, performers, promotion, sponsors, tags, understand, venues

log = logging.getLogger("kindlink.pipeline")

STEP_TIMEOUT_S = 50
COMPOSE_TIMEOUT_S = 100

STEPS: list[tuple[str, str]] = [
    ("understand", "Understanding your cause"),
    ("tags", "Finding and testing taste tags"),
    ("interests", "Matching supporter interests"),
    ("venues", "Scouting venues"),
    ("performers", "Finding performers"),
    ("sponsors", "Spotting local sponsors"),
    ("neighborhoods", "Mapping the best neighborhoods"),
    ("promotion", "Planning promotion channels"),
    ("compose", "Writing your event plan"),
    ("verify", "Checking every name against Qloo"),
    ("baseline", "Drafting a generic AI plan for comparison"),
]
LABELS = dict(STEPS)
DATA_STEPS: dict[str, Callable[[Context], Awaitable[str]]] = {
    "venues": venues.run, "performers": performers.run, "sponsors": sponsors.run,
    "neighborhoods": neighborhoods.run, "promotion": promotion.run,
}


class _Log:
    """Builds the step events and keeps the final state of each step for the stored agent log."""

    def __init__(self, ctx: Context) -> None:
        self.ctx = ctx
        self.final: dict[str, dict[str, Any]] = {}

    def event(self, step: str, status: str, message: str = "") -> dict[str, Any]:
        ev = {"type": "step", "step": step, "label": LABELS.get(step, step), "status": status,
              "message": message, "notes": list(self.ctx.decisions.get(step, []))}
        if status != "running":
            self.final[step] = ev
        return ev

    def ordered(self) -> list[dict[str, Any]]:
        """Final state of every step, with notes re-read (some are added after a step's event)."""
        out = []
        for s, _ in STEPS:
            if s in self.final:
                ev = {k: v for k, v in self.final[s].items() if k != "type"}
                ev["notes"] = list(self.ctx.decisions.get(s, []))
                out.append(ev)
        return out


async def _guard(name: str, coro: Awaitable[str], ctx: Context, timeout: float = STEP_TIMEOUT_S) -> tuple[str, str, str]:
    """Run a step; never raise. Returns (name, status, message)."""
    try:
        msg = await asyncio.wait_for(coro, timeout)
        sec = ctx.sections.get(name)
        return name, ("thin" if sec and sec.status == "thin" else "done"), msg
    except asyncio.TimeoutError:
        msg = "Timed out"
    except Exception as exc:  # noqa: BLE001
        log.warning("step %s failed: %s", name, exc)
        msg = "Data source error"
    if name in DATA_STEPS:
        ctx.sections[name] = Section(status="failed", note=f"This section could not be loaded ({msg.lower()}).")
    ctx.note(name, f"Step failed ({msg.lower()}); the section is marked instead of guessed.")
    return name, "failed", msg


def _dedupe_sponsors(ctx: Context) -> None:
    venues_sec, sponsors_sec = ctx.sections.get("venues"), ctx.sections.get("sponsors")
    if venues_sec and sponsors_sec:
        vids = {i["id"] for i in venues_sec.items}
        before = len(sponsors_sec.items)
        sponsors_sec.items = [i for i in sponsors_sec.items if i["id"] not in vids]
        if len(sponsors_sec.items) < before:
            ctx.note("sponsors", f"Removed {before - len(sponsors_sec.items)} sponsor(s) already chosen as venues.")


def _data_notes(ctx: Context) -> list[str]:
    notes = list(ctx.data_notes)
    for name in DATA_STEPS:
        sec = ctx.sections.get(name)
        if sec and sec.status != "ok":
            notes.append(f"{name.capitalize()}: {sec.note or 'not enough data'}")
        elif sec and sec.note:
            notes.append(f"{name.capitalize()}: {sec.note}")
    if ctx.llm_fallbacks:
        notes.append("The AI model was unavailable for: " + ", ".join(ctx.llm_fallbacks)
                     + ". Rule-based fallbacks were used; all names still come from Qloo.")
    return notes


def _verify_notes(ctx: Context, verified: list[str], removed: list[dict[str, str]], picks: int) -> str:
    for r in removed:
        ctx.note("verify", f"Removed '{r['name']}' from {r['field']}: not in the Qloo results.")
    if verified:
        shown = ", ".join(verified[:6]) + (f" and {len(verified) - 6} more" if len(verified) > 6 else "")
        ctx.note("verify", f"Verified: {shown}.")
    ctx.note("verify", f"All {picks} picks on the page come straight from Qloo responses.")
    checked = len(verified) + len(removed)
    return f"Checked {checked} names the AI wrote: {len(verified)} verified, {len(removed)} removed"


async def run(inp: PlanInput, plan_id: str | None = None) -> AsyncIterator[dict[str, Any]]:
    """Yields step events, then {"type": "result", "plan": {...}}."""
    t0 = time.time()
    ctx = Context(inp=inp)
    lg = _Log(ctx)
    plan_id = plan_id or uuid.uuid4().hex[:12]
    base_task = asyncio.create_task(baseline.run(inp))

    # Steps 1-2 are sequential; step 3 (interest search) runs alongside them.
    yield lg.event("understand", "running")
    yield lg.event("interests", "running")
    interests_task = asyncio.create_task(_guard("interests", interests.run(ctx), ctx))
    name, status, msg = await _guard("understand", understand.run(ctx), ctx)
    yield lg.event(name, status, msg)
    yield lg.event("tags", "running")
    name, status, msg = await _guard("tags", tags.run(ctx), ctx)
    yield lg.event(name, status, msg)
    name, status, msg = await interests_task
    yield lg.event(name, status, msg)

    # Steps 4-8 are independent once the signal is known; run concurrently, report as each finishes.
    for step in DATA_STEPS:
        yield lg.event(step, "running")
    for fut in asyncio.as_completed([_guard(n, fn(ctx), ctx) for n, fn in DATA_STEPS.items()]):
        name, status, msg = await fut
        yield lg.event(name, status, msg)
    _dedupe_sponsors(ctx)

    yield lg.event("compose", "running")
    try:
        plan, removed, verified, used_llm = await asyncio.wait_for(compose.run(ctx), COMPOSE_TIMEOUT_S)
    except asyncio.TimeoutError:
        ctx.llm_fallbacks.append("plan writing")
        plan, removed, verified = compose.ground_plan(compose.fallback_plan(ctx), ctx)
        used_llm = False
    if used_llm:
        ctx.note("compose", "AI wrote the plan from Qloo data only, naming picks by id (V1, P2...).")
    else:
        ctx.note("compose", "AI unavailable; built a template plan from the Qloo results.")
    yield lg.event("compose", "done" if used_llm else "thin",
                   "Plan written" if used_llm else "Template plan (AI model unavailable)")

    # The grounding check already ran inside compose; this step makes it visible.
    yield lg.event("verify", "running")
    picks = sum(len(sec.items) for sec in ctx.sections.values())
    msg = _verify_notes(ctx, verified, removed, picks)
    yield lg.event("verify", "done", msg)

    yield lg.event("baseline", "running")
    try:
        base = await asyncio.wait_for(base_task, COMPOSE_TIMEOUT_S)
    except asyncio.TimeoutError:
        base = {"status": "failed", "note": "Timed out.", "venues": [], "performers": [], "sponsors": [], "promotion": []}
    ok = base.get("status") == "ok"
    if ok:
        ctx.note("baseline", "Same inputs, no Qloo data: its names are unverified and shown labeled 'no data'.")
    yield lg.event("baseline", "done" if ok else "failed", "Generic plan ready" if ok else "Generic plan unavailable")

    result = {
        "id": plan_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "inputs": inp.model_dump(),
        "profile": {
            "keywords": ctx.keywords,
            "taste_tags": [t.to_dict() for t in ctx.taste_tags],
            "keyword_tags": [t.to_dict() for t in ctx.keyword_tags],
            "org_tags": [t.to_dict() for t in ctx.org_tags],
            "interests": [{"id": t.id, "name": t.name, "type": "tag"} for t in ctx.interest_tags]
            + [{"id": e.id, "name": e.name, "type": e.subtype} for e in ctx.interest_entities],
            "unresolved_interests": ctx.unresolved_interests,
        },
        "sections": {n: (ctx.sections.get(n) or Section(status="failed", note="Not run")).to_dict() for n in DATA_STEPS},
        "plan": plan,
        "baseline": base,
        "grounding": {"checked": len(verified) + len(removed), "verified": verified, "removed": removed,
                      "picks": picks},
        "agent_log": lg.ordered(),
        "data_notes": _data_notes(ctx),
        "meta": {"seconds": round(time.time() - t0, 1), "models": sorted(ctx.llm_models),
                 "llm_fallbacks": ctx.llm_fallbacks},
    }
    yield {"type": "result", "plan": result}
