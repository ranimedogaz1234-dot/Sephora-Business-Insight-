"""Product catalogue analytics: one filter shared by the list, the summary and exports.

Performance indicators (documented in the API and on the Products page):
- ``rating_vs_category``: the product's catalogue rating minus the mean catalogue rating of
  its primary category (rated products only). Positive = rated above its category.
- ``loves_percentile``: share of products in the same primary category with fewer loves
  (0–1). Loves are saves on Sephora's site, an engagement signal, not sales.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, fields

import numpy as np
import pandas as pd

from sephora.analytics import _r
from sephora.data import Dataset

SORTS = {
    "popular": ("loves_count", False),
    "rating": ("rating", False),
    "reviews": ("reviews", False),
    "price_asc": ("price_usd", True),
    "price_desc": ("price_usd", False),
    "name": ("product_name", True),
    "above_category": ("rating_vs_category", False),
}

FLAGS = {
    "new": ("new", "New"),
    "exclusive": ("sephora_exclusive", "Sephora exclusive"),
    "online_only": ("online_only", "Online only"),
    "limited_edition": ("limited_edition", "Limited edition"),
    "on_sale": (None, "On sale"),
    "in_stock": (None, "In stock"),
}

PRICE_BINS = [0, 15, 25, 35, 50, 75, 100, 150, math.inf]
RATING_BINS = [(1.0, 3.0), (3.0, 3.5), (3.5, 4.0), (4.0, 4.5), (4.5, 5.01)]
# A "best rated" product needs enough catalogue reviews for its rating to be meaningful.
MIN_REVIEWS_FOR_RANKING = 50


@dataclass(frozen=True)
class ProductFilters:
    q: str | None = None
    category: str | None = None
    subcategory: str | None = None
    brand: str | None = None
    min_price: float | None = None
    max_price: float | None = None
    min_rating: float | None = None
    min_reviews: int | None = None
    flag: str | None = None

    def key(self) -> tuple:
        return tuple(getattr(self, f.name) for f in fields(self))

    def applied(self) -> dict:
        return {f.name: getattr(self, f.name) for f in fields(self) if getattr(self, f.name) is not None}


def product_table(ds: Dataset) -> pd.DataFrame:
    """Catalogue with review-row counts and the two performance indicators."""

    def compute():
        t = ds.products.copy()
        t["review_count"] = t["product_id"].map(ds.reviews["product_id"].value_counts()).fillna(0).astype("int64")
        category_mean = t.groupby("primary_category", observed=True)["rating"].transform("mean")
        t["category_rating"] = category_mean
        t["rating_vs_category"] = t["rating"] - category_mean
        # rank(pct) with method="min": share of products in the category with fewer loves.
        size = t.groupby("primary_category", observed=True)["loves_count"].transform("size")
        lower = t.groupby("primary_category", observed=True)["loves_count"].rank(method="min") - 1
        t["loves_percentile"] = lower / (size - 1).where(size > 1, 1)
        t["on_sale"] = t["sale_price_usd"].notna()
        return t

    return ds.memo("product_table", compute)


def filter_products(ds: Dataset, f: ProductFilters) -> pd.DataFrame:
    def compute():
        t = product_table(ds)
        m = np.ones(len(t), dtype=bool)
        if f.q:
            # Literal, case-insensitive match on name or brand (never a regex).
            m &= (
                t["product_name"].str.contains(f.q, case=False, regex=False, na=False)
                | t["brand_name"].str.contains(f.q, case=False, regex=False, na=False)
            ).to_numpy()
        if f.category:
            m &= (t["primary_category"] == f.category).to_numpy()
        if f.subcategory:
            m &= (t["secondary_category"] == f.subcategory).to_numpy()
        if f.brand:
            m &= (t["brand_name"] == f.brand).to_numpy()
        if f.min_price is not None:
            m &= (t["price_usd"] >= f.min_price).to_numpy()
        if f.max_price is not None:
            m &= (t["price_usd"] <= f.max_price).to_numpy()
        if f.min_rating is not None:
            m &= (t["rating"] >= f.min_rating).fillna(False).to_numpy(dtype=bool)
        if f.min_reviews is not None:
            m &= (t["reviews"] >= f.min_reviews).fillna(False).to_numpy(dtype=bool)
        if f.flag == "on_sale":
            m &= t["on_sale"].to_numpy()
        elif f.flag == "in_stock":
            m &= (~t["out_of_stock"]).to_numpy()
        elif f.flag:
            m &= t[FLAGS[f.flag][0]].to_numpy()
        return t[m]

    return ds.memo(("filter_products", f.key()), compute)


def product_row(row) -> dict:
    def num(v, d=2):
        return _r(v, d)

    return {
        "product_id": str(row.product_id),
        "product_name": str(row.product_name),
        "brand_name": str(row.brand_name),
        "category": str(row.primary_category),
        "subcategory": str(row.secondary_category),
        "price": num(row.price_usd),
        "sale_price": num(row.sale_price_usd),
        "rating": num(row.rating),
        "catalogue_reviews": None if pd.isna(row.reviews) else int(row.reviews),
        "loves": int(row.loves_count),
        "review_count": int(row.review_count),
        "rating_vs_category": num(row.rating_vs_category),
        "loves_percentile": num(row.loves_percentile, 3),
        "flags": [key for key, (col, _) in FLAGS.items() if col and bool(getattr(row, col))]
        + (["on_sale"] if row.on_sale else [])
        + (["out_of_stock"] if row.out_of_stock else []),
    }


def list_products(ds: Dataset, f: ProductFilters, sort: str, page: int, page_size: int) -> dict:
    column, ascending = SORTS[sort]
    matched = filter_products(ds, f).sort_values(
        [column, "product_id"], ascending=[ascending, True], na_position="last", kind="mergesort"
    )
    total = len(matched)
    start = (page - 1) * page_size
    return {
        "items": [product_row(row) for row in matched.iloc[start : start + page_size].itertuples()],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


def _bin_label(lo: float, hi: float) -> str:
    return f"${lo:.0f}+" if math.isinf(hi) else f"${lo:.0f}–{hi:.0f}"


def product_summary(ds: Dataset, f: ProductFilters) -> dict:
    """Aggregates over the products matching the filters."""

    def compute():
        t = filter_products(ds, f)
        rated = t["rating"].dropna()
        prices = pd.cut(t["price_usd"], PRICE_BINS, right=False)
        price_hist = prices.value_counts(sort=False)
        brands = (
            t.groupby("brand_name", observed=True)
            .agg(products=("product_id", "size"), average_rating=("rating", "mean"), loves=("loves_count", "sum"))
            .reset_index()
            .sort_values(["products", "loves", "brand_name"], ascending=[False, False, True])
        )
        ranked = t[t["reviews"] >= MIN_REVIEWS_FOR_RANKING].sort_values(
            ["rating", "reviews", "product_id"], ascending=[False, False, True]
        )
        return {
            "total": len(t),
            "brands": int(t["brand_name"].nunique()),
            "categories": int(t["primary_category"].nunique()),
            "median_price": _r(t["price_usd"].median(), 2) if len(t) else None,
            "average_price": _r(t["price_usd"].mean(), 2) if len(t) else None,
            "min_price": _r(t["price_usd"].min(), 2) if len(t) else None,
            "max_price": _r(t["price_usd"].max(), 2) if len(t) else None,
            "average_rating": _r(rated.mean(), 2) if len(rated) else None,
            "rated": len(rated),
            "total_loves": int(t["loves_count"].sum()),
            "with_reviews_in_dataset": int((t["review_count"] > 0).sum()),
            "flags": {key: int(filter_flag(t, key).sum()) for key in FLAGS},
            "price_histogram": [
                {"label": _bin_label(iv.left, iv.right), "count": int(n)} for iv, n in price_hist.items()
            ],
            "rating_histogram": [
                {
                    "label": f"{lo:.1f}–{min(hi, 5):.1f}",
                    "count": int(((rated >= lo) & (rated < hi)).sum()),
                }
                for lo, hi in RATING_BINS
            ]
            + [{"label": "Not rated", "count": int(t["rating"].isna().sum())}],
            "top_brands": [
                {
                    "brand_name": str(b.brand_name),
                    "products": int(b.products),
                    "average_rating": _r(b.average_rating, 2),
                    "loves": int(b.loves),
                }
                for b in brands.head(10).itertuples()
            ],
            "category_split": [
                {"name": str(k), "count": int(v)}
                for k, v in t["primary_category"].value_counts().items()
            ],
            "best_rated": [product_row(r) for r in ranked.head(5).itertuples()],
            "most_loved": [
                product_row(r)
                for r in t.sort_values(["loves_count", "product_id"], ascending=[False, True]).head(5).itertuples()
            ],
            "min_reviews_for_ranking": MIN_REVIEWS_FOR_RANKING,
        }

    return ds.memo(("product_summary", f.key()), compute)


def filter_flag(t: pd.DataFrame, key: str) -> pd.Series:
    if key == "on_sale":
        return t["on_sale"]
    if key == "in_stock":
        return ~t["out_of_stock"]
    return t[FLAGS[key][0]]


def product_options(ds: Dataset) -> dict:
    """Values for the Products filters."""

    def compute():
        p = ds.products
        brands = p["brand_name"].value_counts()
        subcats = p.groupby(["primary_category", "secondary_category"], observed=True).size()
        return {
            "brands": [{"name": str(k), "count": int(v)} for k, v in sorted(brands.items(), key=lambda kv: kv[0].lower())],
            "subcategories": [
                {"category": str(c), "name": str(s), "count": int(n)} for (c, s), n in subcats.items()
            ],
            "flags": [{"key": k, "label": label} for k, (_, label) in FLAGS.items()],
            "price_range": [_r(p["price_usd"].min(), 2), _r(p["price_usd"].max(), 2)],
        }

    return ds.memo("product_options", compute)


# ----------------------------------------------------------------------------- details
PRODUCT_ID = r"^P\d{1,12}$"
RELATED_LIMIT = 6


def parse_list(value) -> list[str]:
    """Parse a catalogue list such as "['Vegan', 'Hydrating']" without executing code.

    ``ast.literal_eval`` only accepts Python literals. Anything that is not a list of
    strings is returned as one plain string (or dropped when empty).
    """
    import ast

    if value is None or pd.isna(value) or not str(value).strip():
        return []
    text = str(value).strip()
    try:
        parsed = ast.literal_eval(text)
    except (ValueError, SyntaxError, MemoryError, RecursionError):
        return [text]
    if isinstance(parsed, (list, tuple)) and all(isinstance(x, str) for x in parsed):
        return [x.strip() for x in parsed if x.strip()]
    return [text]


def _text(v) -> str | None:
    return None if v is None or pd.isna(v) or not str(v).strip() else str(v)


def product_details(ds: Dataset, product_id: str) -> dict | None:
    """Everything known about one product: catalogue attributes, indicators, review statistics
    (only when the review files contain the product), and related products."""
    from sephora.analytics import _date, rating_distribution, review_trend

    t = product_table(ds)
    match = t[t["product_id"] == product_id]
    if match.empty:
        return None
    row = match.iloc[0]
    info = product_row(next(match.itertuples()))
    info.update({
        "tertiary_category": _text(row["tertiary_category"]),
        "size": _text(row["size"]),
        "variation_type": _text(row["variation_type"]),
        "variation_value": _text(row["variation_value"]),
        "variation_desc": _text(row["variation_desc"]),
        "value_price": _r(row["value_price_usd"], 2),
        "variants": int(row["child_count"]),
        "variant_min_price": _r(row["child_min_price"], 2),
        "variant_max_price": _r(row["child_max_price"], 2),
        "highlights": parse_list(row["highlights"]),
        "ingredients": parse_list(row["ingredients"]),
        "category_rating": _r(row["category_rating"], 2),
    })

    r = ds.reviews[ds.reviews["product_id"] == product_id]
    reviews = None
    if len(r):
        rec = r["is_recommended"].dropna()
        years = r["date"].dt.year.nunique()
        granularity = "year" if years > 3 else "month"
        by_skin = (
            r.dropna(subset=["skin_type"])
            .groupby("skin_type", observed=True)
            .agg(count=("rating", "size"), average_rating=("rating", "mean"), recommend_rate=("is_recommended", "mean"))
            .reset_index()
            .sort_values(["count", "skin_type"], ascending=[False, True])
        )
        helpful = r.sort_values(["total_pos_feedback_count", "date"], ascending=[False, False], kind="mergesort").head(3)

        def card(x):
            return {
                "rating": int(x.rating),
                "recommended": None if pd.isna(x.is_recommended) else bool(x.is_recommended),
                "helpful_votes": int(x.total_pos_feedback_count),
                "date": _date(x.date),
                "title": _text(x.review_title),
                "text": _text(x.review_text),
                "skin_type": _text(x.skin_type),
            }

        reviews = {
            "count": len(r),
            "average_rating": _r(r["rating"].mean(), 2),
            "recommend_rate": _r(rec.mean()) if len(rec) else None,
            "recommend_answered": len(rec),
            "first_review": _date(r["date"].min()),
            "last_review": _date(r["date"].max()),
            "ratings": rating_distribution(r),
            "granularity": granularity,
            "trend": review_trend(r, granularity),
            "by_skin_type": [
                {
                    "name": str(s.skin_type),
                    "count": int(s.count),
                    "average_rating": _r(s.average_rating, 2),
                    "recommend_rate": _r(s.recommend_rate),
                }
                for s in by_skin.itertuples()
            ],
            "most_helpful": [card(x) for x in helpful.itertuples()],
        }

    # Related: same subcategory, price within half to double, most loved first.
    price = float(row["price_usd"])
    peers = t[
        (t["secondary_category"] == row["secondary_category"])
        & (t["primary_category"] == row["primary_category"])
        & (t["product_id"] != product_id)
        & t["price_usd"].between(price / 2, price * 2)
    ].sort_values(["loves_count", "product_id"], ascending=[False, True])
    brand = t[(t["brand_name"] == row["brand_name"]) & (t["product_id"] != product_id)].sort_values(
        ["loves_count", "product_id"], ascending=[False, True]
    )
    return {
        "product": info,
        "reviews": reviews,
        "related": [product_row(x) for x in peers.head(RELATED_LIMIT).itertuples()],
        "same_brand": [product_row(x) for x in brand.head(4).itertuples()],
        "related_rule": "Same subcategory, price between half and double, most loved first",
    }
