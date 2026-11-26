"""Aggregations served by the API. Every figure is computed from the loaded dataset.

Two review counts are kept apart (see docs/DATASET.md):
- review rows: records in the review CSV files (``review_count`` fields);
- Sephora's catalogue figure: the ``reviews`` column of product_info.csv (``catalogue_reviews``).
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from sephora.data import Dataset


def _r(value, digits: int = 4):
    """Round a number; NaN/None become None (JSON null)."""
    if value is None:
        return None
    value = float(value)
    return None if math.isnan(value) else round(value, digits)


def _date(value) -> str | None:
    return None if pd.isna(value) else pd.Timestamp(value).date().isoformat()


def _reviews_with_products(ds: Dataset) -> pd.DataFrame:
    """Reviews joined (many-to-one) with catalogue names and categories."""

    def compute():
        info = ds.products.set_index("product_id")[
            ["product_name", "brand_name", "primary_category", "secondary_category"]
        ]
        return ds.reviews.join(info, on="product_id")

    return ds.memo("reviews_with_products", compute)


# ----------------------------------------------------------------------------- dashboard
def scoped(ds: Dataset, category: str | None) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Catalogue rows and joined review rows for one primary category (or everything)."""

    def compute():
        p = ds.products
        r = _reviews_with_products(ds)
        if category:
            p = p[p["primary_category"] == category]
            r = r[r["primary_category"] == category]
        return p, r

    return ds.memo(("scoped", category), compute)


def overview(ds: Dataset, category: str | None = None) -> dict:
    def compute():
        p, r = scoped(ds, category)
        rec = r["is_recommended"].dropna()
        scope = sorted(r["primary_category"].dropna().unique().tolist())
        return {
            "category": category,
            "total_products": len(p),
            "total_brands": int(p["brand_name"].nunique()),
            "total_categories": int(p["primary_category"].nunique()),
            "average_price": _r(p["price_usd"].mean(), 2) if len(p) else None,
            "median_price": _r(p["price_usd"].median(), 2) if len(p) else None,
            "average_catalogue_rating": _r(p["rating"].mean(), 2) if p["rating"].notna().any() else None,
            "total_loves": int(p["loves_count"].sum()),
            "total_reviews": len(r),
            "average_rating": _r(r["rating"].mean(), 2) if len(r) else None,
            "five_star_share": _r((r["rating"] == 5).mean()) if len(r) else None,
            "recommend_rate": _r(rec.mean()) if len(rec) else None,
            "recommend_answered": len(rec),
            "reviewed_products": int(r["product_id"].nunique()),
            "first_review": _date(r["date"].min()) if len(r) else None,
            "last_review": _date(r["date"].max()) if len(r) else None,
            "review_categories": scope,
            "raw_review_rows": ds.raw_review_rows,
            "duplicates_removed": ds.duplicates_removed,
        }

    return ds.memo(("overview", category), compute)


def category_mix(ds: Dataset) -> list[dict]:
    def compute():
        counts = ds.products["primary_category"].value_counts()
        total = int(counts.sum())
        items = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        return [
            {"category": str(k), "products": int(v), "share": _r(v / total)} for k, v in items
        ]

    return ds.memo("category_mix", compute)


def _rank_products(r: pd.DataFrame, limit: int) -> list[dict]:
    if r.empty:
        return []
    g = r.groupby("product_id", observed=True).agg(
        review_count=("rating", "size"),
        average_rating=("rating", "mean"),
        product_name=("product_name", "first"),
        brand_name=("brand_name", "first"),
    )
    g = g.reset_index().sort_values(
        ["review_count", "product_id"], ascending=[False, True], kind="mergesort"
    )
    return [
        {
            "product_id": str(row.product_id),
            "product_name": str(row.product_name),
            "brand_name": str(row.brand_name),
            "review_count": int(row.review_count),
            "average_rating": _r(row.average_rating, 2),
        }
        for row in g.head(limit).itertuples()
    ]


def top_products(ds: Dataset, limit: int, category: str | None = None) -> list[dict]:
    return ds.memo(("top_products", limit, category), lambda: _rank_products(scoped(ds, category)[1], limit))


def top_brands(ds: Dataset, limit: int, category: str | None = None) -> list[dict]:
    def compute():
        r = scoped(ds, category)[1]
        if r.empty:
            return []
        g = r.groupby("brand_name", observed=True).agg(
            review_count=("rating", "size"),
            average_rating=("rating", "mean"),
            products=("product_id", "nunique"),
        )
        g = g.reset_index().sort_values(
            ["review_count", "brand_name"], ascending=[False, True], kind="mergesort"
        )
        total = len(r)
        return [
            {
                "brand_name": str(row.brand_name),
                "review_count": int(row.review_count),
                "share": _r(row.review_count / total),
                "average_rating": _r(row.average_rating, 2),
                "products": int(row.products),
            }
            for row in g.head(limit).itertuples()
        ]

    return ds.memo(("top_brands", limit, category), compute)


def rating_distribution(r: pd.DataFrame) -> list[dict]:
    counts = r["rating"].value_counts().reindex(range(1, 6), fill_value=0)
    total = int(counts.sum())
    return [
        {"rating": int(k), "count": int(v), "share": _r(v / total) if total else 0.0}
        for k, v in counts.items()
    ]


def review_trend(r: pd.DataFrame, granularity: str) -> list[dict]:
    """Review count and average rating per month or year, with empty periods filled with 0."""
    if r.empty:
        return []
    freq = "MS" if granularity == "month" else "YS"
    period = r["date"].dt.to_period("M" if granularity == "month" else "Y").dt.to_timestamp()
    g = r.groupby(period).agg(review_count=("rating", "size"), average_rating=("rating", "mean"))
    full = pd.date_range(g.index.min(), g.index.max(), freq=freq)
    g = g.reindex(full)
    fmt = "%Y-%m" if granularity == "month" else "%Y"
    return [
        {
            "period": ts.strftime(fmt),
            "review_count": 0 if pd.isna(row.review_count) else int(row.review_count),
            "average_rating": _r(row.average_rating, 2),
        }
        for ts, row in zip(g.index, g.itertuples(), strict=True)
    ]


def ratings(ds: Dataset, category: str | None = None) -> list[dict]:
    return ds.memo(("ratings", category), lambda: rating_distribution(scoped(ds, category)[1]))


def trend(ds: Dataset, granularity: str, category: str | None = None) -> list[dict]:
    return ds.memo(("trend", granularity, category), lambda: review_trend(scoped(ds, category)[1], granularity))


# ----------------------------------------------------------------------------- filters
def filter_options(ds: Dataset) -> dict:
    def compute():
        r = _reviews_with_products(ds)
        subcats = r["secondary_category"].value_counts()
        years = r["date"].dt.year.value_counts().sort_index()
        return {
            "categories": [
                {"name": c["category"], "count": c["products"]} for c in category_mix(ds)
            ],
            "review_subcategories": [
                {"name": str(k), "count": int(v)}
                for k, v in sorted(subcats.items(), key=lambda kv: (-kv[1], kv[0]))
            ],
            "review_years": [int(y) for y in years.index],
        }

    return ds.memo("filter_options", compute)


# Product listing lives in sephora/products.py.


# ----------------------------------------------------------------------------- reviews
def _filtered_reviews(
    ds: Dataset, subcategory: str | None, year: int | None, rating: int | None
) -> pd.DataFrame:
    r = _reviews_with_products(ds)
    mask = np.ones(len(r), dtype=bool)
    if subcategory:
        mask &= (r["secondary_category"] == subcategory).to_numpy()
    if year:
        mask &= (r["date"].dt.year == year).to_numpy()
    if rating:
        mask &= (r["rating"] == rating).to_numpy()
    return r[mask]


def review_summary(
    ds: Dataset, subcategory: str | None, year: int | None, rating: int | None
) -> dict:
    def compute():
        r = _filtered_reviews(ds, subcategory, year, rating)
        rec = r["is_recommended"].dropna()
        granularity = "month" if year else "year"
        return {
            "total_reviews": len(r),
            "average_rating": _r(r["rating"].mean(), 2) if len(r) else None,
            "recommend_rate": _r(rec.mean()) if len(rec) else None,
            "reviewed_products": int(r["product_id"].nunique()),
            "ratings": rating_distribution(r),
            "granularity": granularity,
            "trend": review_trend(r, granularity),
            "top_products": _rank_products(r, 5),
        }

    return ds.memo(("review_summary", subcategory, year, rating), compute)


REVIEW_SORTS = {
    "recent": (["date"], [False]),
    "helpful": (["total_pos_feedback_count", "date"], [False, False]),
    "highest": (["rating", "date"], [False, False]),
    "lowest": (["rating", "date"], [True, False]),
}


def list_reviews(
    ds: Dataset,
    subcategory: str | None,
    year: int | None,
    rating: int | None,
    sort: str,
    page: int,
    page_size: int,
) -> dict:
    r = _filtered_reviews(ds, subcategory, year, rating)
    columns, ascending = REVIEW_SORTS[sort]
    # Stable sort with the row position as the final tie-break keeps pages deterministic.
    ordered = r.sort_values(columns, ascending=ascending, kind="mergesort")
    total = len(ordered)
    start = (page - 1) * page_size
    window = ordered.iloc[start : start + page_size]

    def text(value):
        return None if pd.isna(value) else str(value)

    return {
        "items": [
            {
                "product_id": str(row.product_id),
                "product_name": str(row.product_name),
                "brand_name": str(row.brand_name),
                "subcategory": text(row.secondary_category),
                "rating": int(row.rating),
                "recommended": None if pd.isna(row.is_recommended) else bool(row.is_recommended),
                "helpful_votes": int(row.total_pos_feedback_count),
                "date": _date(row.date),
                "title": text(row.review_title),
                "text": text(row.review_text),
                "skin_type": text(row.skin_type),
            }
            for row in window.itertuples()
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }
