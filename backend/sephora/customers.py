"""Customer insights from the optional, self-reported reviewer attributes.

What the data supports, and what it does not:
- Attributes (skin type, skin tone, eye colour, hair colour) are optional answers given with
  each review. Shares are shares of *reviews that answered*, not of people: one reviewer
  can write many reviews, and answers may differ between reviews.
- Missing answers are reported as coverage and excluded from shares; they are never
  guessed.
- The only count of people-like units is the number of distinct reviewer IDs in the export
  (an account identifier, not a verified person); IDs themselves are never kept.
- No age, gender, income or location exists in the data, so none is shown.
"""

from __future__ import annotations

import pandas as pd

from sephora.analytics import _r, _reviews_with_products
from sephora.data import REVIEWER_ATTRIBUTES, Dataset

ATTRIBUTE_NAMES = {
    "skin_type": "Skin type",
    "skin_tone": "Skin tone",
    "eye_color": "Eye colour",
    "hair_color": "Hair colour",
}
# Source codes -> display labels (spelling variants merged: "Grey" and "gray").
LABELS = {
    "porcelain": "Porcelain",
    "fair": "Fair",
    "fairlight": "Fair-light",
    "light": "Light",
    "lightmedium": "Light-medium",
    "medium": "Medium",
    "mediumtan": "Medium-tan",
    "olive": "Olive",
    "tan": "Tan",
    "deep": "Deep",
    "dark": "Dark",
    "rich": "Rich",
    "ebony": "Ebony",
    "notsurest": "Not sure",
    "grey": "Gray",
}
# Skin tones in the order of Sephora's scale (lightest to deepest), then "Not sure".
TONE_ORDER = ["porcelain", "fair", "fairlight", "light", "lightmedium", "medium", "mediumtan", "olive", "tan", "deep", "dark", "rich", "ebony", "notsurest"]
# A group's preferences are only listed when it has enough reviews to be stable.
MIN_GROUP_REVIEWS_FOR_PRODUCT = 100
MIN_SUBCATEGORY_REVIEWS = 200


def _key(value: str) -> str:
    k = str(value).strip().lower()
    return "gray" if k == "grey" else k


def label(key: str) -> str:
    return LABELS.get(key, key.capitalize())


def _scoped(ds: Dataset, subcategory: str | None) -> pd.DataFrame:
    def compute():
        r = _reviews_with_products(ds)
        if subcategory:
            r = r[r["secondary_category"] == subcategory]
        return r

    return ds.memo(("customer_scope", subcategory), compute)


def _group_stats(r: pd.DataFrame, attribute: str) -> list[dict]:
    known = r[r[attribute].notna()]
    if known.empty:
        return []
    keys = known[attribute].map(_key)
    g = known.assign(_k=keys).groupby("_k", observed=True)
    stats = g.agg(
        count=("rating", "size"),
        average_rating=("rating", "mean"),
        recommend_rate=("is_recommended", "mean"),
    )
    shares = g["rating"].value_counts(normalize=True).unstack(fill_value=0).reindex(columns=range(1, 6), fill_value=0)
    total = int(stats["count"].sum())
    if attribute == "skin_tone":
        order = [k for k in TONE_ORDER if k in stats.index] + sorted(set(stats.index) - set(TONE_ORDER))
    else:
        order = stats.sort_values("count", ascending=False).index.tolist()
    return [
        {
            "key": k,
            "label": label(k),
            "count": int(stats.at[k, "count"]),
            "share": _r(stats.at[k, "count"] / total),
            "average_rating": _r(stats.at[k, "average_rating"], 2),
            "recommend_rate": _r(stats.at[k, "recommend_rate"]),
            "positive_share": _r(shares.loc[k, 4] + shares.loc[k, 5]),
            "negative_share": _r(shares.loc[k, 1] + shares.loc[k, 2]),
            "rating_shares": [_r(shares.loc[k, s]) for s in range(1, 6)],
        }
        for k in order
    ]


def customer_summary(ds: Dataset, subcategory: str | None = None) -> dict:
    def compute():
        r = _scoped(ds, subcategory)
        attributes = []
        for attribute in REVIEWER_ATTRIBUTES:
            answered = int(r[attribute].notna().sum())
            attributes.append({
                "attribute": attribute,
                "name": ATTRIBUTE_NAMES[attribute],
                "answered": answered,
                "coverage": _r(answered / len(r)) if len(r) else None,
                "groups": _group_stats(r, attribute),
            })
        rec = r["is_recommended"].dropna()
        return {
            "subcategory": subcategory,
            "reviews": len(r),
            "average_rating": _r(r["rating"].mean(), 2) if len(r) else None,
            "recommend_rate": _r(rec.mean()) if len(rec) else None,
            "attributes": attributes,
            # Activity is for the whole export (reviewer IDs are not kept per review).
            "activity": ds.reviewer_activity,
            "total_reviews": len(ds.reviews),
        }

    return ds.memo(("customer_summary", subcategory), compute)


def preferences(ds: Dataset, attribute: str, subcategory: str | None = None) -> dict:
    """Product preferences inferred from reviews, per group of an attribute.

    - ``subcategories``: where a group's reviews concentrate compared with all answering
      reviews (lift = group share / overall share; > 1 means over-represented).
    - ``top_rated``: products with the highest average rating *from that group*, among
      products with at least MIN_GROUP_REVIEWS_FOR_PRODUCT reviews from the group.
    """

    def compute():
        r = _scoped(ds, subcategory)
        known = r[r[attribute].notna()].assign(_k=lambda x: x[attribute].map(_key))
        overall = known["secondary_category"].value_counts(normalize=True)
        groups = []
        for g in _group_stats(r, attribute):
            part = known[known["_k"] == g["key"]]
            sub = part["secondary_category"].value_counts()
            sub = sub[sub >= MIN_SUBCATEGORY_REVIEWS]
            lifts = ((sub / len(part)) / overall.reindex(sub.index)).sort_values(ascending=False)
            prod = (
                part.groupby("product_id", observed=True)
                .agg(reviews=("rating", "size"), average_rating=("rating", "mean"), product_name=("product_name", "first"), brand_name=("brand_name", "first"))
                .reset_index()
            )
            prod = prod[prod["reviews"] >= MIN_GROUP_REVIEWS_FOR_PRODUCT].sort_values(
                ["average_rating", "reviews", "product_id"], ascending=[False, False, True]
            )
            groups.append({
                **{k: g[k] for k in ("key", "label", "count", "average_rating")},
                # Within one subcategory every lift would be 1.0, so none is reported.
                "subcategories": []
                if subcategory
                else [
                    {"name": str(k), "reviews": int(sub[k]), "share": _r(sub[k] / len(part)), "lift": _r(v, 2)}
                    for k, v in lifts.head(4).items()
                ],
                "top_rated": [
                    {
                        "product_id": str(x.product_id),
                        "product_name": str(x.product_name),
                        "brand_name": str(x.brand_name),
                        "reviews": int(x.reviews),
                        "average_rating": _r(x.average_rating, 2),
                    }
                    for x in prod.head(5).itertuples()
                ],
            })
        return {
            "attribute": attribute,
            "name": ATTRIBUTE_NAMES[attribute],
            "min_group_reviews_for_product": MIN_GROUP_REVIEWS_FOR_PRODUCT,
            "min_subcategory_reviews": MIN_SUBCATEGORY_REVIEWS,
            "groups": groups,
        }

    return ds.memo(("preferences", attribute, subcategory), compute)
