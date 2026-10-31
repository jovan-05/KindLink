"""Step 7: heatmap for the city; top 3 hotspots, each named after the nearest Qloo locality."""
from __future__ import annotations

import asyncio

from ...qloo import endpoints as q
from .. import scoring
from ..context import Context, Section
from ...qloo.endpoints import Entity
from .common import has_signal, thin

MAX_NAME_KM = 4.0
PLACE_NAME_KM = 1.5
MAP_CELLS = 400
ADMIN_WORDS = ("county", "township", "metropolitan", "state", "community board", "council", "borough")


def _is_admin(name: str, city: str) -> bool:
    n = name.lower()
    return n in (city.lower(), "new york city", "manhattan", "brooklyn", "queens", "the bronx", "staten island")         or any(w in n for w in ADMIN_WORDS)


def name_hotspot(spot: dict, localities: list[Entity], places: list[Entity], used: set[str]) -> tuple[str, str] | None:
    """Name a hotspot from Qloo data only: the nearest Qloo locality within MAX_NAME_KM, else the most
    common `neighborhood` among Qloo places within PLACE_NAME_KM. Returns (id, name) or None."""
    def dist(e: Entity) -> float:
        return scoring.haversine_km(spot["lat"], spot["lon"], e.lat, e.lon)  # type: ignore[arg-type]

    near = sorted((loc for loc in localities if loc.name not in used and dist(loc) <= MAX_NAME_KM), key=dist)
    if near:
        return near[0].id, near[0].name
    counts: dict[str, list[float]] = {}
    for p in places:
        if p.neighborhood and p.lat is not None and p.lon is not None and p.neighborhood not in used:
            d = dist(p)
            if d <= PLACE_NAME_KM:
                counts.setdefault(p.neighborhood, []).append(d)
    if not counts:
        return None
    name = max(counts, key=lambda n: (len(counts[n]), -min(counts[n])))
    return f"hood:{name.lower()}", name


async def run(ctx: Context) -> str:
    if not has_signal(ctx):
        ctx.sections["neighborhoods"] = thin("No taste signal for the heatmap.")
        return "Skipped: no taste signal"
    signal = ctx.signal_label()
    cells_res, loc_res, place_res = await asyncio.gather(
        q.heatmap(ctx.location, tags=ctx.tag_ids, entities=ctx.entity_ids),
        q.insights("urn:entity:locality", location=ctx.location, take=50),
        # Fallback names: places carry a `neighborhood` property (locality lookup 500s for some cities).
        q.insights("place", tags=ctx.tag_ids, entities=ctx.entity_ids, location=ctx.location, take=50),
        return_exceptions=True,
    )
    if isinstance(cells_res, BaseException) or not cells_res:
        ctx.sections["neighborhoods"] = thin("Qloo returned no heatmap for this city.")
        return "Not enough data for neighborhoods"
    affs = [c.affinity for c in cells_res]
    if scoring.signal_quality([q.Entity(id="", name="", affinity=a) for a in affs]) in ("flat", "empty"):
        ctx.sections["neighborhoods"] = thin("Heatmap affinity was flat (signal not applied).", "flat", signal)
        return "Heatmap flat"

    tuples = [(c.lat, c.lon, c.affinity or 0.0, c.popularity or 0.0) for c in cells_res]
    spots = scoring.hotspots(tuples, top=6)
    localities = [] if isinstance(loc_res, BaseException) else [
        loc for loc in loc_res if loc.lat is not None and loc.lon is not None and not _is_admin(loc.name, ctx.inp.city)
    ]
    places = [] if isinstance(place_res, BaseException) else place_res
    ctx.note("neighborhoods", f"Aggregated {len(cells_res)} heatmap cells into {len(spots)} candidate hotspots.")
    if not localities:
        ctx.note("neighborhoods", "Qloo's locality lookup gave nothing usable here; naming from nearby Qloo places instead.")
    items = []
    used: set[str] = set()
    for s in spots:
        named = name_hotspot(s, localities, places, used)
        if not named:
            ctx.note("neighborhoods", "Dropped a hotspot with no Qloo neighborhood name nearby (never guessed).")
            continue
        hood_id, hood_name = named
        used.add(hood_name)
        items.append({
            "id": hood_id, "name": hood_name, "lat": s["lat"], "lon": s["lon"],
            "evidence": {"signal": signal, "affinity": round(s["mean"], 3), "popularity": None,
                         "basis": "heatmap", "quality": "ranked", "explain": [f"{s['cells']} heatmap cells"]},
        })
        if len(items) == 3:
            break
    # Downsample cells for the map overlay: highest affinity*popularity first.
    top_cells = sorted(tuples, key=lambda t: -(t[2] * t[3]))[:MAP_CELLS]
    heat = [[round(lat, 5), round(lon, 5), round(a * p, 3)] for lat, lon, a, p in top_cells]
    sec = Section(items=items, quality="ranked", signal=signal, extra={"heat": heat})
    if not items:
        sec.status = "thin"
        sec.note = "Hotspots found, but none could be matched to a named Qloo neighborhood."
    ctx.sections["neighborhoods"] = sec
    return "Top areas: " + (", ".join(i["name"] for i in items) or "unnamed")
