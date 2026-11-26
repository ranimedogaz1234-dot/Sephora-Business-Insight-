"""Executive dashboard aggregates: category performance, recommendation patterns and
automatically computed observations. Every observation carries the figures it is based on.
"""

from __future__ import annotations

import pandas as pd

from sephora.analytics import _r, _reviews_with_products, overview, scoped, top_brands
from sephora.data import Dataset

# A category's average catalogue rating is only compared when enough products are rated.
MIN_RATED_PRODUCTS = 20


def category_performance(ds: Dataset) -> list[dict]:
    """One row per primary category: catalogue size, price, catalogue rating, loves and review rows."""

    def compute():
        p = ds.products
        r = _reviews_with_products(ds)
        g = p.groupby("primary_category", observed=True).agg(
            products=("product_id", "size"),
            brands=("brand_name", "nunique"),
            average_price=("price_usd", "mean"),
            median_price=("price_usd", "median"),
            average_catalogue_rating=("rating", "mean"),
            rated_products=("rating", "count"),
            total_loves=("loves_count", "sum"),
            median_loves=("loves_count", "median"),
            catalogue_reviews=("reviews", "sum"),
        )
        rv = r.groupby("primary_category", observed=True).agg(
            review_rows=("rating", "size"),
            average_review_rating=("rating", "mean"),
            recommend_rate=("is_recommended", "mean"),  # mean skips unknown answers
        )
        g = g.join(rv, how="left")
        total = int(g["products"].sum())
        g = g.reset_index().sort_values(["products", "primary_category"], ascending=[False, True])
        return [
            {
                "category": str(row.primary_category),
                "products": int(row.products),
                "share": _r(row.products / total),
                "brands": int(row.brands),
                "average_price": _r(row.average_price, 2),
                "median_price": _r(row.median_price, 2),
                "average_catalogue_rating": _r(row.average_catalogue_rating, 2),
                "rated_products": int(row.rated_products),
                "total_loves": int(row.total_loves),
                "median_loves": _r(row.median_loves, 0),
                "catalogue_reviews": int(row.catalogue_reviews),
                "review_rows": 0 if pd.isna(row.review_rows) else int(row.review_rows),
                "average_review_rating": _r(row.average_review_rating, 2),
                "recommend_rate": _r(row.recommend_rate),
            }
            for row in g.itertuples()
        ]

    return ds.memo("category_performance", compute)


def recommendation_patterns(ds: Dataset, category: str | None = None) -> dict:
    """Recommendation rate among reviewers who answered, by star rating and by year."""

    def compute():
        r = scoped(ds, category)[1]
        known = r[r["is_recommended"].notna()]
        by_rating = known.groupby("rating")["is_recommended"].agg(["mean", "size"]).reindex(range(1, 6))
        by_year = known.groupby(known["date"].dt.year)["is_recommended"].agg(["mean", "size"])
        return {
            "answered": len(known),
            "unanswered": len(r) - len(known),
            "recommend_rate": _r(known["is_recommended"].mean()) if len(known) else None,
            "by_rating": [
                {
                    "rating": int(k),
                    "answered": 0 if pd.isna(v["size"]) else int(v["size"]),
                    "recommend_rate": _r(v["mean"]),
                }
                for k, v in by_rating.iterrows()
            ],
            "by_year": [
                {"year": int(k), "answered": int(v["size"]), "recommend_rate": _r(v["mean"])}
                for k, v in by_year.iterrows()
            ],
        }

    return ds.memo(("recommendation_patterns", category), compute)


def _complete_months(r: pd.DataFrame) -> pd.Series:
    """Reviews per calendar month, without the last month (the export ends part-way through it)."""
    months = r["date"].dt.to_period("M").value_counts().sort_index()
    return months.iloc[:-1] if len(months) > 1 else months.iloc[:0]


def observations(ds: Dataset, category: str | None = None) -> list[dict]:
    """Short, data-backed observations. Each one lists the metrics it was computed from."""

    def compute():
        out: list[dict] = []
        p, r = scoped(ds, category)
        o = overview(ds, category)

        if category is None:
            perf = category_performance(ds)
            lead = perf[0]
            out.append({
                "id": "catalogue-mix",
                "title": f"{lead['category']} is the largest category",
                "detail": f"{lead['products']:,} of {o['total_products']:,} products "
                f"({lead['share'] * 100:.1f}% of the catalogue).",
                "tone": "neutral",
                "evidence": {"products": lead["products"], "share": lead["share"]},
            })
            rated = [c for c in perf if c["rated_products"] >= MIN_RATED_PRODUCTS]
            if rated:
                best = max(rated, key=lambda c: c["average_catalogue_rating"] or 0)
                worst = min(rated, key=lambda c: c["average_catalogue_rating"] or 5)
                out.append({
                    "id": "category-rating",
                    "title": f"{best['category']} has the highest average catalogue rating",
                    "detail": f"{best['average_catalogue_rating']:.2f} on average, against "
                    f"{worst['average_catalogue_rating']:.2f} for {worst['category']} "
                    f"(categories with at least {MIN_RATED_PRODUCTS} rated products).",
                    "tone": "positive",
                    "evidence": {
                        "best": best["average_catalogue_rating"],
                        "worst": worst["average_catalogue_rating"],
                    },
                })

        if len(p):
            loved = p.sort_values(["loves_count", "product_id"], ascending=[False, True]).iloc[0]
            out.append({
                "id": "most-loved",
                "title": f"Most loved: {loved['product_name']}",
                "detail": f"{loved['brand_name']}, {int(loved['loves_count']):,} loves "
                "(loves are saves on Sephora's site, not purchases).",
                "tone": "neutral",
                "evidence": {"loves": int(loved["loves_count"]), "product_id": str(loved["product_id"])},
            })

        if len(r):
            positive = float((r["rating"] >= 4).mean())
            negative = float((r["rating"] <= 2).mean())
            out.append({
                "id": "satisfaction",
                "title": f"{positive * 100:.1f}% of reviews give 4 or 5 stars",
                "detail": f"{negative * 100:.1f}% give 1 or 2 stars across {len(r):,} reviews.",
                "tone": "positive" if positive >= 0.75 else "warning",
                "evidence": {"positive_share": _r(positive), "negative_share": _r(negative)},
            })

            rec = recommendation_patterns(ds, category)["by_rating"]
            low, high = rec[0], rec[4]
            if low["recommend_rate"] is not None and high["recommend_rate"] is not None:
                out.append({
                    "id": "recommendation-gap",
                    "title": "Star ratings and recommendations agree",
                    "detail": f"{high['recommend_rate'] * 100:.1f}% of 5-star reviewers recommend the product, "
                    f"against {low['recommend_rate'] * 100:.1f}% of 1-star reviewers.",
                    "tone": "neutral",
                    "evidence": {"five_star": high["recommend_rate"], "one_star": low["recommend_rate"]},
                })

            months = _complete_months(r)
            if len(months) >= 24:
                last, prev = int(months.iloc[-12:].sum()), int(months.iloc[-24:-12].sum())
                change = (last - prev) / prev if prev else None
                if change is not None:
                    start, end = months.index[-12], months.index[-1]
                    out.append({
                        "id": "review-trend",
                        "title": f"Review volume {'rose' if change >= 0 else 'fell'} {abs(change) * 100:.0f}% year on year",
                        "detail": f"{last:,} reviews from {start.strftime('%b %Y')} to {end.strftime('%b %Y')}, "
                        f"against {prev:,} in the previous 12 months (complete months only).",
                        "tone": "positive" if change >= 0 else "warning",
                        "evidence": {"last_12_months": last, "previous_12_months": prev, "change": _r(change)},
                    })

            brands = top_brands(ds, 10, category)
            if brands:
                share = sum(b["share"] for b in brands)
                out.append({
                    "id": "brand-concentration",
                    "title": f"The top {len(brands)} brands hold {share * 100:.1f}% of reviews",
                    "detail": f"{brands[0]['brand_name']} leads with {brands[0]['review_count']:,} reviews.",
                    "tone": "neutral",
                    "evidence": {"top_brand_share": _r(share), "brands": len(brands)},
                })
        elif len(p):
            out.append({
                "id": "no-reviews",
                "title": "No customer reviews for this category",
                "detail": "The review files only cover Skincare products, so review-based figures are not available here.",
                "tone": "warning",
                "evidence": {},
            })
        return out

    return ds.memo(("observations", category), compute)
