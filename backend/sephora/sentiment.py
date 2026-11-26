"""NLP sentiment of the review texts with VADER, adapted to skincare reviews.

Model
    VADER (Hutto & Gilbert, 2014; package vaderSentiment 3.3.2, MIT licence) is a lexicon-
    and rule-based sentiment model: it scores words from a human-rated lexicon and applies
    rules for negation ("not good"), intensifiers ("very"), contrast ("but"), capitals and
    punctuation. It runs locally, needs no paid API and no training data.

Adaptation (documented, small and reviewable)
    - DOMAIN_LEXICON adds skincare words VADER does not know or under-weights
      ("breakout", "irritation", "greasy", "pilling", "returned"...).
    - PHRASES rewrite a few multi-word expressions into one scored token before scoring
      ("broke me out" -> "breakout", "wanted to love" -> "unfortunately").
    - Each sentence of the text is scored separately and averaged, then averaged with the
      title's score (weight 1). Whole-text scores saturate on long, mostly polite reviews.
    - Label: compound >= 0.05 positive, <= -0.05 negative, otherwise neutral (VADER's
      standard thresholds).
    The adaptation was chosen on a random development sample of 8,000 reviews (seed 11).

Validation
    Star ratings are never used to classify. They are used only afterwards, as independent
    weak labels (1–2 stars negative, 3 neutral, 4–5 positive), on a separate random test
    sample that excludes the development sample. The build stores the confusion matrix,
    accuracy, macro-F1 and Cohen's kappa for base VADER and for the adapted model.

Limitations
    Sarcasm, comparisons with other products and mixed reviews are hard for any lexicon
    model; 3-star reviews are usually mixed, so "neutral" agreement is low; the review
    text is English marketing-heavy language, so many reviews read as positive.
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import time
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

from sephora.analytics import _date, _r, _reviews_with_products
from sephora.data import Dataset

log = logging.getLogger(__name__)

MODEL = "VADER 3.3.2 with a skincare lexicon, phrase rules and sentence averaging"
MODEL_VERSION = "vader-3.3.2+sephora-1"
THRESHOLD = 0.05
TITLE_WEIGHT = 1.0
LABELS = ("negative", "neutral", "positive")  # stored as 0, 1, 2
DEV_SEED, DEV_SIZE = 11, 8_000
TEST_SEED, TEST_SIZE = 29, 20_000
WORD_SAMPLE_SEED, WORD_SAMPLE_SIZE = 7, 150_000
MIN_PRODUCT_REVIEWS = 100

DOMAIN_LEXICON = {
    "breakout": -2.2, "breakouts": -2.2, "broke": -1.4, "clogged": -1.6, "irritation": -2.0,
    "irritated": -2.0, "irritating": -1.8, "burning": -1.8, "burned": -1.8, "stinging": -1.6,
    "stung": -1.5, "rash": -2.0, "itchy": -1.8, "redness": -1.0, "allergic": -2.0,
    "reaction": -1.2, "greasy": -1.2, "sticky": -1.0, "pilling": -1.2, "pills": -0.8,
    "drying": -1.0, "flaky": -1.0, "returned": -1.6, "returning": -1.6, "refund": -1.4,
    "overpriced": -1.8, "unfortunately": -1.5, "disappointment": -2.2, "meh": -1.2,
    "unsure": -0.8, "eh": -0.8,
}
PHRASES = [
    (r"\bbr(?:oke|eak|eaks|eaking) (?:me|my skin|my face) out\b", "breakout"),
    (r"\b(?:wanted|hoped|tried|was hoping) (?:so badly |really )?to (?:love|like)\b", "unfortunately"),
    (r"\b(?:did ?n[o']?t|does ?n[o']?t|didnt|doesnt) (?:do|work|see|notice) (?:anything|much|a thing)\b", "useless"),
    (r"\bno (?:difference|results?|change)\b", "useless"),
    (r"\bwaste of (?:money|time)\b", "waste"),
    (r"\bnot worth\b", "overpriced"),
    (r"\b(?:would not|won'?t) (?:recommend|repurchase|buy)\b", "disappointment"),
]
_PHRASES = [(re.compile(p, re.I), rep) for p, rep in PHRASES]
_SENTENCES = re.compile(r"(?<=[.!?])\s+|\n+")

# Topics: documented keyword groups (case-insensitive regular expressions on title + text).
ASPECTS = {
    "Hydration": r"\b(?:hydrat\w*|moistur\w*|dry(?:ness)?|dehydrat\w*|plump\w*)\b",
    "Texture": r"\b(?:texture|greasy|oily feel|sticky|lightweight|light weight|thick|heavy|absorbs?|pilling)\b",
    "Scent": r"\b(?:smell\w*|scent\w*|fragrance\w*|odou?r)\b",
    "Breakouts & irritation": r"\b(?:break ?outs?|broke (?:me|my skin) out|acne|pimples?|irritat\w*|burn\w*|sting\w*|rash|itch\w*|redness|allerg\w*)\b",
    "Results": r"\b(?:results?|difference|works?|worked|glow\w*|brighter|smoother|clear(?:er)? skin)\b",
    "Price & value": r"\b(?:price\w*|expensive|cheap\w*|worth|value|pricey|overpriced|money)\b",
    "Packaging": r"\b(?:packag\w*|bottle|pump|jar|tube|container|dispenser|applicator)\b",
    "Sensitive skin": r"\bsensitive\b",
}

STOPWORDS = set(
    """a about above after again all also am an and any are as at be been before being below between both but by can
    could did do does doing down during each few for from further had has have having he her here hers him his how i if
    in into is it its itself just let me more most my myself no nor not now of off on once only or other our ours out
    over own same she should so some such than that the their theirs them then there these they this those through to
    too under until up very was we were what when where which while who whom why will with would you your yours yourself
    im ive it's i'm i've don't didn't doesn't isn't wasn't can't won't dont didnt doesnt isnt cant wont really one get got
    use used using product products skin face like would also even much well still make makes made bit lot little way
    since though however feel feels felt day days night time week weeks month months year years""".split()
)
_WORD = re.compile(r"[a-z][a-z']+")

_analyzer = None
_base_analyzer = None


def _get_analyzer():
    global _analyzer
    if _analyzer is None:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

        _analyzer = SentimentIntensityAnalyzer()
        _analyzer.lexicon.update(DOMAIN_LEXICON)
    return _analyzer


def _normalise(text: str) -> str:
    for pattern, replacement in _PHRASES:
        text = pattern.sub(replacement, text)
    return text


def score(title: str | None, text: str | None) -> float:
    """Adapted compound score in [-1, 1] for one review."""
    a = _get_analyzer()
    sentences = [s for s in _SENTENCES.split(_normalise(text or "")) if s.strip()]
    body = float(np.mean([a.polarity_scores(s)["compound"] for s in sentences])) if sentences else None
    head = a.polarity_scores(_normalise(title))["compound"] if title and title.strip() else None
    if body is None and head is None:
        return 0.0
    if body is None:
        return head
    if head is None:
        return body
    return (TITLE_WEIGHT * head + body) / (1 + TITLE_WEIGHT)


def base_score(title: str | None, text: str | None) -> float:
    """Unadapted VADER on the whole title + text (for validation only)."""
    global _base_analyzer
    if _base_analyzer is None:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

        _base_analyzer = SentimentIntensityAnalyzer()
    return _base_analyzer.polarity_scores(f"{title or ''}. {text or ''}")["compound"]


def label_of(compound: np.ndarray) -> np.ndarray:
    return np.where(compound >= THRESHOLD, 2, np.where(compound <= -THRESHOLD, 0, 1)).astype("int8")


def _score_chunk(pairs: list[tuple[str | None, str | None]]) -> list[float]:
    return [score(t, x) for t, x in pairs]


def _pairs(r: pd.DataFrame) -> list[tuple[str | None, str | None]]:
    def clean(v):
        return None if v is None or (isinstance(v, float) and math.isnan(v)) or v is pd.NA else str(v)

    return [(clean(t), clean(x)) for t, x in zip(r["review_title"].tolist(), r["review_text"].tolist())]


# ----------------------------------------------------------------------------- validation
def _metrics(truth: np.ndarray, pred: np.ndarray) -> dict:
    k = len(LABELS)
    cm = np.zeros((k, k), dtype=int)
    for t, p in zip(truth, pred):
        cm[t, p] += 1
    n = cm.sum()
    per = []
    for i in range(k):
        tp = cm[i, i]
        precision = tp / cm[:, i].sum() if cm[:, i].sum() else 0.0
        recall = tp / cm[i, :].sum() if cm[i, :].sum() else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per.append({"label": LABELS[i], "precision": _r(precision), "recall": _r(recall), "f1": _r(f1), "support": int(cm[i, :].sum())})
    observed = np.trace(cm) / n
    expected = float((cm.sum(0) * cm.sum(1)).sum()) / n**2
    return {
        "accuracy": _r(observed),
        "macro_f1": _r(np.mean([p["f1"] for p in per])),
        "cohen_kappa": _r((observed - expected) / (1 - expected)) if expected < 1 else None,
        "per_class": per,
        "confusion": cm.tolist(),
    }


def star_group(rating: pd.Series) -> np.ndarray:
    return np.where(rating >= 4, 2, np.where(rating == 3, 1, 0)).astype("int8")


def validate(reviews: pd.DataFrame, compound: np.ndarray) -> dict:
    """Agreement with star groups on a test sample disjoint from the development sample."""
    dev = reviews.sample(min(DEV_SIZE, len(reviews)), random_state=DEV_SEED).index
    pool = reviews.drop(index=dev)
    test = pool.sample(min(TEST_SIZE, len(pool)), random_state=TEST_SEED)
    truth = star_group(test["rating"])
    adapted = label_of(compound[test.index.to_numpy()])
    base = label_of(np.array([base_score(t, x) for t, x in _pairs(test)]))
    return {
        "sample_size": len(test),
        "reference": "Star groups (1–2 negative, 3 neutral, 4–5 positive), used only for evaluation",
        # Too few reviews to hold out a test sample (e.g. a tiny dataset): no metrics rather than misleading ones.
        "base_vader": _metrics(truth, base) if len(test) else None,
        "adapted": _metrics(truth, adapted) if len(test) else None,
        "full_data_agreement": _r(float((label_of(compound) == star_group(reviews["rating"])).mean())),
    }


# ----------------------------------------------------------------------------- topics & words
def aspects(r: pd.DataFrame, labels: np.ndarray) -> list[dict]:
    text = (r["review_title"].fillna("") + " " + r["review_text"].fillna("")).str.lower()
    out = []
    for name, pattern in ASPECTS.items():
        hit = text.str.contains(pattern, regex=True, na=False).to_numpy()
        n = int(hit.sum())
        lab = labels[hit]
        out.append({
            "aspect": name,
            "pattern": pattern,
            "mentions": n,
            "share": _r(n / len(r)) if len(r) else None,
            "positive": _r(float((lab == 2).mean())) if n else None,
            "neutral": _r(float((lab == 1).mean())) if n else None,
            "negative": _r(float((lab == 0).mean())) if n else None,
            "average_rating": _r(r.loc[hit, "rating"].mean(), 2) if n else None,
        })
    return sorted(out, key=lambda a: -a["mentions"])


def _counts(texts: list[str]) -> tuple[Counter, Counter]:
    uni, bi = Counter(), Counter()
    for t in texts:
        # Curly apostrophes become straight ones so "didn’t" is one (stop)word, not "didn" + "t".
        words = [w for w in _WORD.findall(t.lower().replace("’", "'")) if w not in STOPWORDS and len(w) > 2]
        uni.update(set(words))  # document frequency: each word once per review
        bi.update({f"{a} {b}" for a, b in zip(words, words[1:])})
    return uni, bi


def frequent_words(r: pd.DataFrame, labels: np.ndarray) -> dict:
    """Most frequent and most distinctive words and two-word phrases per sentiment class,
    on a fixed random sample. Distinctiveness = smoothed log ratio of the share of reviews
    in the class that use the term against the share in the other classes."""
    idx = r.sample(min(WORD_SAMPLE_SIZE, len(r)), random_state=WORD_SAMPLE_SEED).index.to_numpy()
    sample = r.loc[idx]
    lab = labels[idx]
    text = (sample["review_title"].fillna("") + " " + sample["review_text"].fillna("")).tolist()
    result = {"sample_size": len(sample), "classes": {}}
    for cls in (2, 0):
        inside = [t for t, l in zip(text, lab) if l == cls]
        outside = [t for t, l in zip(text, lab) if l != cls]
        if not inside or not outside:
            continue
        (u_in, b_in), (u_out, b_out) = _counts(inside), _counts(outside)

        def ranked(cin: Counter, cout: Counter, min_docs: int):
            rows = []
            for term, n in cin.items():
                if n < min_docs:
                    continue
                share_in = n / len(inside)
                share_out = (cout.get(term, 0) + 1) / (len(outside) + 1)
                rows.append((term, n, share_in, math.log(share_in / share_out)))
            frequent = sorted(rows, key=lambda x: -x[1])[:20]
            distinctive = sorted(rows, key=lambda x: -x[3])[:20]
            fmt = lambda x: {"term": x[0], "reviews": x[1], "share": _r(x[2]), "log_ratio": _r(x[3], 2)}  # noqa: E731
            return [fmt(x) for x in frequent], [fmt(x) for x in distinctive]

        words_f, words_d = ranked(u_in, u_out, max(30, len(inside) // 500))
        phrases_f, phrases_d = ranked(b_in, b_out, max(20, len(inside) // 1000))
        result["classes"][LABELS[cls]] = {
            "reviews": len(inside),
            "frequent_words": words_f,
            "distinctive_words": words_d,
            "frequent_phrases": phrases_f,
            "distinctive_phrases": phrases_d,
        }
    return result


# ----------------------------------------------------------------------------- build & load
def _files(cache_dir: Path) -> tuple[Path, Path]:
    return cache_dir / "sentiment.parquet", cache_dir / "sentiment.json"


def _source_key(cache_dir: Path) -> dict | None:
    try:
        manifest = json.loads((cache_dir / "manifest.json").read_text(encoding="utf-8"))
        return manifest["fingerprint"]
    except (OSError, ValueError, KeyError):
        return None


def build(ds: Dataset, cache_dir: Path, workers: int | None = None) -> dict:
    """Score every review (in parallel batches), validate, and cache the results."""
    started = time.time()
    r = _reviews_with_products(ds)
    pairs = _pairs(r)
    workers = workers or max(1, min(16, (os.cpu_count() or 2) - 1))
    size = 20_000
    chunks = [pairs[i : i + size] for i in range(0, len(pairs), size)]
    if workers > 1 and len(chunks) > 1:
        with ProcessPoolExecutor(max_workers=workers) as pool:
            scores = [s for part in pool.map(_score_chunk, chunks) for s in part]
    else:
        scores = [s for part in map(_score_chunk, chunks) for s in part]
    compound = np.asarray(scores, dtype="float32")
    labels = label_of(compound)
    scored = time.time() - started

    meta = {
        "model": MODEL,
        "model_version": MODEL_VERSION,
        "threshold": THRESHOLD,
        "title_weight": TITLE_WEIGHT,
        "domain_lexicon": DOMAIN_LEXICON,
        "phrases": [{"pattern": p, "replacement": rep} for p, rep in PHRASES],
        "reviews": len(r),
        "source": _source_key(cache_dir),
        "validation": validate(r, compound),
        "aspects": aspects(r, labels),
        "words": frequent_words(r, labels),
        "seconds_scoring": round(scored, 1),
        "seconds_total": round(time.time() - started, 1),
        "workers": workers,
    }
    cache_dir.mkdir(parents=True, exist_ok=True)
    data_file, meta_file = _files(cache_dir)
    pd.DataFrame({"compound": compound, "label": labels}).to_parquet(data_file, index=False)
    meta_file.write_text(json.dumps(meta), encoding="utf-8")
    return meta


class SentimentUnavailable(RuntimeError):
    """Sentiment has not been computed for the current dataset."""


def load(ds: Dataset, cache_dir: Path | None) -> tuple[pd.DataFrame, dict]:
    """Cached scores aligned with the review rows, or SentimentUnavailable."""

    def compute():
        if cache_dir is None:
            raise SentimentUnavailable("no cache directory")
        data_file, meta_file = _files(cache_dir)
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise SentimentUnavailable("not computed") from exc
        if meta.get("model_version") != MODEL_VERSION or meta.get("reviews") != len(ds.reviews) or meta.get("source") != _source_key(cache_dir):
            raise SentimentUnavailable("computed for another dataset or model version")
        scores = pd.read_parquet(data_file)
        if len(scores) != len(ds.reviews):
            raise SentimentUnavailable("row count mismatch")
        r = _reviews_with_products(ds).copy()
        r["compound"] = scores["compound"].to_numpy()
        r["sentiment"] = scores["label"].to_numpy()
        return r, meta

    return ds.memo(("sentiment", str(cache_dir)), compute)


# ----------------------------------------------------------------------------- aggregates
def _shares(labels: pd.Series) -> dict:
    n = len(labels)
    return {LABELS[i]: _r(float((labels == i).sum() / n)) if n else None for i in range(3)}


def _scope(r: pd.DataFrame, subcategory: str | None, product_id: str | None, brand: str | None) -> pd.DataFrame:
    if subcategory:
        r = r[r["secondary_category"] == subcategory]
    if product_id:
        r = r[r["product_id"] == product_id]
    if brand:
        r = r[r["brand_name"] == brand]
    return r


def summary(ds: Dataset, cache_dir: Path | None, subcategory: str | None = None, brand: str | None = None, product_id: str | None = None) -> dict:
    def compute():
        r_all, meta = load(ds, cache_dir)
        r = _scope(r_all, subcategory, product_id, brand)
        granularity = "year"
        period = r["date"].dt.to_period("Y").dt.to_timestamp()
        trend = []
        for ts, g in r.groupby(period):
            shares = _shares(g["sentiment"])
            trend.append({"period": ts.strftime("%Y"), "reviews": len(g), **shares, "average_compound": _r(g["compound"].mean(), 3)})
        by_stars = []
        for stars in range(1, 6):
            g = r[r["rating"] == stars]
            by_stars.append({"rating": stars, "reviews": len(g), **_shares(g["sentiment"])})
        by_sub = (
            r.groupby("secondary_category", observed=True)
            .agg(reviews=("sentiment", "size"), positive=("sentiment", lambda s: (s == 2).mean()), negative=("sentiment", lambda s: (s == 0).mean()), compound=("compound", "mean"))
            .reset_index()
            .sort_values("reviews", ascending=False)
        )
        return {
            "model": meta["model"],
            "model_version": meta["model_version"],
            "scope": {"subcategory": subcategory, "brand": brand, "product_id": product_id},
            "reviews": len(r),
            "shares": _shares(r["sentiment"]),
            "counts": {LABELS[i]: int((r["sentiment"] == i).sum()) for i in range(3)},
            "average_compound": _r(r["compound"].mean(), 3) if len(r) else None,
            "agreement_with_stars": _r(float((r["sentiment"].to_numpy() == star_group(r["rating"])).mean())) if len(r) else None,
            "granularity": granularity,
            "trend": trend,
            "by_stars": by_stars,
            "by_subcategory": [
                {"name": str(x.secondary_category), "reviews": int(x.reviews), "positive": _r(x.positive), "negative": _r(x.negative), "average_compound": _r(x.compound, 3)}
                for x in by_sub.itertuples()
            ],
        }

    return ds.memo(("sentiment_summary", subcategory, brand, product_id), compute)


def rankings(ds: Dataset, cache_dir: Path | None, level: str, subcategory: str | None = None, min_reviews: int = MIN_PRODUCT_REVIEWS) -> dict:
    """Products or brands with the most positive and most negative text sentiment."""

    def compute():
        r, _ = load(ds, cache_dir)
        r = _scope(r, subcategory, None, None)
        key = "product_id" if level == "product" else "brand_name"
        names = {"product_name": ("product_name", "first"), "brand_name": ("brand_name", "first")} if level == "product" else {}
        g = r.groupby(key, observed=True).agg(
            reviews=("sentiment", "size"),
            positive=("sentiment", lambda s: (s == 2).mean()),
            negative=("sentiment", lambda s: (s == 0).mean()),
            compound=("compound", "mean"),
            rating=("rating", "mean"),
            **names,
        ).reset_index()
        g = g[g["reviews"] >= min_reviews]

        def row(x):
            out = {
                "reviews": int(x.reviews),
                "positive": _r(x.positive),
                "negative": _r(x.negative),
                "average_compound": _r(x.compound, 3),
                "average_rating": _r(x.rating, 2),
                "brand_name": str(x.brand_name),
            }
            if level == "product":
                out.update({"product_id": str(x.product_id), "product_name": str(x.product_name)})
            return out

        return {
            "level": level,
            "min_reviews": min_reviews,
            "eligible": len(g),
            "most_positive": [row(x) for x in g.sort_values(["positive", "reviews"], ascending=[False, False]).head(10).itertuples()],
            "most_negative": [row(x) for x in g.sort_values(["negative", "reviews"], ascending=[False, False]).head(10).itertuples()],
        }

    return ds.memo(("sentiment_rankings", level, subcategory, min_reviews), compute)


def examples(ds: Dataset, cache_dir: Path | None, subcategory: str | None = None) -> dict:
    """Representative reviews per class: clear scores, readable length, most helpful first.
    Also lists reviews where the text and the stars disagree, to make errors visible."""

    def compute():
        r, _ = load(ds, cache_dir)
        r = _scope(r, subcategory, None, None)
        length = r["review_text"].str.len().fillna(0)
        readable = r[(length >= 120) & (length <= 600)]

        def cards(frame):
            return [
                {
                    "product_id": str(x.product_id),
                    "product_name": str(x.product_name),
                    "brand_name": str(x.brand_name),
                    "rating": int(x.rating),
                    "compound": _r(x.compound, 3),
                    "sentiment": LABELS[int(x.sentiment)],
                    "date": _date(x.date),
                    "title": None if pd.isna(x.review_title) else str(x.review_title),
                    "text": None if pd.isna(x.review_text) else str(x.review_text),
                    "helpful_votes": int(x.total_pos_feedback_count),
                    "recommended": None if pd.isna(x.is_recommended) else bool(x.is_recommended),
                    "skin_type": None if pd.isna(x.skin_type) else str(x.skin_type),
                }
                for x in frame.itertuples()
            ]

        order = ["total_pos_feedback_count", "date"]

        def top(frame):
            # The same text is sometimes posted on several products (e.g. sizes): show it once.
            return frame.sort_values(order, ascending=[False, False]).drop_duplicates("review_text").head(3)

        out = {}
        for i, name in enumerate(LABELS):
            group = readable[readable["sentiment"] == i]
            clear = group[group["compound"].abs() >= 0.5] if name != "neutral" else group
            out[name] = cards(top(clear))
        stars = star_group(readable["rating"])
        out["disagreements"] = cards(top(readable[(readable["sentiment"].to_numpy() == 2) & (stars == 0)]))
        return out

    return ds.memo(("sentiment_examples", subcategory), compute)


def methodology(ds: Dataset, cache_dir: Path | None) -> dict:
    _, meta = load(ds, cache_dir)
    keys = ("model", "model_version", "threshold", "title_weight", "domain_lexicon", "phrases", "reviews", "validation", "seconds_scoring", "seconds_total", "workers")
    return {k: meta[k] for k in keys}


def topics(ds: Dataset, cache_dir: Path | None) -> dict:
    _, meta = load(ds, cache_dir)
    return {"aspects": meta["aspects"], "words": meta["words"]}


if __name__ == "__main__":  # pragma: no cover - CLI
    import argparse

    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    from sephora.data import cache_dir as configured_cache, get_dataset

    parser = argparse.ArgumentParser(description="Score every review with the adapted VADER model and cache the results.")
    parser.add_argument("--workers", type=int, default=None)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    directory = configured_cache()
    if directory is None:
        raise SystemExit("Sentiment needs the Parquet cache (SEPHORA_CACHE must not be 0).")
    result = build(get_dataset(), directory, args.workers)
    v = result["validation"]
    print(json.dumps({
        "reviews": result["reviews"],
        "seconds_scoring": result["seconds_scoring"],
        "seconds_total": result["seconds_total"],
        "workers": result["workers"],
        "test_sample": v["sample_size"],
        "base_vader": {k: v["base_vader"][k] for k in ("accuracy", "macro_f1", "cohen_kappa")},
        "adapted": {k: v["adapted"][k] for k in ("accuracy", "macro_f1", "cohen_kappa")},
        "full_data_agreement": v["full_data_agreement"],
    }, indent=2))
