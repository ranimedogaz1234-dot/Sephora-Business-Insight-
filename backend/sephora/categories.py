"""Category analytics with drill-down: primary -> secondary -> tertiary category.

Popularity is measured with documented engagement metrics, never sales:
- ``median_loves``: median number of loves (saves on Sephora's site) per product;
- ``loves_per_product``: total loves divided by products (sensitive to a few hits);
- ``catalogue_reviews_per_product``: Sephora's catalogue review count per product;
- ``review_rows``: customer reviews in the review files (Skincare only).
"""

from __future__ import annotations

import pandas as pd

from sephora.analytics import _r, _reviews_with_products
from sephora.data import Dataset
from sephora.products import MIN_REVIEWS_FOR_RANKING, product_row, product_table

LEVELS = ("primary_category", "secondary_category", "tertiary_category")
NOT_SUBDIVIDED = "Not subdivided"


def _with_levels(ds: Dataset) -> pd.DataFrame:
    def compute():
        t = product_table(ds).copy()
        t["tertiary_category"] = t["tertiary_category"].fillna(NOT_SUBDIVIDED)
        return t

    return ds.memo("category_levels", compute)


def _scope(ds: Dataset, primary: str | None, secondary: str | None) -> tuple[pd.DataFrame, int]:
    t = _with_levels(ds)
    depth = 0
    if primary:
        t, depth = t[t["primary_category"] == primary], 1
        if secondary:
            t, depth = t[t["secondary_category"] == secondary], 2
    return t, depth


def category_paths(ds: Dataset) -> dict:
    """Valid primary -> secondary pairs (for validating drill-down parameters)."""

    def compute():
        t = _with_levels(ds)
        out: dict[str, list[str]] = {}
        for (p, s), _ in t.groupby(["primary_category", "secondary_category"], observed=True):
            out.setdefault(str(p), []).append(str(s))
        return {k: sorted(v) for k, v in out.items()}

    return ds.memo("category_paths", compute)


def category_analytics(ds: Dataset, primary: str | None = None, secondary: str | None = None) -> dict:
    def compute():
        t, depth = _scope(ds, primary, secondary)
        level = LEVELS[depth]
        reviews = _reviews_with_products(ds)
        reviews = reviews[reviews["product_id"].isin(t["product_id"])]
        # Each review takes the category (at the level shown) of its product.
        rv = reviews.assign(_level=reviews["product_id"].map(t.set_index("product_id")[level]))
        rv_g = rv.groupby("_level", observed=True).agg(
            review_rows=("rating", "size"),
            average_review_rating=("rating", "mean"),
            recommend_rate=("is_recommended", "mean"),
        )
        g = t.groupby(level, observed=True).agg(
            products=("product_id", "size"),
            brands=("brand_name", "nunique"),
            median_price=("price_usd", "median"),
            p25_price=("price_usd", lambda s: s.quantile(0.25)),
            p75_price=("price_usd", lambda s: s.quantile(0.75)),
            average_price=("price_usd", "mean"),
            average_catalogue_rating=("rating", "mean"),
            rated_products=("rating", "count"),
            total_loves=("loves_count", "sum"),
            median_loves=("loves_count", "median"),
            catalogue_reviews=("reviews", "sum"),
            exclusives=("sephora_exclusive", "sum"),
        )
        g = g.join(rv_g, how="left").reset_index().sort_values(["products", level], ascending=[False, True])
        total = int(g["products"].sum())
        children = [
            {
                "name": str(getattr(row, level)),
                "products": int(row.products),
                "share": _r(row.products / total) if total else None,
                "brands": int(row.brands),
                "median_price": _r(row.median_price, 2),
                "p25_price": _r(row.p25_price, 2),
                "p75_price": _r(row.p75_price, 2),
                "average_price": _r(row.average_price, 2),
                "average_catalogue_rating": _r(row.average_catalogue_rating, 2),
                "rated_products": int(row.rated_products),
                "total_loves": int(row.total_loves),
                "median_loves": _r(row.median_loves, 0),
                "loves_per_product": _r(row.total_loves / row.products, 0),
                "catalogue_reviews_per_product": _r(row.catalogue_reviews / row.products, 1),
                "exclusive_share": _r(row.exclusives / row.products),
                "review_rows": 0 if pd.isna(row.review_rows) else int(row.review_rows),
                "average_review_rating": _r(row.average_review_rating, 2),
                "recommend_rate": _r(row.recommend_rate),
                "can_drill": depth < 2,
            }
            for row in g.itertuples()
        ]
        rated = t[t["reviews"] >= MIN_REVIEWS_FOR_RANKING].sort_values(
            ["rating", "reviews", "product_id"], ascending=[False, False, True]
        )
        return {
            "level": level,
            "path": [x for x in (primary, secondary) if x],
            "totals": {
                "products": len(t),
                "brands": int(t["brand_name"].nunique()),
                "children": len(children),
                "median_price": _r(t["price_usd"].median(), 2) if len(t) else None,
                "average_catalogue_rating": _r(t["rating"].mean(), 2) if t["rating"].notna().any() else None,
                "median_loves": _r(t["loves_count"].median(), 0) if len(t) else None,
                "review_rows": len(reviews),
            },
            "children": children,
            "most_loved": [product_row(r) for r in t.sort_values(["loves_count", "product_id"], ascending=[False, True]).head(10).itertuples()],
            "best_rated": [product_row(r) for r in rated.head(10).itertuples()],
            "min_reviews_for_ranking": MIN_REVIEWS_FOR_RANKING,
        }

    return ds.memo(("category_analytics", primary, secondary), compute)
