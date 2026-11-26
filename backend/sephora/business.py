"""Business insights: documented rules that turn catalogue and review figures into findings.

Every list below comes from one explicit rule, returned with the response so the page can
state it. Loves are saves on Sephora's site and catalogue reviews are Sephora's own counts:
neither is a sale, so the findings describe engagement and satisfaction, not revenue.

Rules
    Hidden gems     catalogue rating >= 4.5, at least 50 catalogue reviews, and loves in
                    the bottom quarter of the product's primary category.
    At risk         loves in the top 10% of the category, at least 50 catalogue reviews,
                    and a catalogue rating at least 0.2 below the category mean.
    Momentum        Skincare products with at least 50 review rows both in the last two
                    years of the export and before; change = recent mean - earlier mean.
                    "Declining" <= -0.3 stars, "improving" >= +0.3 stars.
    Brand position  brands with at least 5 rated products, split at the median brand's
                    average catalogue rating and median loves per product.
    Category demand loves share / product share per primary category (1 = average).
"""

from __future__ import annotations

import pandas as pd

from sephora.analytics import _date, _r, _reviews_with_products
from sephora.data import Dataset
from sephora.products import product_table

GEM_MIN_RATING, GEM_MAX_LOVES_PCT = 4.5, 0.25
RISK_MIN_LOVES_PCT, RISK_MAX_RATING_GAP = 0.90, -0.2
MIN_CATALOGUE_REVIEWS = 50
MOMENTUM_DAYS, MOMENTUM_MIN_REVIEWS, MOMENTUM_THRESHOLD = 730, 50, 0.3
BRAND_MIN_RATED = 5
LIST_SIZE = 10

RULES = {
    "hidden_gems": f"Catalogue rating {GEM_MIN_RATING} or higher, {MIN_CATALOGUE_REVIEWS}+ catalogue reviews, loves in the bottom {GEM_MAX_LOVES_PCT:.0%} of the category.",
    "at_risk": f"Loves in the top {1 - RISK_MIN_LOVES_PCT:.0%} of the category, {MIN_CATALOGUE_REVIEWS}+ catalogue reviews, rating at least {-RISK_MAX_RATING_GAP} below the category mean.",
    "momentum": f"Skincare products with {MOMENTUM_MIN_REVIEWS}+ reviews in the last two years of the export and {MOMENTUM_MIN_REVIEWS}+ before; a change of {MOMENTUM_THRESHOLD} stars or more counts. Sizes that share one set of reviews count once.",
    "brands": f"Brands with {BRAND_MIN_RATED}+ rated products, split at the median brand's rating and loves per product.",
    "categories": "Share of all loves divided by share of products; above 1 means more saves per product than the catalogue average.",
}


def _product(x) -> dict:
    return {
        "product_id": str(x.product_id),
        "product_name": str(x.product_name),
        "brand_name": str(x.brand_name),
        "category": str(x.primary_category),
        "price": _r(x.price_usd, 2),
        "rating": _r(x.rating, 2),
        "category_rating": _r(x.category_rating, 2),
        "catalogue_reviews": int(x.reviews),
        "loves": int(x.loves_count),
        "loves_percentile": _r(x.loves_percentile, 3),
    }


def _scope(t: pd.DataFrame, category: str | None) -> pd.DataFrame:
    return t[t["primary_category"] == category] if category else t


def hidden_gems(ds: Dataset, category: str | None) -> pd.DataFrame:
    t = _scope(product_table(ds), category)
    m = (t["rating"] >= GEM_MIN_RATING) & (t["reviews"] >= MIN_CATALOGUE_REVIEWS) & (t["loves_percentile"] <= GEM_MAX_LOVES_PCT)
    return t[m.fillna(False)].sort_values(["rating", "reviews", "product_id"], ascending=[False, False, True])


def at_risk(ds: Dataset, category: str | None) -> pd.DataFrame:
    t = _scope(product_table(ds), category)
    m = (t["loves_percentile"] >= RISK_MIN_LOVES_PCT) & (t["reviews"] >= MIN_CATALOGUE_REVIEWS) & (t["rating_vs_category"] <= RISK_MAX_RATING_GAP)
    return t[m.fillna(False)].sort_values(["loves_count", "product_id"], ascending=[False, True])


def momentum(ds: Dataset) -> dict:
    """Average review rating in the last two years of the export against the years before."""

    def compute():
        r = _reviews_with_products(ds)
        if r.empty:
            return {"cutoff": None, "last_review": None, "eligible": 0, "median_change": None, "declining_count": 0, "improving_count": 0, "declining": [], "improving": []}
        last = r["date"].max()
        cutoff = last - pd.Timedelta(days=MOMENTUM_DAYS)
        recent = r["date"] > cutoff
        stats = r.groupby([recent.rename("recent"), "product_id"], observed=True)["rating"].agg(["mean", "size"]).unstack(0)
        stats.columns = [f"{a}_{'recent' if b else 'before'}" for a, b in stats.columns]
        need = ["size_before", "size_recent"]
        if not set(need) <= set(stats.columns):
            stats = stats.iloc[:0].reindex(columns=["mean_before", "mean_recent", *need])
        stats = stats[(stats["size_before"] >= MOMENTUM_MIN_REVIEWS) & (stats["size_recent"] >= MOMENTUM_MIN_REVIEWS)].copy()
        stats["change"] = stats["mean_recent"] - stats["mean_before"]
        names = ds.products.set_index("product_id")[["product_name", "brand_name"]]
        stats = stats.join(names)
        # Sizes of one product (e.g. "Mini ...") can share review rows in the export. Within a
        # brand, an identical earlier period (same count and mean) marks one review stream; it is
        # kept once: the size with the most recent reviews, then the shortest name.
        stats = (
            stats.assign(_len=stats["product_name"].str.len())
            .sort_values(["size_recent", "_len"], ascending=[False, True], kind="stable")
            .drop_duplicates(["brand_name", "mean_before", "size_before"])
            .drop(columns="_len")
            .sort_index()
        )

        def rows(frame):
            return [
                {
                    "product_id": str(pid),
                    "product_name": str(x.product_name),
                    "brand_name": str(x.brand_name),
                    "rating_before": _r(x.mean_before, 2),
                    "rating_recent": _r(x.mean_recent, 2),
                    "reviews_before": int(x.size_before),
                    "reviews_recent": int(x.size_recent),
                    "change": _r(x.change, 2),
                }
                for pid, x in zip(frame.index, frame.itertuples())
            ]

        declining = stats[stats["change"] <= -MOMENTUM_THRESHOLD].sort_values(["change", "size_recent"], ascending=[True, False])
        improving = stats[stats["change"] >= MOMENTUM_THRESHOLD].sort_values(["change", "size_recent"], ascending=[False, False])
        return {
            "cutoff": _date(cutoff),
            "last_review": _date(last),
            "eligible": len(stats),
            "median_change": _r(stats["change"].median(), 2) if len(stats) else None,
            "declining_count": len(declining),
            "improving_count": len(improving),
            "declining": rows(declining.head(LIST_SIZE)),
            "improving": rows(improving.head(LIST_SIZE)),
        }

    return ds.memo("business_momentum", compute)


def brand_positions(ds: Dataset, category: str | None) -> dict:
    t = _scope(product_table(ds), category)
    g = t.groupby("brand_name", observed=True).agg(
        products=("product_id", "size"),
        rated=("rating", "count"),
        rating=("rating", "mean"),
        loves_per_product=("loves_count", "median"),
    ).reset_index()
    g = g[g["rated"] >= BRAND_MIN_RATED]
    if g.empty:
        return {"brands": 0, "rating_split": None, "loves_split": None, "quadrants": [], "points": []}
    rating_split, loves_split = float(g["rating"].median()), float(g["loves_per_product"].median())
    high_r, high_l = g["rating"] >= rating_split, g["loves_per_product"] >= loves_split
    names = {
        "leaders": ("Leaders", high_r & high_l),
        "hidden_quality": ("Well rated, less saved", high_r & ~high_l),
        "popular_weaker": ("Popular, rated lower", ~high_r & high_l),
        "lagging": ("Lower rated, less saved", ~high_r & ~high_l),
    }
    quadrants = []
    for key, (label, mask) in names.items():
        q = g[mask].sort_values(["loves_per_product", "brand_name"], ascending=[False, True])
        quadrants.append({"key": key, "label": label, "brands": int(mask.sum()), "examples": q["brand_name"].head(5).tolist()})
    return {
        "brands": len(g),
        "rating_split": _r(rating_split, 2),
        "loves_split": _r(loves_split, 0),
        "quadrants": quadrants,
        "points": [
            {"brand_name": str(x.brand_name), "rating": _r(x.rating, 2), "loves_per_product": _r(x.loves_per_product, 0), "products": int(x.products)}
            for x in g.itertuples()
        ],
    }


def category_demand(ds: Dataset) -> list[dict]:
    t = product_table(ds)
    total_products, total_loves = len(t), float(t["loves_count"].sum())
    g = t.groupby("primary_category", observed=True).agg(products=("product_id", "size"), loves=("loves_count", "sum"), rating=("rating", "mean")).reset_index()
    out = []
    for x in g.itertuples():
        product_share = x.products / total_products
        loves_share = x.loves / total_loves if total_loves else 0.0
        out.append({
            "category": str(x.primary_category),
            "products": int(x.products),
            "product_share": _r(product_share),
            "loves_share": _r(loves_share),
            "demand_index": _r(loves_share / product_share, 2) if product_share else None,
            "average_rating": _r(x.rating, 2),
        })
    return sorted(out, key=lambda c: -(c["demand_index"] or 0))


def findings(gems: pd.DataFrame, risk: pd.DataFrame, mom: dict, demand: list[dict], category: str | None) -> list[dict]:
    """One finding per rule, with the figures behind it and a suggested next step."""
    out = []
    if len(gems):
        top = gems.iloc[0]
        out.append({
            "id": "hidden-gems",
            "title": f"{len(gems)} highly rated products are rarely saved",
            "detail": f"Rated {GEM_MIN_RATING}+ by at least {MIN_CATALOGUE_REVIEWS} reviewers but in the bottom quarter of their category for loves. Highest rated: {top['product_name']} ({top['brand_name']}, {top['rating']:.2f}).",
            "action": "Candidates for more visibility: placement, bundles or sampling.",
            "tone": "positive",
            "evidence": {"products": len(gems)},
        })
    if len(risk):
        top = risk.iloc[0]
        out.append({
            "id": "at-risk",
            "title": f"{len(risk)} popular products are rated below their category",
            "detail": f"Top 10% for loves but at least 0.2 stars under the category mean. Most loved: {top['product_name']} ({top['brand_name']}, {top['rating']:.2f} against {top['category_rating']:.2f}).",
            "action": "Read their low-star reviews to find the recurring complaint before it costs the product its following.",
            "tone": "warning",
            "evidence": {"products": len(risk)},
        })
    if category in (None, "Skincare") and mom["eligible"]:
        out.append({
            "id": "momentum",
            "title": f"{mom['declining_count']} Skincare products lost {MOMENTUM_THRESHOLD}+ stars recently",
            "detail": f"Of {mom['eligible']} products with enough reviews in both periods, {mom['declining_count']} declined and {mom['improving_count']} improved by {MOMENTUM_THRESHOLD}+ stars since {mom['cutoff']}. Median change: {mom['median_change']:+.2f} stars.",
            "action": "Check declining products for formula, packaging or price changes in the period.",
            "tone": "warning" if mom["declining_count"] > mom["improving_count"] else "positive",
            "evidence": {"eligible": mom["eligible"], "declining": mom["declining_count"], "improving": mom["improving_count"], "median_change": mom["median_change"]},
        })
    if category is None and demand:
        high = [c for c in demand if (c["demand_index"] or 0) > 1]
        if high:
            best = high[0]
            out.append({
                "id": "category-demand",
                "title": f"{best['category']} draws {best['demand_index']:.1f}× the average saves per product",
                "detail": f"{best['loves_share'] * 100:.1f}% of all loves from {best['product_share'] * 100:.1f}% of products. Categories above 1×: {', '.join(c['category'] for c in high)}.",
                "action": "Where demand per product is high, a wider range may find an audience.",
                "tone": "neutral",
                "evidence": {"demand_index": best["demand_index"], "loves_share": best["loves_share"], "product_share": best["product_share"]},
            })
    return out


def business_insights(ds: Dataset, category: str | None = None) -> dict:
    def compute():
        gems, risk = hidden_gems(ds, category), at_risk(ds, category)
        mom = momentum(ds)
        demand = category_demand(ds)
        return {
            "category": category,
            "rules": RULES,
            "findings": findings(gems, risk, mom, demand, category),
            "hidden_gems": {"count": len(gems), "items": [_product(x) for x in gems.head(LIST_SIZE).itertuples()]},
            "at_risk": {"count": len(risk), "items": [_product(x) for x in risk.head(LIST_SIZE).itertuples()]},
            "momentum": mom if category in (None, "Skincare") else None,
            "brands": brand_positions(ds, category),
            "categories": demand,
        }

    return ds.memo(("business_insights", category), compute)
