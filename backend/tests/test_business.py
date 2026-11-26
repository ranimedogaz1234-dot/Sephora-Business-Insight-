"""Business insight rules on the synthetic catalogue and reviews (conftest.py; values by hand).

Skincare: P1 rating 4.5 (120 reviews, 900 loves), P2 4.0 (15, 300), P3 3.5 (8, 500); mean 4.0.
Makeup: P4 alone, 4.8 with 300 reviews, so it is at its category's bottom for loves (percentile 0).
Loves: 3,250 in total over 5 products.
"""

from sephora import business, data


def test_rules_and_findings(client):
    body = client.get("/api/insights").json()
    assert [p["product_id"] for p in body["hidden_gems"]["items"]] == ["P4"]  # 4.8, 300 reviews, percentile 0
    assert body["at_risk"]["count"] == 0  # P1 is the most loved Skincare product but rated above the mean
    assert body["momentum"]["eligible"] == 0  # far fewer than 50 reviews per period
    assert body["brands"]["brands"] == 0  # no brand has 5 rated products
    demand = {c["category"]: c for c in body["categories"]}
    assert demand["Makeup"]["demand_index"] == round((1500 / 3250) / (1 / 5), 2)
    assert demand["Skincare"]["demand_index"] == round((1700 / 3250) / (3 / 5), 2)
    assert body["categories"][0]["category"] == "Makeup"
    assert [f["id"] for f in body["findings"]] == ["hidden-gems", "category-demand"]
    assert set(body["rules"]) == {"hidden_gems", "at_risk", "momentum", "brands", "categories"}


def test_category_scope(client):
    body = client.get("/api/insights", params={"category": "Skincare"}).json()
    assert body["hidden_gems"]["count"] == 0 and body["momentum"] is not None
    assert client.get("/api/insights", params={"category": "Makeup"}).json()["momentum"] is None  # reviews are Skincare only
    assert client.get("/api/insights", params={"category": "Nope"}).status_code == 422


def test_momentum_compares_the_two_periods(client, monkeypatch):
    # With a one-year window ending 2022-06-01: P1 5, 5 before and 4, 1 after; P2 3 before and 5 after.
    monkeypatch.setattr(business, "MOMENTUM_DAYS", 365)
    monkeypatch.setattr(business, "MOMENTUM_MIN_REVIEWS", 1)
    client.get("/health")
    m = business.momentum(data.get_dataset())
    assert (m["cutoff"], m["eligible"], m["declining_count"], m["improving_count"]) == ("2021-06-01", 2, 1, 1)
    assert (m["declining"][0]["product_id"], m["declining"][0]["change"]) == ("P1", -2.5)
    assert (m["improving"][0]["product_id"], m["improving"][0]["rating_before"], m["improving"][0]["rating_recent"]) == ("P2", 3.0, 5.0)


def test_brand_positions_split_at_the_median(client, monkeypatch):
    monkeypatch.setattr(business, "BRAND_MIN_RATED", 1)
    client.get("/health")
    b = business.brand_positions(data.get_dataset(), None)
    # Alpha: 4.25 and median loves 600; Beta: 4.15 and 1,000 (Gamma has no rating).
    assert (b["brands"], b["rating_split"], b["loves_split"]) == (2, 4.2, 800)
    q = {x["key"]: x for x in b["quadrants"]}
    assert q["hidden_quality"]["examples"] == ["Alpha"] and q["popular_weaker"]["examples"] == ["Beta"]
