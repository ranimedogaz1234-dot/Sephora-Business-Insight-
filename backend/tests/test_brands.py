"""Brand analytics on the synthetic dataset (conftest.py; expected values by hand).

Alpha (id 1): P1, P2 · Beta (id 2): P3, P4 · Gamma (id 3): P5 (no reviews, not rated).
"""

import pytest


def names(client, **params):
    return [b["brand_name"] for b in client.get("/api/brands", params=params).json()["items"]]


def test_directory_sorts_and_filters(client):
    assert names(client) == ["Alpha", "Beta", "Gamma"]  # products, ties by name
    assert names(client, sort="loves") == ["Beta", "Alpha", "Gamma"]
    assert names(client, sort="rating") == ["Alpha", "Beta", "Gamma"]  # unrated last
    assert names(client, sort="reviews") == ["Alpha", "Beta", "Gamma"]
    assert names(client, sort="price_asc") == ["Beta", "Alpha", "Gamma"]  # medians 24, 32.5, 55
    assert names(client, category="Makeup") == ["Beta"]
    assert names(client, q="am") == ["Gamma"]
    assert names(client, min_products=2) == ["Alpha", "Beta"]


def test_brand_metrics(client):
    items = {b["brand_name"]: b for b in client.get("/api/brands").json()["items"]}
    a = items["Alpha"]
    assert (a["brand_id"], a["products"], a["median_price"], a["average_catalogue_rating"]) == (1, 2, 32.5, 4.25)
    assert (a["total_loves"], a["catalogue_reviews"], a["exclusives"], a["new_products"]) == (1200, 135, 2, 1)
    assert (a["review_rows"], a["reviewed_products"]) == (6, 2)
    assert a["average_review_rating"] == round(23 / 6, 2)
    assert a["recommend_rate"] == 0.8  # one unanswered review excluded
    assert (a["rank_products"], a["rank_loves"], a["rank_reviews"]) == (1, 2, 1)
    g = items["Gamma"]
    assert g["review_rows"] == 0 and g["average_review_rating"] is None and g["recommend_rate"] is None
    assert g["average_catalogue_rating"] is None and g["rank_reviews"] is None


def test_summary(client):
    s = client.get("/api/brands/summary").json()
    assert (s["brands"], s["brands_with_reviews"], s["top10_product_share"]) == (3, 2, 1.0)
    assert s["size_distribution"][0] == {"label": "1–4", "count": 3}
    assert [b["brand_name"] for b in s["by_reviews"]] == ["Alpha", "Beta"]  # Gamma has none
    assert s["price_vs_rating"] == []  # needs 5 rated products


def test_details(client):
    d = client.get("/api/brands/1").json()
    assert d["brand"]["brand_name"] == "Alpha" and d["brands_total"] == 3
    assert [c["subcategory"] for c in d["categories"]] == ["Moisturizers", "Treatments"]
    assert d["price_quartiles"] == [25.0, 28.75, 32.5, 36.25, 40.0]
    r = d["reviews"]
    assert (r["count"], r["recommend_rate"], r["granularity"]) == (6, 0.8, "month")
    assert [(x["product_id"], x["review_count"]) for x in r["top_products"]] == [("P1", 4), ("P2", 2)]
    assert client.get("/api/brands/3").json()["reviews"] is None


@pytest.mark.parametrize("path, status", [("/api/brands/999", 404), ("/api/brands/abc", 422), ("/api/brands/0", 422)])
def test_bad_brand_ids(client, path, status):
    assert client.get(path).status_code == status


def test_options_use_ids(client):
    assert client.get("/api/brands/options").json()[0] == {"brand_id": 1, "brand_name": "Alpha", "products": 2}
