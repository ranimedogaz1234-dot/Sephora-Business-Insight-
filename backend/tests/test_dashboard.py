"""Dashboard endpoints on the synthetic dataset (expected values worked out by hand)."""

import pytest


def test_overview_for_one_category(client):
    skincare = client.get("/api/overview", params={"category": "Skincare"}).json()
    assert (skincare["total_products"], skincare["total_reviews"]) == (3, 7)
    assert skincare["average_catalogue_rating"] == 4.0  # (4.5 + 4.0 + 3.5) / 3
    assert skincare["median_price"] == 25.0
    assert skincare["total_loves"] == 1700

    makeup = client.get("/api/overview", params={"category": "Makeup"}).json()
    assert (makeup["total_products"], makeup["total_reviews"]) == (1, 0)
    # No reviews: review figures are unknown, never 0.
    assert makeup["average_rating"] is None and makeup["recommend_rate"] is None
    assert makeup["review_categories"] == []


def test_dashboard_lists_accept_a_category(client):
    assert client.get("/api/ratings", params={"category": "Makeup"}).json()[4]["count"] == 0
    assert client.get("/api/trend", params={"category": "Makeup"}).json() == []
    assert client.get("/api/top-brands", params={"category": "Makeup"}).json() == []
    top = client.get("/api/top-products", params={"category": "Skincare", "limit": 1}).json()
    assert top[0]["product_id"] == "P1"


def test_category_performance(client):
    rows = client.get("/api/category-performance").json()
    assert [r["category"] for r in rows] == ["Skincare", "Hair", "Makeup"]
    skin = rows[0]
    assert skin["average_price"] == round(83 / 3, 2)
    assert (skin["catalogue_reviews"], skin["review_rows"]) == (143, 7)  # kept apart
    assert skin["recommend_rate"] == round(4 / 6, 4)  # unknown answer excluded
    hair = rows[1]
    assert hair["average_catalogue_rating"] is None and hair["rated_products"] == 0
    assert rows[2]["review_rows"] == 0 and rows[2]["average_review_rating"] is None


def test_recommendation_patterns(client):
    body = client.get("/api/recommendations").json()
    assert (body["answered"], body["unanswered"]) == (6, 1)
    by_rating = {r["rating"]: (r["answered"], r["recommend_rate"]) for r in body["by_rating"]}
    assert by_rating == {1: (1, 0.0), 2: (1, 0.0), 3: (0, None), 4: (1, 1.0), 5: (3, 1.0)}
    assert body["by_year"] == [
        {"year": 2021, "answered": 2, "recommend_rate": 1.0},
        {"year": 2022, "answered": 4, "recommend_rate": 0.5},
    ]


def test_observations_carry_their_evidence(client):
    obs = client.get("/api/observations").json()
    ids = [o["id"] for o in obs]
    assert ids[0] == "catalogue-mix"
    assert "category-rating" not in ids  # no category has 20 rated products here
    assert "review-trend" not in ids  # fewer than 24 complete months
    satisfaction = next(o for o in obs if o["id"] == "satisfaction")
    assert satisfaction["evidence"]["positive_share"] == round(4 / 7, 4)
    loved = next(o for o in obs if o["id"] == "most-loved")
    assert loved["evidence"] == {"loves": 1500, "product_id": "P4"}
    assert all(o["evidence"] is not None for o in obs)

    makeup = [o["id"] for o in client.get("/api/observations", params={"category": "Makeup"}).json()]
    assert makeup == ["most-loved", "no-reviews"]


@pytest.mark.parametrize("path", ["/api/overview", "/api/observations", "/api/recommendations", "/api/trend"])
def test_unknown_category_is_rejected(client, path):
    assert client.get(path, params={"category": "Nope"}).status_code == 422
