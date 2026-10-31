"""The tag self-check: the agent tests candidate tags against Qloo and keeps the best-ranking one."""
import asyncio

from app.agent import scoring
from app.agent.context import Context, PlanInput
from app.agent.steps import tags as tags_step
from app.qloo import endpoints as q
from app.qloo.endpoints import Entity, Tag


def ents(*affs):
    return [Entity(id=f"e{i}", name=f"E{i}", affinity=a) for i, a in enumerate(affs)]


def test_probe_score():
    assert scoring.probe_score(ents(0.765, 0.765, 0.765)) == ("flat", 0.0)
    assert scoring.probe_score([]) == ("empty", 0.0)
    quality, score = scoring.probe_score(ents(1.0, 0.98, 0.96, 0.94, 0.92, 0.5))
    assert quality == "ranked" and abs(score - 0.96) < 1e-9
    # Unscored tail rows don't drag the score down.
    assert abs(scoring.probe_score(ents(0.9, 0.8, 0.765, 0.765))[1] - 0.85) < 1e-9


def test_pick_tags():
    a, b, c = "A", "B", "C"
    assert scoring.pick_tags([(a, 0.79), (b, 0.97), (c, 0.96)]) == [b, c]
    assert scoring.pick_tags([(a, 0.79), (b, 0.97), (c, 0.90)]) == [b]
    assert scoring.pick_tags([(a, 0.0), (b, 0.0)]) == []
    assert scoring.pick_tags([(a, 0.9), (b, 0.9), (c, 0.9)], max_keep=2) == [a, b]


def test_candidate_pool_dedupes_names_and_keeps_ai_order():
    ai = [Tag(id="urn:tag:genre:media:adoption", name="Adoption"), Tag(id="urn:tag:genre:media:dogs", name="Dogs")]
    heur = [Tag(id="urn:tag:theme:qloo:dogs", name="Dogs"), Tag(id="urn:tag:genre:media:animals", name="Animals"),
            Tag(id="urn:tag:category:place:animal_shelter", name="Animal shelter")]
    pool = tags_step.candidate_pool(ai, heur)
    assert [t.id for t in pool] == ["urn:tag:genre:media:adoption", "urn:tag:genre:media:dogs",
                                    "urn:tag:genre:media:animals"]


def test_self_check_switches_away_from_weak_ai_choice(monkeypatch):
    weak = Tag(id="urn:tag:genre:media:adoption", name="Adoption")
    strong = Tag(id="urn:tag:genre:media:dogs", name="Dogs")
    ignored = Tag(id="urn:tag:genre:media:zzz", name="Zzz")
    results = {weak.id: ents(0.80, 0.79, 0.78), strong.id: ents(0.99, 0.98, 0.97), ignored.id: ents(0.765, 0.765)}

    async def fake_insights(entity_type, *, tags, **k):
        return results[tags[0]]

    monkeypatch.setattr(q, "insights", fake_insights)
    ctx = Context(inp=PlanInput(cause="Senior dog rescue shelter", city="Austin", guests=100, budget="modest"))
    chosen = asyncio.run(tags_step.self_check(ctx, [weak, strong, ignored], [weak]))
    assert chosen == [strong]
    notes = ctx.decisions["tags"]
    assert any("Qloo ignored it" in n and "Zzz" in n for n in notes)
    assert any(n.startswith("Switched from 'Adoption' to 'Dogs'") for n in notes)


def test_self_check_keeps_ai_choice_when_best(monkeypatch):
    dogs = Tag(id="urn:tag:genre:media:dogs", name="Dogs")

    async def fake_insights(entity_type, *, tags, **k):
        return ents(0.99, 0.95)

    monkeypatch.setattr(q, "insights", fake_insights)
    ctx = Context(inp=PlanInput(cause="Senior dog rescue shelter", city="Austin", guests=100, budget="modest"))
    assert asyncio.run(tags_step.self_check(ctx, [dogs], [dogs])) == [dogs]
    assert ctx.decisions["tags"][-1] == "Kept 'Dogs': strongest Qloo ranking."
