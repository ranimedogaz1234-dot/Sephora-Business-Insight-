"""Brand analytics: directory, rankings and one-brand analysis.

Catalogue metrics (products, prices, catalogue rating, loves) cover every brand. Review
metrics come from the review files and therefore only exist for brands with Skincare
products in those files; they are null otherwise, never 0.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from sephora.analytics import _r, _reviews_with_products, rating_distribution, review_trend
from sephora.data import Dataset
from sephora.products import product_row, product_table

SORTS = {
    "products": ("products", False),
    "loves": ("total_loves", False),
    "rating": ("average_catalogue_rating", False),
    "reviews": ("review_rows", False),
    "recommend": ("recommend_rate", False),
    "price_desc": ("median_price", False),
    "price_asc": ("median_price", True),
    "name": ("name_key", True),
}
# Rankings by an average are only meaningful for brands with a few products.
DEFAULT_MIN_PRODUCTS = 1


def brand_table(ds: Dataset) -> pd.DataFrame:
    def compute():
        p = ds.products
        g = p.groupby(["brand_id", "brand_name"], observed=True).agg(
            products=("product_id", "size"),
            categories=("primary_category", "nunique"),
            main_category=("primary_category", lambda s: s.value_counts().index[0]),
            median_price=("price_usd", "median"),
            average_price=("price_usd", "mean"),
            min_price=("price_usd", "min"),
            max_price=("price_usd", "max"),
            average_catalogue_rating=("rating", "mean"),
            rated_products=("rating", "count"),
            total_loves=("loves_count", "sum"),
            catalogue_reviews=("reviews", "sum"),
            exclusives=("sephora_exclusive", "sum"),
            new_products=("new", "sum"),
        )
        r = _reviews_with_products(ds)
        rv = r.groupby("brand_name", observed=True).agg(
            review_rows=("rating", "size"),
            average_review_rating=("rating", "mean"),
            recommend_rate=("is_recommended", "mean"),
            reviewed_products=("product_id", "nunique"),
        )
        g = g.reset_index().join(rv, on="brand_name")
        g["review_rows"] = g["review_rows"].fillna(0).astype("int64")
        g["reviewed_products"] = g["reviewed_products"].fillna(0).astype("int64")
        g["name_key"] = g["brand_name"].str.lower()
        for col in ("products", "total_loves", "review_rows"):
            g[f"rank_{col}"] = g[col].rank(method="min", ascending=False).astype("int64")
        return g

    return ds.memo("brand_table", compute)


def brand_row(b) -> dict:
    return {
        "brand_id": int(b.brand_id),
        "brand_name": str(b.brand_name),
        "products": int(b.products),
        "categories": int(b.categories),
        "main_category": str(b.main_category),
        "median_price": _r(b.median_price, 2),
        "average_price": _r(b.average_price, 2),
        "min_price": _r(b.min_price, 2),
        "max_price": _r(b.max_price, 2),
        "average_catalogue_rating": _r(b.average_catalogue_rating, 2),
        "rated_products": int(b.rated_products),
        "total_loves": int(b.total_loves),
        "catalogue_reviews": int(b.catalogue_reviews),
        "exclusives": int(b.exclusives),
        "new_products": int(b.new_products),
        "review_rows": int(b.review_rows),
        "reviewed_products": int(b.reviewed_products),
        "average_review_rating": _r(b.average_review_rating, 2),
        "recommend_rate": _r(b.recommend_rate),
        "rank_products": int(b.rank_products),
        "rank_loves": int(b.rank_total_loves),
        "rank_reviews": int(b.rank_review_rows) if b.review_rows else None,
    }


def _filter(ds: Dataset, q: str | None, category: str | None, min_products: int) -> pd.DataFrame:
    g = brand_table(ds)
    m = (g["products"] >= min_products).to_numpy()
    if q:
        m &= g["brand_name"].str.contains(q, case=False, regex=False, na=False).to_numpy()
    if category:
        has = ds.products.loc[ds.products["primary_category"] == category, "brand_id"].unique()
        m &= g["brand_id"].isin(has).to_numpy()
    return g[m]


def list_brands(
    ds: Dataset, q: str | None, category: str | None, min_products: int, sort: str, page: int, page_size: int
) -> dict:
    column, ascending = SORTS[sort]
    g = _filter(ds, q, category, min_products).sort_values(
        [column, "name_key"], ascending=[ascending, True], na_position="last", kind="mergesort"
    )
    total = len(g)
    start = (page - 1) * page_size
    return {
        "items": [brand_row(b) for b in g.iloc[start : start + page_size].itertuples()],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


def brands_summary(ds: Dataset, category: str | None, min_products: int) -> dict:
    def compute():
        g = _filter(ds, None, category, min_products)
        p = ds.products if not category else ds.products[ds.products["primary_category"] == category]
        sizes = g["products"]
        top10 = g.sort_values("products", ascending=False).head(10)["products"].sum()
        buckets = [(1, 4, "1–4"), (5, 9, "5–9"), (10, 24, "10–24"), (25, 49, "25–49"), (50, 99, "50–99"), (100, 10**9, "100+")]
        scatter = g[g["rated_products"] >= 5]
        return {
            "brands": len(g),
            "brands_with_reviews": int((g["review_rows"] > 0).sum()),
            "median_products": _r(sizes.median(), 1) if len(g) else None,
            "top10_product_share": _r(top10 / len(p)) if len(p) else None,
            "size_distribution": [
                {"label": label, "count": int(((sizes >= lo) & (sizes <= hi)).sum())} for lo, hi, label in buckets
            ],
            "by_products": [brand_row(b) for b in g.sort_values(["products", "name_key"], ascending=[False, True]).head(10).itertuples()],
            "by_loves": [brand_row(b) for b in g.sort_values(["total_loves", "name_key"], ascending=[False, True]).head(10).itertuples()],
            "by_reviews": [
                brand_row(b)
                for b in g[g["review_rows"] > 0].sort_values(["review_rows", "name_key"], ascending=[False, True]).head(10).itertuples()
            ],
            "price_vs_rating": [
                {
                    "brand_id": int(b.brand_id),
                    "brand_name": str(b.brand_name),
                    "median_price": _r(b.median_price, 2),
                    "average_catalogue_rating": _r(b.average_catalogue_rating, 2),
                    "products": int(b.products),
                }
                for b in scatter.itertuples()
            ],
            "scatter_min_rated": 5,
        }

    return ds.memo(("brands_summary", category, min_products), compute)


def brand_options(ds: Dataset) -> list[dict]:
    g = brand_table(ds).sort_values("name_key")
    return [{"brand_id": int(b.brand_id), "brand_name": str(b.brand_name), "products": int(b.products)} for b in g.itertuples()]


def brand_details(ds: Dataset, brand_id: int) -> dict | None:
    def compute():
        g = brand_table(ds)
        match = g[g["brand_id"] == brand_id]
        if match.empty:
            return None
        b = next(match.itertuples())
        t = product_table(ds)
        p = t[t["brand_id"] == brand_id]
        cats = p.groupby(["primary_category", "secondary_category"], observed=True).agg(
            products=("product_id", "size"), average_rating=("rating", "mean"), median_price=("price_usd", "median")
        ).reset_index().sort_values(["products", "secondary_category"], ascending=[False, True])
        prices = p["price_usd"]
        r = _reviews_with_products(ds)
        r = r[r["brand_name"] == b.brand_name]
        reviews = None
        if len(r):
            rec = r["is_recommended"].dropna()
            granularity = "year" if r["date"].dt.year.nunique() > 3 else "month"
            top = (
                r.groupby("product_id", observed=True)
                .agg(review_count=("rating", "size"), average_rating=("rating", "mean"))
                .reset_index()
                .sort_values(["review_count", "product_id"], ascending=[False, True])
                .head(8)
                .join(p.set_index("product_id")["product_name"], on="product_id")
            )
            reviews = {
                "count": len(r),
                "average_rating": _r(r["rating"].mean(), 2),
                "recommend_rate": _r(rec.mean()) if len(rec) else None,
                "recommend_answered": len(rec),
                "ratings": rating_distribution(r),
                "granularity": granularity,
                "trend": review_trend(r, granularity),
                "top_products": [
                    {
                        "product_id": str(x.product_id),
                        "product_name": str(x.product_name),
                        "review_count": int(x.review_count),
                        "average_rating": _r(x.average_rating, 2),
                    }
                    for x in top.itertuples()
                ],
            }
        catalogue_mean = ds.products["rating"].mean()
        return {
            "brand": brand_row(b),
            "brands_total": len(g),
            "catalogue_average_rating": _r(catalogue_mean, 2),
            "catalogue_median_price": _r(ds.products["price_usd"].median(), 2),
            "categories": [
                {
                    "category": str(c.primary_category),
                    "subcategory": str(c.secondary_category),
                    "products": int(c.products),
                    "average_rating": _r(c.average_rating, 2),
                    "median_price": _r(c.median_price, 2),
                }
                for c in cats.itertuples()
            ],
            "price_quartiles": [_r(np.quantile(prices, q), 2) for q in (0, 0.25, 0.5, 0.75, 1)],
            "products": [
                product_row(x)
                for x in p.sort_values(["loves_count", "product_id"], ascending=[False, True]).head(12).itertuples()
            ],
            "reviews": reviews,
        }

    return ds.memo(("brand_details", brand_id), compute)
