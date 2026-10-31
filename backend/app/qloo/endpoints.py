"""Typed helpers over the Qloo hackathon API. All functions return normalized Entity/Tag dicts."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from . import client

ENTITY_TYPES = {
    "place": "urn:entity:place",
    "artist": "urn:entity:artist",
    "brand": "urn:entity:brand",
    "podcast": "urn:entity:podcast",
    "tv_show": "urn:entity:tv_show",
    "movie": "urn:entity:movie",
    "book": "urn:entity:book",
}


@dataclass
class Tag:
    id: str
    name: str
    type: str = ""
    popularity: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Entity:
    id: str
    name: str
    subtype: str = ""
    popularity: float | None = None
    affinity: float | None = None
    address: str | None = None
    neighborhood: str | None = None
    lat: float | None = None
    lon: float | None = None
    image: str | None = None
    website: str | None = None
    description: str | None = None
    price_level: int | None = None
    tags: list[str] = field(default_factory=list)
    tag_ids: list[str] = field(default_factory=list)
    explain: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class HeatCell:
    lat: float
    lon: float
    affinity: float | None
    popularity: float | None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _float(v: Any) -> float | None:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _explain(raw: dict[str, Any]) -> list[str]:
    """Pull human-readable lines out of feature.explainability output, whatever its exact shape."""
    q = raw.get("query") or {}
    exp = q.get("explainability") or raw.get("explainability")
    if not exp:
        return []
    out: list[str] = []
    if isinstance(exp, dict):
        for key, items in exp.items():
            if isinstance(items, list):
                for it in items[:3]:
                    if isinstance(it, dict):
                        label = it.get("name") or it.get("entity_id") or it.get("id") or it.get("tag_id")
                        score = _float(it.get("score") or it.get("weight") or it.get("affinity"))
                        if label:
                            out.append(f"{key}: {label}" + (f" ({score:.2f})" if score is not None else ""))
    return out[:5]


def normalize_entity(raw: dict[str, Any]) -> Entity:
    props = raw.get("properties") or {}
    loc = raw.get("location") or {}
    tags = raw.get("tags") or []
    images = props.get("images") or []
    image = (props.get("image") or {}).get("url") if isinstance(props.get("image"), dict) else None
    if not image and images and isinstance(images[0], dict):
        image = images[0].get("url")
    subtype = raw.get("subtype") or ((raw.get("types") or [""])[0])
    return Entity(
        id=raw.get("entity_id") or raw.get("id") or "",
        name=(raw.get("name") or "").strip(),
        subtype=subtype,
        popularity=_float(raw.get("popularity")),
        affinity=_float((raw.get("query") or {}).get("affinity")),
        address=props.get("address"),
        neighborhood=props.get("neighborhood") if isinstance(props.get("neighborhood"), str) else None,
        lat=_float(loc.get("lat")),
        lon=_float(loc.get("lon")),
        image=image,
        website=props.get("website"),
        description=(props.get("short_description") or props.get("description") or None),
        price_level=props.get("price_level") if isinstance(props.get("price_level"), int) else None,
        tags=[t.get("name", "") for t in tags if isinstance(t, dict) and t.get("name")][:12],
        tag_ids=[t.get("id") or t.get("tag_id") or "" for t in tags if isinstance(t, dict)][:30],
        explain=_explain(raw),
    )


async def find_tags(query: str, take: int = 15, tag_type: str | None = None) -> list[Tag]:
    data = await client.get("/v2/tags", {"filter.query": query, "take": take, "filter.tag.types": tag_type})
    tags = (data.get("results") or {}).get("tags") or []
    return [
        Tag(id=t["id"], name=t.get("name", t["id"]), type=t.get("type", ""), popularity=_float(t.get("popularity")))
        for t in tags
        if t.get("id")
    ]


async def search_entities(query: str, types: str | None = None, take: int = 5) -> list[Entity]:
    data = await client.get("/search", {"query": query, "types": types, "take": take})
    results = data.get("results") or []
    if isinstance(results, dict):
        results = results.get("entities") or []
    return [normalize_entity(r) for r in results if isinstance(r, dict)]


def _signal_params(
    tags: list[str] | None,
    entities: list[str] | None,
) -> dict[str, Any]:
    p: dict[str, Any] = {}
    if tags:
        p["signal.interests.tags"] = ",".join(tags)
    if entities:
        p["signal.interests.entities"] = ",".join(entities)
    return p


async def insights(
    entity_type: str,
    *,
    tags: list[str] | None = None,
    entities: list[str] | None = None,
    location: str | None = None,
    filter_tags: list[str] | None = None,
    popularity_min: float | None = None,
    popularity_max: float | None = None,
    take: int = 20,
    explain: bool = False,
    extra: dict[str, Any] | None = None,
) -> list[Entity]:
    params: dict[str, Any] = {
        "filter.type": ENTITY_TYPES.get(entity_type, entity_type),
        "take": take,
        **_signal_params(tags, entities),
    }
    if location:
        params["filter.location.query"] = location
    if filter_tags:
        params["filter.tags"] = ",".join(filter_tags)
    if popularity_min is not None:
        params["filter.popularity.min"] = popularity_min
    if popularity_max is not None:
        params["filter.popularity.max"] = popularity_max
    if explain:
        params["feature.explainability"] = "true"
    if extra:
        params.update(extra)
    data = await client.get("/v2/insights", params)
    ents = (data.get("results") or {}).get("entities") or []
    return [normalize_entity(e) for e in ents if isinstance(e, dict) and e.get("name")]


async def heatmap(
    location: str,
    *,
    tags: list[str] | None = None,
    entities: list[str] | None = None,
    take: int = 50,
) -> list[HeatCell]:
    params: dict[str, Any] = {
        "filter.type": "urn:heatmap",
        "filter.location.query": location,
        "take": take,
        **_signal_params(tags, entities),
    }
    # Heatmaps for big metros return thousands of cells and can take >15s.
    data = await client.get("/v2/insights", params, timeout=40)
    cells = (data.get("results") or {}).get("heatmap") or []
    out: list[HeatCell] = []
    for c in cells:
        loc = c.get("location") or {}
        q = c.get("query") or {}
        lat, lon = _float(loc.get("latitude", loc.get("lat"))), _float(loc.get("longitude", loc.get("lon")))
        if lat is None or lon is None:
            continue
        out.append(HeatCell(lat=lat, lon=lon, affinity=_float(q.get("affinity")), popularity=_float(q.get("popularity"))))
    return out


def affinities_identical(entities: list[Entity] | list[float | None], tol: float = 1e-6) -> bool:
    """True when the signal was ignored: all results share one affinity (or none have one)."""
    vals = [e.affinity if isinstance(e, Entity) else e for e in entities]
    nums = [v for v in vals if v is not None]
    if len(nums) < 2:
        return len(vals) >= 2  # several results but no affinity at all = unranked
    return max(nums) - min(nums) <= tol
