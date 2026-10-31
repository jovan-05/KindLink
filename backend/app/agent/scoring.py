"""Signal-quality detection, ranking and evidence for Qloo result sets.

See docs/QLOO_API.md "How an ignored signal looks" for the observations behind these rules.
"""
from __future__ import annotations

import math
from typing import Literal, TypeVar

from ..qloo.endpoints import Entity

T = TypeVar("T")
Quality = Literal["ranked", "saturated", "flat", "empty"]

# Qloo returns exactly this affinity for rows the signal did not score.
UNSCORED_FLOOR = 0.765
SATURATED_MIN = 0.999
TOL = 1e-6

BUDGET_BANDS: dict[str, tuple[float | None, float | None]] = {
    # Observed: popularity >= ~0.95 is household names (The Who, Keith Richards), unbookable for a nonprofit.
    "shoestring": (None, 0.5),
    "modest": (0.3, 0.8),
    "generous": (0.55, 0.9),
}


def signal_quality(entities: list[Entity]) -> Quality:
    """Classify a result set: did the signal actually rank these results?"""
    if not entities:
        return "empty"
    affs = [e.affinity for e in entities if e.affinity is not None]
    if len(affs) < 2:
        return "flat" if len(entities) >= 2 else "ranked"
    if max(affs) - min(affs) > TOL:
        return "ranked"
    return "saturated" if affs[0] >= SATURATED_MIN else "flat"


def is_unscored(e: Entity) -> bool:
    return e.affinity is not None and abs(e.affinity - UNSCORED_FLOOR) < 1e-3


def rank(entities: list[Entity], quality: Quality | None = None) -> list[Entity]:
    """Order results best-first. Ranked sets use affinity (popularity breaks ties, unscored tail last);
    saturated sets use popularity; flat sets keep Qloo's order."""
    quality = quality or signal_quality(entities)
    if quality == "ranked":
        return sorted(
            entities,
            key=lambda e: (is_unscored(e), -(e.affinity or 0), -(e.popularity or 0)),
        )
    if quality == "saturated":
        return sorted(entities, key=lambda e: -(e.popularity or 0))
    return list(entities)


def probe_score(entities: list[Entity], top: int = 5) -> tuple[Quality, float]:
    """How well a single tag ranks places: mean affinity of the top scored results (0 if ignored)."""
    quality = signal_quality(entities)
    if quality in ("flat", "empty"):
        return quality, 0.0
    affs = sorted((e.affinity for e in entities if e.affinity is not None and not is_unscored(e)), reverse=True)
    if not affs:
        return "flat", 0.0
    return quality, sum(affs[:top]) / len(affs[:top])


def pick_tags(scored: list[tuple[T, float]], max_keep: int = 2, margin: float = 0.02) -> list[T]:
    """Keep the best-scoring tag plus runners-up within `margin` of it. Zero scores never count."""
    good = sorted([(t, s) for t, s in scored if s > 0], key=lambda x: -x[1])
    if not good:
        return []
    best = good[0][1]
    return [t for t, s in good if s >= best - margin][:max_keep]


def popularity_band(budget: str) -> tuple[float | None, float | None]:
    return BUDGET_BANDS.get(budget.lower(), BUDGET_BANDS["modest"])


def popularity_tier(pop: float | None) -> str:
    if pop is None:
        return "unknown"
    if pop >= 0.9:
        return "well known"
    if pop >= 0.6:
        return "established"
    if pop >= 0.3:
        return "emerging"
    return "grassroots"


def evidence(e: Entity, signal_label: str, quality: Quality) -> dict:
    """The evidence line shown on every card."""
    basis = "affinity" if quality == "ranked" and not is_unscored(e) else "popularity"
    return {
        "signal": signal_label,
        "affinity": round(e.affinity, 3) if e.affinity is not None else None,
        "popularity": round(e.popularity, 3) if e.popularity is not None else None,
        "basis": basis,
        "quality": quality,
        "explain": e.explain,
    }


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def hotspots(
    cells: list[tuple[float, float, float, float]],
    *,
    grid_deg: float = 0.02,
    top: int = 3,
    min_sep_km: float = 3.0,
) -> list[dict]:
    """Aggregate heatmap cells (lat, lon, affinity, popularity) into grid squares and return the
    top-scoring, well-separated squares. Score = mean(affinity * popularity) * sqrt(cell count)."""
    bins: dict[tuple[int, int], list[tuple[float, float, float]]] = {}
    for lat, lon, aff, pop in cells:
        key = (math.floor(lat / grid_deg), math.floor(lon / grid_deg))
        bins.setdefault(key, []).append((lat, lon, (aff or 0) * (pop or 0)))
    scored = []
    for pts in bins.values():
        if len(pts) < 2:
            continue
        mean = sum(p[2] for p in pts) / len(pts)
        scored.append({
            "lat": sum(p[0] for p in pts) / len(pts),
            "lon": sum(p[1] for p in pts) / len(pts),
            "score": mean * math.sqrt(len(pts)),
            "mean": mean,
            "cells": len(pts),
        })
    scored.sort(key=lambda s: -s["score"])
    chosen: list[dict] = []
    for s in scored:
        if all(haversine_km(s["lat"], s["lon"], c["lat"], c["lon"]) >= min_sep_km for c in chosen):
            chosen.append(s)
        if len(chosen) == top:
            break
    return chosen
