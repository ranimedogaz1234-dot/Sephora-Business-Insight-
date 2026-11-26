"""Review analytics: one ReviewFilters object shared by the summary, the list and exports.

Rating groups used here are *star ratings*: positive = 4–5 stars, neutral = 3, negative =
1–2. They are not text sentiment (see sephora/sentiment.py for the NLP classification).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, fields

import numpy as np
import pandas as pd

from sephora.analytics import _date, _r, _rank_products, _reviews_with_products, rating_distribution, review_trend
from sephora.data import Dataset

SORTS = {
    "recent": (["date"], [False]),
    "helpful": (["total_pos_feedback_count", "date"], [False, False]),
    "highest": (["rating", "date"], [False, False]),
    "lowest": (["rating", "date"], [True, False]),
    "longest": (["text_length", "date"], [False, False]),
}
LENGTH_BANDS = [(0, 0, "No text"), (1, 99, "Under 100"), (100, 299, "100–299"), (300, 599, "300–599"), (600, 10**9, "600+")]


@dataclass(frozen=True)
class ReviewFilters:
    subcategory: str | None = None
    year: int | None = None
    rating: int | None = None
    q: str | None = None
    product_id: str | None = None
    brand: str | None = None
    recommended: str | None = None  # "yes" | "no" | "unknown"
    skin_type: str | None = None
    has_text: bool | None = None

    def key(self) -> tuple:
        return tuple(getattr(self, f.name) for f in fields(self))

    def applied(self) -> dict:
        return {f.name: getattr(self, f.name) for f in fields(self) if getattr(self, f.name) is not None}


def _base(ds: Dataset) -> pd.DataFrame:
    def compute():
        r = _reviews_with_products(ds).copy()
        r["text_length"] = r["review_text"].str.len().fillna(0).astype("int64")
        return r

    return ds.memo("review_base", compute)


def filter_reviews(ds: Dataset, f: ReviewFilters) -> pd.DataFrame:
    def compute():
        r = _base(ds)
        m = np.ones(len(r), dtype=bool)
        if f.subcategory:
            m &= (r["secondary_category"] == f.subcategory).to_numpy()
        if f.year:
            m &= (r["date"].dt.year == f.year).to_numpy()
        if f.rating:
            m &= (r["rating"] == f.rating).to_numpy()
        if f.product_id:
            m &= (r["product_id"] == f.product_id).to_numpy()
        if f.brand:
            m &= (r["brand_name"] == f.brand).to_numpy()
        if f.recommended == "yes":
            m &= (r["is_recommended"] == 1).to_numpy()
        elif f.recommended == "no":
            m &= (r["is_recommended"] == 0).to_numpy()
        elif f.recommended == "unknown":
            m &= r["is_recommended"].isna().to_numpy()
        if f.skin_type:
            m &= (r["skin_type"] == f.skin_type).fillna(False).to_numpy(dtype=bool)
        if f.has_text is not None:
            m &= ((r["text_length"] > 0) == f.has_text).to_numpy()
        if f.q:
            # Literal, case-insensitive search in the title and the text (never a regex).
            sub = r[m]
            hit = sub["review_text"].str.contains(f.q, case=False, regex=False, na=False) | sub[
                "review_title"
            ].str.contains(f.q, case=False, regex=False, na=False)
            return sub[hit.to_numpy()]
        return r[m]

    return ds.memo(("filter_reviews", f.key()), compute)


def _sentiment_by_stars(r: pd.DataFrame) -> list[dict]:
    total = len(r)
    groups = [("positive", "Positive (4–5★)", r["rating"] >= 4), ("neutral", "Neutral (3★)", r["rating"] == 3), ("negative", "Negative (1–2★)", r["rating"] <= 2)]
    return [{"key": k, "label": label, "count": int(m.sum()), "share": _r(m.sum() / total) if total else None} for k, label, m in groups]


def review_summary(ds: Dataset, f: ReviewFilters) -> dict:
    def compute():
        r = filter_reviews(ds, f)
        rec = r["is_recommended"]
        granularity = "month" if f.year else "year"
        lengths = r["text_length"]
        votes = r["total_pos_feedback_count"] + r["total_neg_feedback_count"]
        out = {
            "filters": f.applied(),
            "total_reviews": len(r),
            "average_rating": _r(r["rating"].mean(), 2) if len(r) else None,
            "recommend_rate": _r(rec.dropna().mean()) if rec.notna().any() else None,
            "reviewed_products": int(r["product_id"].nunique()),
            "ratings": rating_distribution(r),
            "rating_groups": _sentiment_by_stars(r),
            "recommendation": {
                "yes": int((rec == 1).sum()),
                "no": int((rec == 0).sum()),
                "unknown": int(rec.isna().sum()),
            },
            "granularity": granularity,
            "trend": review_trend(r, granularity),
            "top_products": _rank_products(r, 5),
            "text": {
                "with_text": int((lengths > 0).sum()),
                "median_length": _r(lengths[lengths > 0].median(), 0) if (lengths > 0).any() else None,
                "length_bands": [
                    {
                        "label": label,
                        "count": int(((lengths >= lo) & (lengths <= hi)).sum()),
                        "average_rating": _r(r.loc[(lengths >= lo) & (lengths <= hi), "rating"].mean(), 2),
                    }
                    for lo, hi, label in LENGTH_BANDS
                ],
            },
            "helpfulness": {
                "with_votes": int((votes > 0).sum()),
                "total_helpful_votes": int(r["total_pos_feedback_count"].sum()),
                "total_unhelpful_votes": int(r["total_neg_feedback_count"].sum()),
            },
            "most_helpful": [review_card(x) for x in r.sort_values(["total_pos_feedback_count", "date"], ascending=[False, False], kind="mergesort").head(3).itertuples()],
        }
        if f.q:
            # How the searched term compares with the same filters without the term.
            base = filter_reviews(ds, ReviewFilters(**{**f.applied(), "q": None}))
            out["term"] = {
                "q": f.q,
                "matches": len(r),
                "base_reviews": len(base),
                "mention_share": _r(len(r) / len(base)) if len(base) else None,
                "average_rating_with_term": out["average_rating"],
                "average_rating_without_term": _r(base.loc[~base.index.isin(r.index), "rating"].mean(), 2)
                if len(base) > len(r)
                else None,
            }
        return out

    return ds.memo(("review_summary", f.key()), compute)


def _text(v) -> str | None:
    return None if pd.isna(v) else str(v)


def review_card(row) -> dict:
    return {
        "product_id": str(row.product_id),
        "product_name": str(row.product_name),
        "brand_name": str(row.brand_name),
        "subcategory": _text(row.secondary_category),
        "rating": int(row.rating),
        "recommended": None if pd.isna(row.is_recommended) else bool(row.is_recommended),
        "helpful_votes": int(row.total_pos_feedback_count),
        "unhelpful_votes": int(row.total_neg_feedback_count),
        "date": _date(row.date),
        "title": _text(row.review_title),
        "text": _text(row.review_text),
        "skin_type": _text(row.skin_type),
    }


def list_reviews(ds: Dataset, f: ReviewFilters, sort: str, page: int, page_size: int) -> dict:
    r = filter_reviews(ds, f)
    columns, ascending = SORTS[sort]
    # Stable sort with the row position as the final tie-break keeps pages deterministic.
    ordered = r.sort_values(columns, ascending=ascending, kind="mergesort")
    total = len(ordered)
    start = (page - 1) * page_size
    return {
        "items": [review_card(x) for x in ordered.iloc[start : start + page_size].itertuples()],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


def review_options(ds: Dataset) -> dict:
    def compute():
        r = _base(ds)
        return {
            "brands": sorted(r["brand_name"].dropna().unique().tolist(), key=str.lower),
            "skin_types": sorted(r["skin_type"].dropna().unique().tolist()),
        }

    return ds.memo("review_options", compute)
