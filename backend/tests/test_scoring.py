from app.agent import scoring
from app.qloo.endpoints import Entity, affinities_identical


def ents(*affs, pops=None):
    pops = pops or [0.5] * len(affs)
    return [Entity(id=f"e{i}", name=f"E{i}", affinity=a, popularity=p) for i, (a, p) in enumerate(zip(affs, pops))]


# --- identical-affinity detector -------------------------------------------------

def test_ranked_when_affinities_vary():
    assert scoring.signal_quality(ents(0.97, 0.95, 0.90)) == "ranked"


def test_flat_when_all_at_unscored_floor():
    # What Qloo returns for an invalid/ignored tag (observed in kill tests).
    assert scoring.signal_quality(ents(0.765, 0.765, 0.765, 0.765)) == "flat"


def test_flat_when_all_identical_mid_value():
    assert scoring.signal_quality(ents(0.81, 0.81, 0.81)) == "flat"


def test_saturated_when_all_one():
    # Brand insights from a tag: relevant, but every affinity is 1.0.
    assert scoring.signal_quality(ents(1.0, 1.0, 1.0)) == "saturated"


def test_empty_and_missing_affinity():
    assert scoring.signal_quality([]) == "empty"
    assert scoring.signal_quality(ents(None, None)) == "flat"
    assert scoring.signal_quality(ents(0.9)) == "ranked"


def test_float_noise_counts_as_identical():
    assert scoring.signal_quality(ents(0.765, 0.7650000001, 0.765)) == "flat"


def test_endpoint_helper_matches():
    assert affinities_identical(ents(0.765, 0.765))
    assert not affinities_identical(ents(0.9, 0.8))
    assert affinities_identical([0.5, 0.5, None])


# --- ranking ---------------------------------------------------------------------

def test_rank_ranked_puts_unscored_tail_last():
    es = ents(0.765, 0.90, 0.95, pops=[0.99, 0.1, 0.2])
    assert [e.affinity for e in scoring.rank(es)] == [0.95, 0.90, 0.765]


def test_rank_ties_broken_by_popularity():
    es = ents(0.9, 0.9, 0.8, pops=[0.2, 0.7, 0.99])
    assert [e.popularity for e in scoring.rank(es)] == [0.7, 0.2, 0.99]


def test_rank_saturated_uses_popularity():
    es = ents(1.0, 1.0, 1.0, pops=[0.3, 0.9, 0.6])
    assert [e.popularity for e in scoring.rank(es)] == [0.9, 0.6, 0.3]


def test_rank_flat_keeps_order():
    es = ents(0.765, 0.765, pops=[0.1, 0.9])
    assert scoring.rank(es) == es


def test_is_unscored():
    assert scoring.is_unscored(Entity(id="a", name="a", affinity=0.7652))
    assert not scoring.is_unscored(Entity(id="a", name="a", affinity=0.80))


# --- budget banding & tiers ------------------------------------------------------

def test_popularity_band():
    assert scoring.popularity_band("shoestring") == (None, 0.5)
    assert scoring.popularity_band("Generous") == (0.55, 0.9)
    assert scoring.popularity_band("unknown") == scoring.popularity_band("modest")


def test_popularity_tier():
    assert scoring.popularity_tier(0.95) == "well known"
    assert scoring.popularity_tier(0.7) == "established"
    assert scoring.popularity_tier(0.4) == "emerging"
    assert scoring.popularity_tier(0.1) == "grassroots"
    assert scoring.popularity_tier(None) == "unknown"


def test_evidence_basis():
    e = Entity(id="a", name="A", affinity=0.91234, popularity=0.5)
    ev = scoring.evidence(e, "Dogs", "ranked")
    assert ev == {"signal": "Dogs", "affinity": 0.912, "popularity": 0.5, "basis": "affinity",
                  "quality": "ranked", "explain": []}
    assert scoring.evidence(e, "Dogs", "saturated")["basis"] == "popularity"


# --- heatmap hotspots ------------------------------------------------------------

def test_hotspots_picks_dense_high_affinity_and_separates():
    cells = []
    # Hot cluster A near (30.26, -97.74), cool cluster B ~10 km away, weak cluster C.
    cells += [(30.261 + i * 0.001, -97.741, 0.95, 0.9) for i in range(6)]
    cells += [(30.351 + i * 0.001, -97.741, 0.6, 0.8) for i in range(6)]
    cells += [(30.201 + i * 0.001, -97.641, 0.2, 0.2) for i in range(6)]
    spots = scoring.hotspots(cells, top=2)
    assert len(spots) == 2
    assert abs(spots[0]["lat"] - 30.263) < 0.01
    assert abs(spots[1]["lat"] - 30.353) < 0.01


def test_hotspots_ignores_single_cell_bins_and_too_close():
    cells = [(30.0, -97.0, 1.0, 1.0)]  # lone cell
    cells += [(30.101, -97.001, 0.9, 0.9), (30.102, -97.002, 0.9, 0.9)]
    cells += [(30.121, -97.001, 0.8, 0.9), (30.122, -97.002, 0.8, 0.9)]  # ~2 km from previous
    spots = scoring.hotspots(cells, top=3, min_sep_km=3.0)
    assert len(spots) == 1


def test_haversine():
    assert abs(scoring.haversine_km(30.0, -97.0, 31.0, -97.0) - 111.2) < 0.5


def test_clean_tags_drops_wikidata_noise():
    from app.agent.steps.common import clean_tags

    assert clean_tags(["Pet stores", "2015 mergers and acquisitions", "Companies based in Phoenix", "Pet Food"]) == [
        "Pet stores", "Pet Food"]


def test_name_hotspot_prefers_locality_then_place_neighborhood():
    from app.agent.steps.neighborhoods import name_hotspot

    spot = {"lat": 39.75, "lon": -104.99}
    loc_far = Entity(id="L1", name="Far Town", lat=39.90, lon=-104.99)          # ~17 km
    loc_near = Entity(id="L2", name="LoDo", lat=39.755, lon=-104.995)
    places = [Entity(id=f"p{i}", name="x", lat=39.751, lon=-104.991, neighborhood=n)
              for i, n in enumerate(["RiNo", "RiNo", "Five Points"])]
    assert name_hotspot(spot, [loc_far, loc_near], places, set()) == ("L2", "LoDo")
    assert name_hotspot(spot, [loc_far], places, set()) == ("hood:rino", "RiNo")
    assert name_hotspot(spot, [loc_far], places, {"RiNo"}) == ("hood:five points", "Five Points")
    assert name_hotspot(spot, [loc_far], [], set()) is None
