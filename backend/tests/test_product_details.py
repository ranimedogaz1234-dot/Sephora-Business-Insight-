"""Product details on the synthetic dataset (conftest.py; expected values by hand)."""

import pytest

from sephora.products import parse_list


def test_details_with_reviews(client):
    body = client.get("/api/products/P1").json()
    p = body["product"]
    assert (p["product_name"], p["brand_name"], p["tertiary_category"]) == ("Glow Serum", "Alpha", "Face Serums")
    assert (p["size"], p["value_price"], p["variants"]) == ("1 oz/ 30 mL", 55.0, 2)
    assert (p["variant_min_price"], p["variant_max_price"]) == (20.0, 40.0)
    assert p["highlights"] == ["Vegan", "Good for: Dryness"]
    assert p["ingredients"] == ["Water, Glycerin, Niacinamide."]
    assert p["category_rating"] == 4.0 and p["rating_vs_category"] == 0.5

    r = body["reviews"]
    assert (r["count"], r["average_rating"], r["recommend_rate"]) == (4, 3.75, 0.75)
    assert (r["first_review"], r["last_review"], r["granularity"]) == ("2021-01-15", "2022-02-11", "month")
    assert [b["count"] for b in r["ratings"]] == [1, 0, 0, 1, 2]
    assert r["by_skin_type"] == [{"name": "dry", "count": 4, "average_rating": 3.75, "recommend_rate": 0.75}]
    assert [x["helpful_votes"] for x in r["most_helpful"]] == [9, 3, 1]
    assert "author_id" not in str(body)

    assert [x["product_id"] for x in body["same_brand"]] == ["P2"]
    assert all(x["product_id"] != "P1" for x in body["related"])


def test_details_without_reviews(client):
    body = client.get("/api/products/P4").json()
    assert body["reviews"] is None  # Makeup: not in the review files, not "0 reviews"
    assert body["product"]["highlights"] == ["not a list"]
    assert body["product"]["variation_desc"] == "bright red"
    assert body["product"]["ingredients"] == []


@pytest.mark.parametrize("pid, status", [("P404", 404), ("../etc", 404), ("X1", 422), ("P1;drop", 422)])
def test_unknown_or_invalid_ids(client, pid, status):
    assert client.get(f"/api/products/{pid}").status_code == status


def test_options_and_summary_routes_still_win(client):
    assert client.get("/api/products/options").status_code == 200
    assert client.get("/api/products/summary").status_code == 200


def test_parse_list_never_executes_code():
    assert parse_list("['A', ' B ', '']") == ["A", "B"]
    assert parse_list("__import__('os').system('echo hi')") == ["__import__('os').system('echo hi')"]
    assert parse_list("[1, 2]") == ["[1, 2]"]
    assert parse_list(None) == [] and parse_list("  ") == []
