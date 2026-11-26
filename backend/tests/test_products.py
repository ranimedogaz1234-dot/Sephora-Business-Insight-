"""Product analytics on the synthetic catalogue (conftest.py; expected values by hand)."""

import pytest


def ids(client, **params):
    return [p["product_id"] for p in client.get("/api/products", params=params).json()["items"]]


def test_filters_combine(client):
    assert ids(client, brand="Beta") == ["P4", "P3"]
    assert ids(client, min_price=20, max_price=40) == ["P4", "P1", "P2"]
    assert ids(client, min_rating=4) == ["P4", "P1", "P2"]  # unrated P5 excluded
    assert ids(client, min_reviews=100) == ["P4", "P1"]  # catalogue review counts
    assert ids(client, subcategory="Treatments") == ["P1"]
    assert ids(client, category="Skincare", brand="Alpha", min_rating=4.5) == ["P1"]


@pytest.mark.parametrize(
    "flag, expected",
    [("on_sale", ["P3"]), ("exclusive", ["P1", "P2"]), ("new", ["P1"]), ("in_stock", ["P4", "P1", "P3", "P2"])],
)
def test_listing_flags(client, flag, expected):
    assert ids(client, flag=flag) == expected


def test_performance_indicators(client):
    items = {p["product_id"]: p for p in client.get("/api/products").json()["items"]}
    # Skincare mean catalogue rating = 4.0
    assert items["P1"]["rating_vs_category"] == 0.5
    assert items["P3"]["rating_vs_category"] == -0.5
    assert items["P5"]["rating_vs_category"] is None
    # Skincare loves 900 / 300 / 500 -> share of the other products with fewer loves
    assert [items[k]["loves_percentile"] for k in ("P1", "P3", "P2")] == [1.0, 0.5, 0.0]
    assert items["P4"]["loves_percentile"] == 0.0  # only product in Makeup
    assert items["P3"]["sale_price"] == 12.0 and "on_sale" in items["P3"]["flags"]
    assert set(items["P5"]["flags"]) == {"online_only", "out_of_stock"}
    assert ids(client, sort="above_category") == ["P1", "P2", "P4", "P3", "P5"]


def test_summary(client):
    s = client.get("/api/products/summary").json()
    assert (s["total"], s["brands"], s["median_price"], s["rated"]) == (5, 3, 30.0, 4)
    assert s["average_rating"] == 4.2
    assert s["flags"] == {"new": 1, "exclusive": 2, "online_only": 2, "limited_edition": 1, "on_sale": 1, "in_stock": 4}
    hist = {b["label"]: b["count"] for b in s["price_histogram"]}
    assert (hist["$0–15"], hist["$15–25"], hist["$25–35"], hist["$35–50"], hist["$50–75"]) == (0, 1, 2, 1, 1)
    ratings = {b["label"]: b["count"] for b in s["rating_histogram"]}
    assert (ratings["3.5–4.0"], ratings["4.0–4.5"], ratings["4.5–5.0"], ratings["Not rated"]) == (1, 1, 2, 1)
    assert [p["product_id"] for p in s["best_rated"]] == ["P4", "P1"]  # >= 50 catalogue reviews
    # Alpha and Beta both have 2 products; ties go to the brand with more loves (2,000 vs 1,200).
    assert [b["brand_name"] for b in s["top_brands"]] == ["Beta", "Alpha", "Gamma"]

    empty = client.get("/api/products/summary", params={"brand": "Gamma", "min_rating": 4}).json()
    assert empty["total"] == 0 and empty["median_price"] is None and empty["average_rating"] is None


def test_options(client):
    o = client.get("/api/products/options").json()
    assert [b["name"] for b in o["brands"]] == ["Alpha", "Beta", "Gamma"]
    assert {"category": "Skincare", "name": "Treatments", "count": 1} in o["subcategories"]
    assert o["price_range"] == [18.0, 55.0]


@pytest.mark.parametrize(
    "params",
    [
        {"min_price": 50, "max_price": 10},
        {"brand": "Nobody"},
        {"flag": "free"},
        {"min_rating": 6},
        {"min_reviews": -1},
        {"subcategory": "Nope"},
        {"sort": "loves_count; drop"},
    ],
)
def test_invalid_product_filters(client, params):
    assert client.get("/api/products", params=params).status_code == 422
    assert client.get("/api/products/summary", params=params).status_code in (200, 422)
