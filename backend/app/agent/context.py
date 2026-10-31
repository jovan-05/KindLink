"""Shared state passed between pipeline steps."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from ..qloo.endpoints import Entity, Tag

Budget = Literal["shoestring", "modest", "generous"]

# Some city names resolve to a whole state in Qloo ("New York" -> New York State).
LOCATION_ALIASES = {
    "new york": "New York City", "nyc": "New York City", "new york, ny": "New York City",
    "washington": "Washington, D.C.", "washington dc": "Washington, D.C.", "dc": "Washington, D.C.",
}


def qloo_location(city: str) -> str:
    return LOCATION_ALIASES.get(city.strip().lower(), city.strip())


class PlanInput(BaseModel):
    cause: str = Field(min_length=10, max_length=500)
    city: str = Field(min_length=2, max_length=60)
    guests: int = Field(ge=10, le=5000)
    budget: Budget
    month: str | None = Field(default=None, max_length=20)
    interests: list[str] = Field(default_factory=list, max_length=5)

    @field_validator("cause", "city")
    @classmethod
    def _strip(cls, v: str) -> str:
        return " ".join(v.split())

    @field_validator("interests")
    @classmethod
    def _clean_interests(cls, v: list[str]) -> list[str]:
        out = [" ".join(i.split())[:60] for i in v if i and i.strip()]
        return out[:5]


@dataclass
class Section:
    """One plan section. status: ok | thin | failed."""

    status: str = "ok"
    items: list[dict[str, Any]] = field(default_factory=list)
    note: str = ""
    quality: str = ""
    signal: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"status": self.status, "items": self.items, "note": self.note,
                "quality": self.quality, "signal": self.signal, **self.extra}


@dataclass
class Context:
    inp: PlanInput
    keywords: list[str] = field(default_factory=list)
    taste_tags: list[Tag] = field(default_factory=list)
    keyword_tags: list[Tag] = field(default_factory=list)
    org_tags: list[Tag] = field(default_factory=list)
    interest_tags: list[Tag] = field(default_factory=list)
    interest_entities: list[Entity] = field(default_factory=list)
    unresolved_interests: list[str] = field(default_factory=list)
    venue_pool: list[Entity] = field(default_factory=list)
    sections: dict[str, Section] = field(default_factory=dict)
    data_notes: list[str] = field(default_factory=list)
    llm_models: set[str] = field(default_factory=set)
    llm_fallbacks: list[str] = field(default_factory=list)
    # Per-step decision lines shown in the live agent view and the agent log ("why the agent did X").
    decisions: dict[str, list[str]] = field(default_factory=dict)

    def note(self, step: str, text: str) -> None:
        self.decisions.setdefault(step, []).append(text)

    @property
    def location(self) -> str:
        """The city as Qloo's location filter should see it."""
        return qloo_location(self.inp.city)

    @property
    def signal_tags(self) -> list[Tag]:
        """Cause taste tags plus tags resolved from supporter interests, deduped."""
        out: dict[str, Tag] = {}
        for t in self.taste_tags + self.interest_tags:
            out.setdefault(t.id, t)
        return list(out.values())

    @property
    def tag_ids(self) -> list[str]:
        return [t.id for t in self.signal_tags]

    @property
    def entity_ids(self) -> list[str]:
        return [e.id for e in self.interest_entities]

    def signal_label(self, tags: list[Tag] | None = None) -> str:
        parts = [t.name for t in (tags if tags is not None else self.signal_tags)]
        parts += [e.name for e in self.interest_entities]
        return ", ".join(parts) if parts else "none"

    def explain_names(self, explain: list[str]) -> list[str]:
        """Replace entity ids in explainability lines with readable names."""
        names = {e.id: e.name for e in self.interest_entities}
        out = []
        for line in explain:
            for eid, nm in names.items():
                line = line.replace(eid, nm)
            out.append(line.replace("signal.interests.entities: ", "driven by "))
        return out
