"""Step 9: LLM writes the plan from Qloo results only; the grounding check then strips invented names."""
from __future__ import annotations

import json
import re
import logging
from typing import Any

from .. import llm
from .context import Context
from .grounding import Grounder, normalize

log = logging.getLogger("kindlink.compose")

SECTIONS = ("venues", "performers", "sponsors", "neighborhoods", "promotion")

SYSTEM = """You are KindLink, an event strategist for small nonprofits. Write a fundraising event plan
using ONLY the Qloo data provided. Rules:
- You may only name places, artists, brands, podcasts, shows or neighborhoods that appear in the data.
- Every time you name one in free text, wrap it exactly as [[Name]].
- Refer to picks by their "id" in id fields.
- Be concrete, warm and practical. Keep every text field short (1-3 sentences) unless stated.
- Do not invent statistics. Do not mention donors by name."""

SCHEMA = """Return JSON:
{
 "event_name": "short catchy name (no entity names unless from data, wrapped in [[ ]])",
 "tagline": "one line",
 "concept": "2-3 sentences",
 "format": "e.g. 'Saturday afternoon outdoor social with live music, 3 hours'",
 "date_window": "suggested date window, respecting preferred month if given",
 "taste_summary": "2 sentences: what these supporters enjoy, citing the taste tags",
 "headline_venue_id": "id from venues",
 "headline_performer_id": "id from performers or null",
 "reasons": {"<id>": "why this pick fits (max 20 words)"},
 "run_of_show": [{"time": "5:00 PM", "title": "...", "detail": "..."}],
 "promotion_angles": [{"id": "<promotion id>", "angle": "outreach idea, max 25 words"}],
 "sponsor_pitch": {
   "subject": "email subject",
   "opening": "2 sentences introducing the cause and event",
   "audience": "2 sentences on audience overlap, citing the evidence",
   "benefits": ["3-4 short sponsor benefits"],
   "ask": "1-2 sentence call to action"
 }
}
run_of_show should have 5-7 entries."""


PREFIX = {"venues": "V", "performers": "P", "sponsors": "S", "neighborhoods": "N", "promotion": "M"}


def _brief(ctx: Context) -> tuple[dict[str, Any], dict[str, str], dict[str, str]]:
    """The data the LLM sees, with short ids (V1, P2...) since free models garble UUIDs.
    Returns (brief, short_id -> real_id, short_id -> name)."""
    id_map: dict[str, str] = {}
    name_map: dict[str, str] = {}
    data: dict[str, Any] = {
        "nonprofit": {
            "cause": ctx.inp.cause, "city": ctx.inp.city, "guests": ctx.inp.guests,
            "budget": ctx.inp.budget, "preferred_month": ctx.inp.month,
        },
        "taste_tags": [t.name for t in ctx.taste_tags + ctx.keyword_tags],
        "supporter_interests_in_qloo": [t.name for t in ctx.interest_tags] + [e.name for e in ctx.interest_entities],
    }
    for name in SECTIONS:
        sec = ctx.sections.get(name)
        if not sec or not sec.items:
            data[name] = "NOT ENOUGH DATA"
            continue
        rows = []
        for n, i in enumerate(sec.items, 1):
            sid = f"{PREFIX[name]}{n}"
            id_map[sid] = i["id"]
            name_map[sid] = i["name"]
            rows.append({
                "id": sid, "name": i["name"],
                **({"type": i["sponsor_type"]} if "sponsor_type" in i else {}),
                **({"channel": i["channel"]} if "channel" in i else {}),
                "tags": i.get("tags", [])[:4],
                "affinity": i["evidence"].get("affinity"),
                "popularity_tier": i.get("popularity_tier"),
                **({"screening_note": i["reason"]} if i.get("reason") else {}),
            })
        data[name] = rows
    return data, id_map, name_map


SHORT_ID = re.compile(r"\b([VPSNM]\d{1,2})\b")


def replace_short_ids(value: Any, names: dict[str, str]) -> Any:
    """Free models sometimes write "P1 plays a set" in prose; swap short ids for the real names."""
    if isinstance(value, str):
        return SHORT_ID.sub(lambda m: names.get(m.group(1), m.group(0)), value)
    if isinstance(value, list):
        return [replace_short_ids(v, names) for v in value]
    if isinstance(value, dict):
        return {k: (v if k in ("id",) or k.endswith("_id") else replace_short_ids(v, names)) for k, v in value.items()}
    return value


def remap_ids(raw: dict[str, Any], id_map: dict[str, str]) -> dict[str, Any]:
    """Translate short ids in the LLM reply back to Qloo ids. Unknown short ids pass through
    unchanged and are then dropped (and logged) by the grounding check."""
    def m(v: Any) -> Any:
        return id_map.get(v, v) if isinstance(v, str) else v

    out = dict(raw)
    for key in ("headline_venue_id", "headline_performer_id"):
        out[key] = m(raw.get(key))
    if isinstance(raw.get("reasons"), dict):
        out["reasons"] = {m(k): v for k, v in raw["reasons"].items()}
    if isinstance(raw.get("promotion_angles"), list):
        out["promotion_angles"] = [
            {**a, "id": m(a.get("id"))} if isinstance(a, dict) else a for a in raw["promotion_angles"]
        ]
    return out


def allowed_names(ctx: Context) -> list[str]:
    names = [t.name for t in ctx.taste_tags + ctx.keyword_tags + ctx.org_tags + ctx.interest_tags]
    names += [e.name for e in ctx.interest_entities]
    names += [ctx.inp.city]
    for sec in ctx.sections.values():
        names += [i["name"] for i in sec.items]
    return names


def allowed_ids(ctx: Context) -> set[str]:
    return {i["id"] for sec in ctx.sections.values() for i in sec.items}


def ground_plan(raw: dict[str, Any], ctx: Context) -> tuple[dict[str, Any], list[dict[str, str]], list[str]]:
    """Apply the grounding check to an LLM plan.
    Returns (clean_plan, removed_names, verified_entity_names)."""
    g = Grounder.from_names(allowed_names(ctx))
    ids = allowed_ids(ctx)
    t = g.text
    plan: dict[str, Any] = {
        # A coined title can't be "invented"; but a venue name hidden in it still gets removed.
        "event_name": t(raw.get("event_name"), "event_name", unwrap_unknown=True) or f"{ctx.inp.city} Supporters Social",
    }
    # The (already grounded) event name may be repeated in other fields.
    g.allowed.setdefault(normalize(plan["event_name"]), plan["event_name"])
    plan |= {
        "tagline": t(raw.get("tagline"), "tagline"),
        "concept": t(raw.get("concept"), "concept"),
        "format": t(raw.get("format"), "format"),
        "date_window": t(raw.get("date_window"), "date_window"),
        "taste_summary": t(raw.get("taste_summary"), "taste_summary"),
    }
    for key in ("headline_venue_id", "headline_performer_id"):
        val = raw.get(key)
        kept = g.ids([val], ids, key) if val else []
        plan[key] = kept[0] if kept else None

    reasons = raw.get("reasons") if isinstance(raw.get("reasons"), dict) else {}
    plan["reasons"] = {k: t(v, f"reasons.{k}") for k, v in reasons.items() if k in ids}
    for k in reasons:
        if k not in ids:
            g.removed.append({"name": str(k), "field": "reasons"})

    ros = raw.get("run_of_show") if isinstance(raw.get("run_of_show"), list) else []
    plan["run_of_show"] = [
        {"time": t(r.get("time"), "run_of_show"), "title": t(r.get("title"), "run_of_show"),
         "detail": t(r.get("detail"), "run_of_show")}
        for r in ros[:8] if isinstance(r, dict) and r.get("title")
    ]
    angles = raw.get("promotion_angles") if isinstance(raw.get("promotion_angles"), list) else []
    plan["promotion_angles"] = [
        {"id": a["id"], "angle": t(a.get("angle"), "promotion_angles")}
        for a in angles if isinstance(a, dict) and a.get("id") in ids
    ]
    pitch = raw.get("sponsor_pitch") if isinstance(raw.get("sponsor_pitch"), dict) else {}
    plan["sponsor_pitch"] = {
        "subject": t(pitch.get("subject"), "pitch"),
        "opening": t(pitch.get("opening"), "pitch"),
        "audience": t(pitch.get("audience"), "pitch"),
        "benefits": [t(b, "pitch") for b in (pitch.get("benefits") or [])[:5] if isinstance(b, str)],
        "ask": t(pitch.get("ask"), "pitch"),
    }
    # Entities (not tags or the city) the plan refers to, by name in text or by id.
    id_names = {i["id"]: i["name"] for sec in ctx.sections.values() for i in sec.items}
    entity_names = set(id_names.values()) | {e.name for e in ctx.interest_entities}
    referenced = [plan["headline_venue_id"], plan["headline_performer_id"], *plan["reasons"],
                  *(a["id"] for a in plan["promotion_angles"])]
    verified = {n for n in g.verified if n in entity_names} | {id_names[i] for i in referenced if i in id_names}
    return plan, g.removed, sorted(verified)


def fallback_plan(ctx: Context) -> dict[str, Any]:
    """Deterministic plan used when the LLM is unavailable. Only uses Qloo names."""
    venues = ctx.sections.get("venues")
    performers = ctx.sections.get("performers")
    v = venues.items[0] if venues and venues.items else None
    p = performers.items[0] if performers and performers.items else None
    tags = ", ".join(t.name for t in ctx.taste_tags) or "the cause"
    return {
        "event_name": f"{ctx.inp.city} Supporters Social",
        "tagline": f"An evening built around what {ctx.inp.city} supporters already love.",
        "concept": f"A relaxed fundraiser for {ctx.inp.guests} guests" + (f" at [[{v['name']}]]" if v else "")
                   + f", designed around the taste signal: {tags}.",
        "format": "3-hour evening social with a short program",
        "date_window": ctx.inp.month or "Within the next 8-10 weeks",
        "taste_summary": f"Qloo links this cause's supporters to {tags}.",
        "headline_venue_id": v["id"] if v else None,
        "headline_performer_id": p["id"] if p else None,
        "reasons": {},
        "run_of_show": [
            {"time": "6:00 PM", "title": "Doors open", "detail": "Check-in and welcome drinks."},
            {"time": "6:30 PM", "title": "Mission moment", "detail": "Short talk about the cause."},
            {"time": "7:00 PM", "title": "Live set", "detail": f"[[{p['name']}]]" if p else "Local music."},
            {"time": "8:00 PM", "title": "Appeal", "detail": "Fund-a-need ask."},
            {"time": "8:45 PM", "title": "Thank-yous", "detail": "Sponsor recognition and close."},
        ],
        "promotion_angles": [],
        "sponsor_pitch": {
            "subject": f"Partner with us on a {ctx.inp.city} fundraiser",
            "opening": f"We're planning a fundraiser for {ctx.inp.guests} guests in {ctx.inp.city}.",
            "audience": f"Qloo taste data links our supporters to {tags}, which overlaps with your customers.",
            "benefits": ["Logo on event materials", "On-stage thank-you", "Booth or sampling table"],
            "ask": "Could we set up a 15-minute call next week?",
        },
    }


async def run(ctx: Context) -> tuple[dict[str, Any], list[dict[str, str]], list[str], bool]:
    """Returns (plan, removed_names, verified_entity_names, used_llm)."""
    brief_data, id_map, name_map = _brief(ctx)
    brief = json.dumps(brief_data, ensure_ascii=False)
    try:
        raw, model = await llm.chat_json(SYSTEM, f"DATA:\n{brief}\n\n{SCHEMA}", max_tokens=2500, temperature=0.5)
        ctx.llm_models.add(model)
        if not isinstance(raw, dict):
            raise llm.LLMError("plan is not an object")
        raw = replace_short_ids(raw, name_map)
        plan, removed, verified = ground_plan(remap_ids(raw, id_map), ctx)
        if removed:
            log.info("grounding removed %d names: %s", len(removed), [r["name"] for r in removed])
        return plan, removed, verified, True
    except Exception as exc:  # noqa: BLE001
        log.warning("compose fell back to template: %s", exc)
        ctx.llm_fallbacks.append("plan writing")
        plan, removed, verified = ground_plan(fallback_plan(ctx), ctx)
        return plan, removed, verified, False
