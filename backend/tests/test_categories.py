"""Category drill-down on the synthetic dataset (conftest.py; expected values by hand)."""

import pytest


def test_primary_level(client):
    body = client.get("/api/category-analytics").json()
    assert body["level"] == "primary_category" and body["path"] == []
    assert body["totals"] == {
        "products": 5, "brands": 3, "children": 3, "median_price": 30.0,
        "average_catalogue_rating": 4.2, "median_loves": 500.0, "review_rows": 7,
    }
    rows = {r["name"]: r for r in body["children"]}
    assert [r["name"] for r in body["children"]] == ["Skincare", "Hair", "Makeup"]
    skin = rows["Skincare"]
    assert (skin["products"], skin["median_price"], skin["p25_price"], skin["p75_price"]) == (3, 25.0, 21.5, 32.5)
    assert (skin["median_loves"], skin["loves_per_product"]) == (500.0, 567.0)  # 1700 / 3
    assert skin["catalogue_reviews_per_product"] == round(143 / 3, 1)
    assert (skin["review_rows"], skin["recommend_rate"]) == (7, round(4 / 6, 4))
    assert rows["Makeup"]["review_rows"] == 0 and rows["Makeup"]["average_review_rating"] is None
    assert all(r["can_drill"] for r in body["children"])


def test_drill_down(client):
    sec = client.get("/api/category-analytics", params={"primary": "Skincare"}).json()
    assert sec["level"] == "secondary_category" and sec["path"] == ["Skincare"]
    assert [r["name"] for r in sec["children"]] == ["Cleansers", "Moisturizers", "Treatments"]
    treat = next(r for r in sec["children"] if r["name"] == "Treatments")
    assert (treat["review_rows"], treat["average_review_rating"]) == (4, 3.75)

    ter = client.get("/api/category-analytics", params={"primary": "Skincare", "secondary": "Treatments"}).json()
    assert ter["level"] == "tertiary_category"
    assert [(r["name"], r["products"], r["can_drill"]) for r in ter["children"]] == [("Face Serums", 1, False)]

    hair = client.get("/api/category-analytics", params={"primary": "Hair", "secondary": "Other"}).json()
    assert [r["name"] for r in hair["children"]] == ["Not subdivided"]  # missing tertiary kept


def test_rankings_in_scope(client):
    body = client.get("/api/category-analytics", params={"primary": "Skincare"}).json()
    assert [p["product_id"] for p in body["most_loved"]] == ["P1", "P3", "P2"]
    assert [p["product_id"] for p in body["best_rated"]] == ["P1"]  # 50+ catalogue reviews


@pytest.mark.parametrize(
    "params", [{"primary": "Nope"}, {"secondary": "Treatments"}, {"primary": "Makeup", "secondary": "Treatments"}]
)
def test_invalid_paths(client, params):
    assert client.get("/api/category-analytics", params=params).status_code == 422
