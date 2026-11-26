"""Pricing analytics on listed USD prices. Prices are never multiplied by review or love
counts: the data contains no sales, units or revenue.

Definitions (also shown on the Pricing page):
- Price segment, relative to the product's primary category (a $30 fragrance and a $30
  lipstick are not comparable): Budget <= category P25 < Mid-range <= P75 < Premium <= P90
  < Luxury.
- price_index: price / median price of the product's primary category (1.0 = typical).
- Value position: catalogue rating above / below the category mean x price below / above
  the category median. "High value" = rated above average and priced below the median.
- Rating vs price: Spearman rank correlation (robust to a few very expensive products).
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from sephora.analytics import _r, _reviews_with_products
from sephora.data import Dataset
from sephora.products import MIN_REVIEWS_FOR_RANKING, product_row, product_table

SEGMENTS = ("Budget", "Mid-range", "Premium", "Luxury")
BANDS = [0, 10, 20, 30, 40, 50, 75, 100, 150, 250, math.inf]
POSITIONS = {
    "high_value": "Rated above average, priced below median",
    "premium_quality": "Rated above average, priced above median",
    "low_cost": "Rated below average, priced below median",
    "weak_value": "Rated below average, priced above median",
}


def _priced(ds: Dataset) -> pd.DataFrame:
    """Catalogue with segment, price index and value position per product."""

    def compute():
        t = product_table(ds).copy()
        by = t.groupby("primary_category", observed=True)["price_usd"]
        q25, q75, q90, med = (by.transform(lambda s, q=q: s.quantile(q)) for q in (0.25, 0.75, 0.9, 0.5))
        t["segment"] = np.select(
            [t["price_usd"] <= q25, t["price_usd"] <= q75, t["price_usd"] <= q90], SEGMENTS[:3], default=SEGMENTS[3]
        )
        t["category_median_price"] = med
        t["price_index"] = t["price_usd"] / med
        above = t["rating_vs_category"] > 0
        cheap = t["price_usd"] < med
        t["value_position"] = np.select(
            [above & cheap, above & ~cheap, ~above & cheap, ~above & ~cheap], list(POSITIONS), default=""
        )
        t.loc[t["rating"].isna(), "value_position"] = "unrated"
        t["discount"] = 1 - t["sale_price_usd"] / t["price_usd"]
        return t

    return ds.memo("priced", compute)


def spearman(x: pd.Series, y: pd.Series) -> float | None:
    """Spearman's rho = Pearson correlation of average ranks (no SciPy needed)."""
    both = pd.DataFrame({"x": x, "y": y}).dropna()
    if len(both) < 3 or both["x"].nunique() < 2 or both["y"].nunique() < 2:
        return None
    return float(np.corrcoef(both["x"].rank(), both["y"].rank())[0, 1])


def _band_label(lo: float, hi: float) -> str:
    return f"${lo:.0f}+" if math.isinf(hi) else f"${lo:.0f}–{hi:.0f}"


def pricing(ds: Dataset, category: str | None = None) -> dict:
    def compute():
        t = _priced(ds)
        if category:
            t = t[t["primary_category"] == category]
        p = t["price_usd"]
        r = _reviews_with_products(ds)
        r = r[r["product_id"].isin(t["product_id"])]
        rec_by_product = r.groupby("product_id")["is_recommended"].agg(["sum", "count"])

        seg_rows = []
        for name in SEGMENTS:
            s = t[t["segment"] == name]
            rec = rec_by_product.reindex(s["product_id"]).dropna()
            seg_rows.append({
                "segment": name,
                "products": len(s),
                "share": _r(len(s) / len(t)) if len(t) else None,
                "median_price": _r(s["price_usd"].median(), 2) if len(s) else None,
                "min_price": _r(s["price_usd"].min(), 2) if len(s) else None,
                "max_price": _r(s["price_usd"].max(), 2) if len(s) else None,
                "average_rating": _r(s["rating"].mean(), 2) if s["rating"].notna().any() else None,
                "median_loves": _r(s["loves_count"].median(), 0) if len(s) else None,
                "recommend_rate": _r(rec["sum"].sum() / rec["count"].sum()) if rec["count"].sum() else None,
                "review_rows": int(s["review_count"].sum()),
            })

        bands = pd.cut(p, BANDS, right=False)
        band_rows = []
        for iv, group in t.groupby(bands, observed=False):
            rated = group["rating"].dropna()
            band_rows.append({
                "label": _band_label(iv.left, iv.right),
                "products": len(group),
                "average_rating": _r(rated.mean(), 2) if len(rated) else None,
                "top_rated_share": _r((rated >= 4.5).mean()) if len(rated) else None,
                "median_loves": _r(group["loves_count"].median(), 0) if len(group) else None,
            })

        def spread(by: str, limit: int | None = None, min_products: int = 1):
            g = t.groupby(by, observed=True)["price_usd"]
            stats = pd.DataFrame({
                "products": g.size(),
                "median": g.median(),
                "p25": g.quantile(0.25),
                "p75": g.quantile(0.75),
                "min": g.min(),
                "max": g.max(),
            })
            stats = stats[stats["products"] >= min_products].sort_values(["products", "median"], ascending=[False, False])
            if limit:
                stats = stats.head(limit)
            return [
                {"name": str(k), "products": int(v.products), "median_price": _r(v["median"], 2), "p25_price": _r(v.p25, 2),
                 "p75_price": _r(v.p75, 2), "min_price": _r(v["min"], 2), "max_price": _r(v["max"], 2)}
                for k, v in stats.iterrows()
            ]

        affordable = t[(t["segment"] == "Budget") & (t["reviews"] >= MIN_REVIEWS_FOR_RANKING)].sort_values(
            ["rating", "reviews", "product_id"], ascending=[False, False, True]
        )
        high_value = t[(t["value_position"] == "high_value") & (t["reviews"] >= MIN_REVIEWS_FOR_RANKING)].sort_values(
            ["rating_vs_category", "price_index", "product_id"], ascending=[False, True, True]
        )
        on_sale = t[t["sale_price_usd"].notna()]
        positions = t["value_position"].value_counts()
        return {
            "category": category,
            "products": len(t),
            "average_price": _r(p.mean(), 2) if len(t) else None,
            "median_price": _r(p.median(), 2) if len(t) else None,
            "percentiles": {f"p{q}": _r(p.quantile(q / 100), 2) if len(t) else None for q in (10, 25, 75, 90)},
            "min_price": _r(p.min(), 2) if len(t) else None,
            "max_price": _r(p.max(), 2) if len(t) else None,
            "histogram": [{"label": b["label"], "count": b["products"]} for b in band_rows],
            "segments": seg_rows,
            "bands": band_rows,
            "rating_price_correlation": _r(spearman(t["price_usd"], t["rating"]), 3),
            "loves_price_correlation": _r(spearman(t["price_usd"], t["loves_count"]), 3),
            "by_category": spread("primary_category" if not category else "secondary_category"),
            "by_brand": spread("brand_name", limit=15, min_products=5),
            "value_positions": [
                {"key": k, "label": label, "products": int(positions.get(k, 0))} for k, label in POSITIONS.items()
            ]
            + [{"key": "unrated", "label": "Not rated", "products": int(positions.get("unrated", 0))}],
            "best_affordable": [_priced_row(x) for x in affordable.head(10).itertuples()],
            "high_value": [_priced_row(x) for x in high_value.head(10).itertuples()],
            "sale": {
                "products": len(on_sale),
                "median_discount": _r(on_sale["discount"].median()) if len(on_sale) else None,
            },
            "min_reviews_for_ranking": MIN_REVIEWS_FOR_RANKING,
        }

    return ds.memo(("pricing", category), compute)


def _priced_row(x) -> dict:
    row = product_row(x)
    row.update({
        "segment": str(x.segment),
        "price_index": _r(x.price_index, 2),
        "category_median_price": _r(x.category_median_price, 2),
        "value_position": str(x.value_position),
    })
    return row
