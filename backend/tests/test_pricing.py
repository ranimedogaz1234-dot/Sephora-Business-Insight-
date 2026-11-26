"""Pricing analytics on the synthetic catalogue (conftest.py; expected values by hand).

Skincare prices 40 (P1), 25 (P2), 18 (P3): P25 = 21.5, median = 25, P75 = 32.5, P90 = 37.
Makeup and Hair each have a single product, which is then at its category's P25.
"""

import pytest

from sephora.pricing import spearman


def test_segments_are_relative_to_the_category(client):
    body = client.get("/api/pricing").json()
    seg = {s["segment"]: s for s in body["segments"]}
    assert [seg[k]["products"] for k in ("Budget", "Mid-range", "Premium", "Luxury")] == [3, 1, 0, 1]
    assert seg["Budget"]["average_rating"] == 4.15  # P3 3.5 and P4 4.8 (P5 unrated)
    assert seg["Budget"]["recommend_rate"] == 0.0  # P3's only review does not recommend
    assert seg["Mid-range"]["recommend_rate"] == 1.0  # P2: one yes, one unanswered
    assert seg["Luxury"]["recommend_rate"] == 0.75
    assert seg["Premium"]["median_price"] is None and seg["Premium"]["recommend_rate"] is None


def test_distribution_and_correlation(client):
    body = client.get("/api/pricing").json()
    assert (body["median_price"], body["average_price"]) == (30.0, 33.6)
    assert body["percentiles"]["p25"] == 25.0
    counts = {b["label"]: b["products"] for b in body["bands"]}
    assert (counts["$10–20"], counts["$20–30"], counts["$30–40"], counts["$40–50"], counts["$50–75"]) == (1, 1, 1, 1, 1)
    assert body["rating_price_correlation"] == 0.8
    assert body["sale"] == {"products": 1, "median_discount": round(1 - 12 / 18, 4)}


def test_value_indicators(client):
    body = client.get("/api/pricing").json()
    positions = {v["key"]: v["products"] for v in body["value_positions"]}
    assert positions == {"high_value": 0, "premium_quality": 1, "low_cost": 1, "weak_value": 2, "unrated": 1}
    assert [p["product_id"] for p in body["best_affordable"]] == ["P4"]  # Budget with 50+ reviews
    assert body["high_value"] == []


def test_category_scope(client):
    body = client.get("/api/pricing", params={"category": "Skincare"}).json()
    assert body["products"] == 3
    # Within a category the spread is per subcategory: one product each, so ordered by median price.
    assert [(c["name"], c["median_price"]) for c in body["by_category"]] == [("Treatments", 40.0), ("Moisturizers", 25.0), ("Cleansers", 18.0)]
    assert client.get("/api/pricing", params={"category": "Cars"}).status_code == 422


@pytest.mark.parametrize(
    "x, y, expected",
    [([1, 2, 3, 4], [10, 20, 30, 40], 1.0), ([1, 2, 3, 4], [4, 3, 2, 1], -1.0), ([1, 1, 1], [1, 2, 3], None)],
)
def test_spearman(x, y, expected):
    import pandas as pd

    result = spearman(pd.Series(x), pd.Series(y))
    assert result == expected if expected is None else round(result, 6) == expected
