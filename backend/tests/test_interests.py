from app.agent.steps.interests import match_entity, match_tag
from app.qloo.endpoints import Entity, Tag

TAGS = [
    Tag(id="urn:tag:genre:music:indie_folk_rock", name="Indie Folk Rock"),
    Tag(id="urn:tag:keyword:qloo:indie_folk", name="Indie Folk"),
    Tag(id="urn:tag:genre:music:indie_folk", name="Indie Folk"),
    Tag(id="urn:tag:offerings:place:craft_beer", name="Craft Beer"),
    Tag(id="urn:tag:keyword:qloo:craft_beer", name="Craft beer"),
    Tag(id="urn:tag:nearby_attraction:qloo:farmers_markets", name="Farmers Markets"),
]


def test_tag_exact_name_prefers_genre():
    assert match_tag("indie folk", TAGS).id == "urn:tag:genre:music:indie_folk"


def test_tag_skips_unusable_families_and_handles_plural():
    assert match_tag("Craft beers", TAGS).id == "urn:tag:keyword:qloo:craft_beer"
    assert match_tag("farmers markets", TAGS) is None  # only a nearby_attraction tag exists


def test_entity_skips_places_and_needs_overlap():
    ents = [
        Entity(id="p", name="Farmer's Market Santa Anita", subtype="urn:entity:place"),
        Entity(id="m", name="Marley & Me", subtype="urn:entity:movie"),
        Entity(id="b", name="Marley and Me: Life and Love", subtype="urn:entity:book"),
    ]
    assert match_entity("marley & me", ents).id == "m"
    assert match_entity("farmers markets", ents) is None
    assert match_entity("jazz", [Entity(id="x", name="Unrelated", subtype="urn:entity:movie")]) is None
