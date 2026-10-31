"""Helpers shared by the data steps."""
from __future__ import annotations

import re
from typing import Any

from ...qloo.endpoints import Entity
from .. import scoring
from ..context import Context, Section


# Wikidata-style category tags on brands ("2015 mergers and acquisitions", "Companies based in Phoenix").
NOISY_TAG = re.compile(r"\d|compan|based in|establishment|merger|acquisition|portfolio|listed on|subsidiar", re.I)


def clean_tags(tags: list[str]) -> list[str]:
    return [t for t in tags if not NOISY_TAG.search(t)]


def pick(ctx: Context, e: Entity, quality: scoring.Quality, signal: str, reason: str = "",
         **extra: Any) -> dict[str, Any]:
    ev = scoring.evidence(e, signal, quality)
    ev["explain"] = ctx.explain_names(e.explain)
    return {
        "id": e.id,
        "name": e.name,
        "kind": e.subtype.split(":")[-1] if e.subtype else "",
        "address": e.address,
        "neighborhood": e.neighborhood,
        "lat": e.lat,
        "lon": e.lon,
        "image": e.image,
        "website": e.website,
        "description": (e.description or "")[:240] or None,
        "tags": clean_tags(e.tags)[:6],
        "popularity_tier": scoring.popularity_tier(e.popularity),
        "evidence": ev,
        "reason": reason,
        **extra,
    }


def thin(note: str, quality: str = "", signal: str = "") -> Section:
    return Section(status="thin", note=note, quality=quality, signal=signal)


def has_signal(ctx: Context) -> bool:
    return bool(ctx.signal_tags or ctx.interest_entities)
