"""Synthetic dataset written to a temp folder for every test session (no real data in Git)."""

import csv

import pytest
from fastapi.testclient import TestClient

from sephora import data

PRODUCT_HEADER = [
    "product_id", "product_name", "brand_id", "brand_name", "loves_count", "rating", "reviews",
    "price_usd", "primary_category", "secondary_category",
]
PRODUCTS = [
    ["P1", "Glow Serum", 1, "Alpha", 900, 4.5, 120, 40.0, "Skincare", "Treatments"],
    ["P2", "Soft Cream", 1, "Alpha", 300, 4.0, 15, 25.0, "Skincare", "Moisturizers"],
    ["P3", "Clean Gel", 2, "Beta", 500, 3.5, 8, 18.0, "Skincare", "Cleansers"],
    ["P4", "Red Lipstick", 2, "Beta", 1500, 4.8, 300, 30.0, "Makeup", "Lip"],
    ["P5", "Shine Oil", 3, "Gamma", 50, "", "", 55.0, "Hair", ""],
]
# Extra catalogue columns per product (P1..P5), appended to the rows above.
PRODUCT_EXTRA = {
    "tertiary_category": ["Face Serums", "Moisturizers", "Face Wash", "Lipstick", ""],
    "sale_price_usd": ["", "", 12.0, "", ""],
    "limited_edition": [0, 0, 0, 1, 0],
    "new": [1, 0, 0, 0, 0],
    "online_only": [0, 1, 0, 0, 1],
    "out_of_stock": [0, 0, 0, 0, 1],
    "sephora_exclusive": [1, 1, 0, 0, 0],
    "size": ["1 oz/ 30 mL", "", "", "", ""],
    "variation_type": ["Size", "", "", "Color", ""],
    "variation_value": ["1 oz/ 30 mL", "", "", "Ruby", ""],
    "variation_desc": ["", "", "", "bright red", ""],
    "value_price_usd": [55.0, "", "", "", ""],
    "child_count": [2, 0, 0, 5, 0],
    "child_min_price": [20.0, "", "", 30.0, ""],
    "child_max_price": [40.0, "", "", 30.0, ""],
    "highlights": ["['Vegan', 'Good for: Dryness']", "", "", "not a list", ""],
    "ingredients": ["['Water, Glycerin, Niacinamide.']", "", "", "", ""],
}
PRODUCT_HEADER = PRODUCT_HEADER + list(PRODUCT_EXTRA)
PRODUCTS = [row + [values[i] for values in PRODUCT_EXTRA.values()] for i, row in enumerate(PRODUCTS)]
REVIEW_HEADER = [
    "", "author_id", "rating", "is_recommended", "helpfulness", "total_feedback_count",
    "total_neg_feedback_count", "total_pos_feedback_count", "submission_time", "review_text",
    "review_title", "skin_tone", "eye_color", "skin_type", "hair_color", "product_id",
    "product_name", "brand_name", "price_usd",
]


def review(i, author, rating, rec, pos, date, pid, text="Nice", title="Title"):
    return [i, author, rating, rec, "", pos, 0, pos, date, text, title, "", "", "dry", "", pid, "x", "x", 1]


REVIEWS = {
    "reviews_0-250.csv": [
        review(0, "a1", 5, 1, 3, "2021-01-15", "P1", "Loved it"),
        review(1, "a2", 5, 1, 0, "2021-03-02", "P1"),
        review(2, "a3", 4, 1, 9, "2022-02-10", "P1"),
        review(3, "a4", 1, 0, 1, "2022-02-11", "P1", "Broke me out"),
    ],
    "reviews_250-500.csv": [
        review(0, "a5", 3, "", 0, "2021-01-20", "P2"),
        review(1, "a6", 5, 1, 2, "2022-05-05", "P2"),
    ],
    "reviews_500-750.csv": [review(0, "a7", 2, 0, 0, "2022-06-01", "P3")],
    # Exact copy of a row above (different export index): removed as a duplicate.
    "reviews_750-1250.csv": [review(7, "a1", 5, 1, 3, "2021-01-15", "P1", "Loved it")],
    # Review of a product that is not in the catalogue: dropped by the join.
    "reviews_1250-end.csv": [review(0, "a9", 4, 1, 0, "2022-01-01", "P999")],
}


def write_dataset(directory):
    with open(directory / "product_info.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(PRODUCT_HEADER)
        w.writerows(PRODUCTS)
    for name, rows in REVIEWS.items():
        with open(directory / name, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(REVIEW_HEADER)
            w.writerows(rows)


@pytest.fixture(scope="session")
def dataset_dir(tmp_path_factory):
    directory = tmp_path_factory.mktemp("sephora")
    write_dataset(directory)
    return directory


@pytest.fixture
def client(dataset_dir, monkeypatch):
    monkeypatch.setenv("SEPHORA_DATASET_DIR", str(dataset_dir))
    monkeypatch.setenv("SEPHORA_CACHE", "0")
    data.reset()
    from main import app

    yield TestClient(app)
    data.reset()
