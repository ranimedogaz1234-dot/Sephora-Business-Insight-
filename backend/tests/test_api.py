"""API tests on the synthetic dataset in conftest.py (expected values worked out by hand)."""

import pytest

from sephora import data


def test_health_reports_dataset(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["dataset_ready"] is True


def test_overview_kpis(client):
    o = client.get("/api/overview").json()
    assert o["total_products"] == 5
    assert o["total_brands"] == 3
    assert o["total_categories"] == 3
    # 9 raw rows, 1 exact duplicate removed, 1 orphan review dropped -> 7 reviews
    assert o["raw_review_rows"] == 9
    assert o["duplicates_removed"] == 1
    assert o["total_reviews"] == 7
    assert o["average_rating"] == round(25 / 7, 2)  # 5+5+4+1+3+5+2
    assert o["five_star_share"] == round(3 / 7, 4)
    assert o["recommend_rate"] == round(4 / 6, 4)  # one unknown response excluded
    assert o["reviewed_products"] == 3
    assert (o["first_review"], o["last_review"]) == ("2021-01-15", "2022-06-01")
    assert o["review_categories"] == ["Skincare"]
    assert o["average_price"] == 33.6


def test_category_mix(client):
    assert client.get("/api/categories").json() == [
        {"category": "Skincare", "products": 3, "share": 0.6},
        {"category": "Hair", "products": 1, "share": 0.2},
        {"category": "Makeup", "products": 1, "share": 0.2},
    ]


def test_top_products_and_brands(client):
    top = client.get("/api/top-products", params={"limit": 2}).json()
    assert [(p["product_id"], p["review_count"]) for p in top] == [("P1", 4), ("P2", 2)]
    assert top[0]["average_rating"] == 3.75
    assert top[0]["product_name"] == "Glow Serum"  # names come from the catalogue

    brands = client.get("/api/top-brands").json()
    assert [(b["brand_name"], b["review_count"], b["products"]) for b in brands] == [
        ("Alpha", 6, 2),
        ("Beta", 1, 1),
    ]
    assert brands[0]["share"] == round(6 / 7, 4)


def test_rating_distribution_has_all_five_stars(client):
    body = client.get("/api/ratings").json()
    assert [(b["rating"], b["count"]) for b in body] == [(1, 1), (2, 1), (3, 1), (4, 1), (5, 3)]
    assert sum(b["share"] for b in body) == pytest.approx(1, abs=1e-3)


def test_trend_fills_empty_periods(client):
    months = client.get("/api/trend").json()
    assert len(months) == 18  # 2021-01 .. 2022-06
    assert months[0] == {"period": "2021-01", "review_count": 2, "average_rating": 4.0}
    assert months[1] == {"period": "2021-02", "review_count": 0, "average_rating": None}
    years = client.get("/api/trend", params={"granularity": "year"}).json()
    assert [(y["period"], y["review_count"]) for y in years] == [("2021", 3), ("2022", 4)]


def test_filters(client):
    f = client.get("/api/filters").json()
    assert [c["name"] for c in f["categories"]] == ["Skincare", "Hair", "Makeup"]
    assert [s["name"] for s in f["review_subcategories"]] == ["Treatments", "Moisturizers", "Cleansers"]
    assert f["review_years"] == [2021, 2022]


def test_products_search_filter_sort_page(client):
    body = client.get("/api/products").json()
    assert body["total"] == 5
    assert [p["product_id"] for p in body["items"]] == ["P4", "P1", "P3", "P2", "P5"]  # loves

    search = client.get("/api/products", params={"q": "alpha"}).json()  # brand, any case
    assert [p["product_id"] for p in search["items"]] == ["P1", "P2"]
    assert client.get("/api/products", params={"q": "s.*"}).json()["total"] == 0  # literal

    skincare = client.get("/api/products", params={"category": "Skincare", "sort": "price_asc"}).json()
    assert [p["price"] for p in skincare["items"]] == [18.0, 25.0, 40.0]

    rated = client.get("/api/products", params={"sort": "rating"}).json()["items"]
    assert rated[-1]["product_id"] == "P5" and rated[-1]["rating"] is None  # missing last

    page = client.get("/api/products", params={"page": 2, "page_size": 2}).json()
    assert (page["total_pages"], [p["product_id"] for p in page["items"]]) == (3, ["P3", "P2"])
    p1 = next(p for p in body["items"] if p["product_id"] == "P1")
    assert (p1["catalogue_reviews"], p1["review_count"]) == (120, 4)  # kept apart


def test_review_summary_filters(client):
    s = client.get("/api/reviews/summary").json()
    assert (s["total_reviews"], s["granularity"]) == (7, "year")
    assert [p["product_id"] for p in s["top_products"]] == ["P1", "P2", "P3"]

    y = client.get("/api/reviews/summary", params={"year": 2022, "subcategory": "Treatments"}).json()
    assert y["total_reviews"] == 2 and y["average_rating"] == 2.5
    assert y["granularity"] == "month"
    assert [t["period"] for t in y["trend"]] == ["2022-02"]

    empty = client.get("/api/reviews/summary", params={"rating": 3, "year": 2022}).json()
    assert empty["total_reviews"] == 0
    assert empty["average_rating"] is None and empty["trend"] == []


def test_review_list_sorting_and_privacy(client):
    body = client.get("/api/reviews", params={"page_size": 3}).json()
    assert body["total"] == 7 and body["total_pages"] == 3
    assert [r["date"] for r in body["items"]] == ["2022-06-01", "2022-05-05", "2022-02-11"]
    item = body["items"][0]
    assert "author_id" not in item and "a7" not in str(body)

    helpful = client.get("/api/reviews", params={"sort": "helpful"}).json()["items"]
    assert helpful[0]["helpful_votes"] == 9
    lowest = client.get("/api/reviews", params={"sort": "lowest", "rating": 1}).json()["items"]
    assert [(r["rating"], r["text"]) for r in lowest] == [(1, "Broke me out")]


@pytest.mark.parametrize(
    "path, params",
    [
        ("/api/products", {"q": "a"}),
        ("/api/products", {"category": "Nope"}),
        ("/api/products", {"sort": "loves_count; drop"}),
        ("/api/products", {"page": 0}),
        ("/api/products", {"page_size": 500}),
        ("/api/reviews", {"rating": 6}),
        ("/api/reviews", {"subcategory": "Unknown"}),
        ("/api/reviews/summary", {"year": "abc"}),
        ("/api/top-products", {"limit": 1000}),
        ("/api/trend", {"granularity": "day"}),
    ],
)
def test_invalid_input_is_rejected(client, path, params):
    assert client.get(path, params=params).status_code == 422


def test_unconfigured_dataset_returns_503_without_paths(monkeypatch):
    from fastapi.testclient import TestClient

    from main import app

    monkeypatch.setenv("SEPHORA_DATASET_DIR", "")
    data.reset()
    response = TestClient(app).get("/api/overview")
    assert response.status_code == 503
    assert response.json() == {"detail": "Dataset is not available"}


def test_security_headers(client):
    headers = client.get("/health").headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"
