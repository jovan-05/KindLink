"""The plan must still render when Qloo data is useless and the LLM is unavailable (CLAUDE.md rule 6)."""
import asyncio

from app import llm
from app.agent import pipeline
from app.agent.context import PlanInput
from app.agent.grounding import Grounder
from app.qloo import endpoints as q


def test_pipeline_survives_flat_data_and_no_llm(monkeypatch):
    async def no_llm(*a, **k):
        raise llm.LLMError("down")

    async def tags(query, take=15, tag_type=None):
        return [q.Tag(id="urn:tag:genre:media:books", name="Books"),
                q.Tag(id="urn:tag:keyword:qloo:reading", name="Reading")]

    async def flat(entity_type, **k):
        return [q.Entity(id=f"x{i}", name=f"Generic {i}", affinity=0.765, popularity=0.5) for i in range(5)]

    async def boom(*a, **k):
        raise RuntimeError("qloo down")

    for mod in ("app.agent.steps.understand", "app.agent.steps.tags", "app.agent.steps.venues",
                "app.agent.compose", "app.agent.baseline"):
        monkeypatch.setattr(f"{mod}.llm.chat_json", no_llm)
    monkeypatch.setattr(q, "find_tags", tags)
    monkeypatch.setattr(q, "insights", flat)
    monkeypatch.setattr(q, "heatmap", boom)
    monkeypatch.setattr(q, "search_entities", boom)

    inp = PlanInput(cause="Children's literacy program giving books to kids", city="Chicago", guests=100,
                    budget="shoestring", interests=["Where the Wild Things Are"])

    async def collect():
        return [ev async for ev in pipeline.run(inp, plan_id="test-plan")]

    events = asyncio.run(collect())
    result = events[-1]
    assert result["type"] == "result"
    plan = result["plan"]
    for name in ("venues", "performers", "sponsors", "promotion"):
        assert plan["sections"][name]["status"] == "thin", name
        assert plan["sections"][name]["items"] == []
    assert plan["sections"]["neighborhoods"]["status"] in ("thin", "failed")
    assert plan["plan"]["event_name"]
    assert plan["baseline"]["status"] == "failed"
    assert plan["data_notes"]
    # Template plan only names things from the (empty) Qloo set: nothing invented.
    g = Grounder.from_names(["Chicago", "Books", "Reading"])
    g.text(plan["plan"]["concept"] + " " + plan["plan"]["sponsor_pitch"]["audience"], "concept")
    assert g.removed == []
    statuses = {ev["step"]: ev["status"] for ev in events if ev["type"] == "step" and ev["status"] != "running"}
    assert statuses["interests"] == "done"  # search errors are absorbed per-interest
    assert len(statuses) == 11
    assert plan["agent_log"] and plan["grounding"]["removed"] == []
