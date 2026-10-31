from app.agent.compose import ground_plan, remap_ids
from app.agent.context import Context, PlanInput, Section
from app.agent.grounding import GENERIC, Grounder, normalize
from app.llm import extract_json

ALLOWED = ["Auditorium Shores Dog Park", "Woof Gang Bakery & Grooming Austin", "Petco", "Mohawk Austin",
           "Dogs", "Austin", "Marley & Me"]


def g():
    return Grounder.from_names(ALLOWED)


def test_normalize():
    assert normalize("The  Woof Gang Bakery & Grooming!") == "woof gang bakery and grooming"
    assert normalize("Café’s") == "café's"


def test_marked_known_name_is_canonicalized():
    gr = g()
    out = gr.text("Meet at [[auditorium shores dog park]] for the walk.", "concept")
    assert out == "Meet at Auditorium Shores Dog Park for the walk."
    assert gr.removed == []


def test_marked_partial_match_allowed():
    gr = g()
    assert gr.text("Then on to [[Mohawk]] for drinks.", "x") == "Then on to Mohawk Austin for drinks."


def test_marked_unknown_name_removed_and_logged():
    gr = g()
    out = gr.text("Live music from [[The Black Keys]] at [[Petco]].", "concept")
    assert out == f"Live music from {GENERIC} at Petco."
    assert gr.removed == [{"name": "The Black Keys", "field": "concept"}]


def test_unmarked_invented_venue_removed():
    gr = g()
    out = gr.text("Afterwards, guests head to Violet Crown Brewery for a toast.", "ros")
    assert "Violet Crown" not in out
    assert GENERIC in out
    assert gr.removed[0]["name"] == "Violet Crown Brewery"


def test_unmarked_known_venue_kept():
    gr = g()
    text = "Guests gather at Auditorium Shores Dog Park at sunset."
    assert gr.text(text, "x") == text
    assert gr.removed == []


def test_generic_capitalized_phrases_kept():
    gr = g()
    text = "Coffee Bar opens at 5. Visit the Silent Auction and the Adoption Corner. Enjoy the Photo Booth."
    assert gr.text(text, "x") == text
    assert gr.removed == []


def test_sentence_initial_verb_not_removed_with_name():
    gr = g()
    out = gr.text("Join Lucky Lab Brewing for the after-party.", "x")
    assert out.startswith("Join ")
    assert "Lucky Lab" not in out
    assert gr.removed[0]["name"] == "Lucky Lab Brewing"


def test_non_suffix_phrases_untouched():
    gr = g()
    text = "A Senior Dog Social inspired by Marley & Me."
    assert gr.text(text, "x") == text


def test_ids_filter():
    gr = g()
    assert gr.ids(["a", "zzz", None, "b"], {"a", "b"}, "f") == ["a", "b"]
    assert gr.removed == [{"name": "zzz", "field": "f"}]


def test_non_string_text():
    assert g().text(None, "x") == ""
    assert g().text(42, "x") == ""


def _ctx():
    ctx = Context(inp=PlanInput(cause="Animal rescue for senior dogs", city="Austin", guests=150, budget="modest"))
    ctx.sections["venues"] = Section(items=[{"id": "v-real", "name": "Auditorium Shores Dog Park", "evidence": {}}])
    ctx.sections["sponsors"] = Section(items=[{"id": "s-real", "name": "Petco", "evidence": {}}])
    return ctx


def test_ground_plan_end_to_end():
    raw = {
        "event_name": "Gray Muzzle Gala at [[Zilker Botanical Garden]]",
        "concept": "An evening at [[Auditorium Shores Dog Park]] with treats from [[Petco]].",
        "headline_venue_id": "V1",
        "headline_performer_id": "P9",
        "reasons": {"V1": "Huge lawn.", "S1": "Pet brand.", "X9": "invented"},
        "run_of_show": [{"time": "6 PM", "title": "Welcome", "detail": "Drinks by Hops & Grain Brewing."}],
        "promotion_angles": [{"id": "M7", "angle": "nope"}],
        "sponsor_pitch": {"subject": "Hi", "opening": "o", "audience": "a", "benefits": ["Logo on [[Petco]] aisle"],
                          "ask": "Call?"},
    }
    raw = remap_ids(raw, {"V1": "v-real", "S1": "s-real"})
    plan, removed, verified = ground_plan(raw, _ctx())
    assert verified == ["Auditorium Shores Dog Park", "Petco"]
    names = {r["name"] for r in removed}
    assert "Zilker Botanical Garden" in names
    assert "Hops & Grain Brewing" in names
    assert "P9" in names and "X9" in names
    assert plan["headline_venue_id"] == "v-real"
    assert plan["headline_performer_id"] is None
    assert set(plan["reasons"]) == {"v-real", "s-real"}
    assert plan["promotion_angles"] == []
    assert "Zilker" not in plan["event_name"]
    assert "Hops" not in plan["run_of_show"][0]["detail"]
    assert plan["sponsor_pitch"]["benefits"] == ["Logo on Petco aisle"]


def test_extract_json_variants():
    assert extract_json('{"a": 1}') == {"a": 1}
    assert extract_json('Sure!\n```json\n{"a": [1, 2]}\n```') == {"a": [1, 2]}
    assert extract_json('<think>hmm {"no"}</think> here: {"b": "x}y"} trailing') == {"b": "x}y"}
    assert extract_json('["k1", "k2"]') == ["k1", "k2"]


def test_sentence_initial_name_removed_whole():
    gr = g()
    out = gr.text("Hops & Grain Brewing hosts the after-party.", "x")
    assert out == f"{GENERIC} hosts the after-party."


def test_event_name_coined_title_unwrapped_but_venue_removed():
    gr = g()
    assert gr.text("[[Rock the After-School Stage]]", "event_name", unwrap_unknown=True) == "Rock the After-School Stage"
    out = gr.text("Gala at [[Zilker Botanical Garden]]", "event_name", unwrap_unknown=True)
    assert "Zilker" not in out
    assert gr.removed == [{"name": "Zilker Botanical Garden", "field": "event_name"}]


def test_short_ids_in_prose_replaced_but_id_fields_kept():
    from app.agent.compose import replace_short_ids

    raw = {"headline_performer_id": "P1", "run_of_show": [{"detail": "P1 plays; then V2 and P9."}],
           "reasons": {"P1": "fits"}, "promotion_angles": [{"id": "M1", "angle": "Pitch M1 hosts"}]}
    out = replace_short_ids(raw, {"P1": "Seedless", "V2": "Cosmic Pickle", "M1": "Radiolab"})
    assert out["headline_performer_id"] == "P1"
    assert out["run_of_show"][0]["detail"] == "Seedless plays; then Cosmic Pickle and P9."
    assert out["promotion_angles"][0] == {"id": "M1", "angle": "Pitch Radiolab hosts"}
