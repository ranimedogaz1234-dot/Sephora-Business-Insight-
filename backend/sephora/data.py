"""Load, clean and cache the six Sephora CSV files.

Cleaning follows docs/DATASET.md:
- reviews: drop the exported index column, remove exact duplicate rows (business fields),
  parse dates, keep only the columns the API needs (author_id is dropped after dedupe);
- products: one row per unique product_id, flags as booleans.

The prepared tables are cached as Parquet under SEPHORA_CACHE_DIR (gitignored) and
reused while the source files are unchanged (same names, sizes and modification times).
"""

from __future__ import annotations

import json
import logging
import os
import threading
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

log = logging.getLogger(__name__)

PRODUCT_FILE = "product_info.csv"
REVIEW_FILES = (
    "reviews_0-250.csv",
    "reviews_250-500.csv",
    "reviews_500-750.csv",
    "reviews_750-1250.csv",
    "reviews_1250-end.csv",
)
FILES = (PRODUCT_FILE, *REVIEW_FILES)
CACHE_VERSION = 2  # bump whenever the prepared columns change

PRODUCT_COLUMNS = {
    "product_id": "string",
    "product_name": "string",
    "brand_name": "string",
    "primary_category": "string",
    "secondary_category": "string",
    "tertiary_category": "string",
    "price_usd": "float64",
    "sale_price_usd": "float64",
    "rating": "float64",
    "reviews": "float64",
    "loves_count": "int64",
    "limited_edition": "int64",
    "new": "int64",
    "online_only": "int64",
    "out_of_stock": "int64",
    "sephora_exclusive": "int64",
}
PRODUCT_FLAGS = ("limited_edition", "new", "online_only", "out_of_stock", "sephora_exclusive")
REVIEW_COLUMNS = {
    "author_id": "string",
    "rating": "int64",
    "is_recommended": "float64",
    "helpfulness": "float64",
    "total_feedback_count": "int64",
    "total_neg_feedback_count": "int64",
    "total_pos_feedback_count": "int64",
    "submission_time": "string",
    "review_text": "string",
    "review_title": "string",
    "skin_tone": "string",
    "eye_color": "string",
    "skin_type": "string",
    "hair_color": "string",
    "product_id": "string",
}
# Columns kept after cleaning (author_id and other reviewer attributes are not exposed).
REVIEW_KEEP = [
    "product_id",
    "rating",
    "is_recommended",
    "total_pos_feedback_count",
    "date",
    "review_title",
    "review_text",
    "skin_type",
]


class DatasetUnavailable(RuntimeError):
    """The dataset directory is not configured or a source file is missing."""


@dataclass
class Dataset:
    products: pd.DataFrame
    reviews: pd.DataFrame
    raw_review_rows: int
    duplicates_removed: int
    _memo: dict = field(default_factory=dict, repr=False)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def memo(self, key, compute):
        """Compute an aggregate once per key; aggregates never change while the data is loaded."""
        with self._lock:
            if key in self._memo:
                return self._memo[key]
        value = compute()
        with self._lock:
            self._memo.setdefault(key, value)
            return self._memo[key]


def _fingerprint(directory: Path) -> dict:
    out = {"version": CACHE_VERSION, "files": {}}
    for name in FILES:
        stat = (directory / name).stat()
        out["files"][name] = [stat.st_size, int(stat.st_mtime)]
    return out


def read_products(path: Path) -> pd.DataFrame:
    p = pd.read_csv(path, usecols=list(PRODUCT_COLUMNS), dtype=PRODUCT_COLUMNS)
    p = p.drop_duplicates("product_id").reset_index(drop=True)
    p["secondary_category"] = p["secondary_category"].fillna("Other")
    for flag in PRODUCT_FLAGS:  # 0/1 snapshot flags of the listing
        p[flag] = p[flag].astype(bool)
    return p


def read_reviews(directory: Path) -> tuple[pd.DataFrame, int, int]:
    frames = [
        pd.read_csv(directory / name, usecols=list(REVIEW_COLUMNS), dtype=REVIEW_COLUMNS)
        for name in REVIEW_FILES
    ]
    r = pd.concat(frames, ignore_index=True)
    raw = len(r)
    r = r.drop_duplicates(ignore_index=True)  # exact copies across all business fields
    removed = raw - len(r)
    r["date"] = pd.to_datetime(r["submission_time"], errors="coerce").dt.normalize()
    r = r[r["date"].notna() & r["rating"].between(1, 5)]
    return r[REVIEW_KEEP].reset_index(drop=True), raw, removed


def build(directory: Path) -> Dataset:
    products = read_products(directory / PRODUCT_FILE)
    reviews, raw, removed = read_reviews(directory)
    # Many-to-one join key: keep only reviews whose product exists in the catalogue.
    reviews = reviews[reviews["product_id"].isin(products["product_id"])].reset_index(drop=True)
    return Dataset(products, reviews, raw, removed)


def load(directory: Path, cache_dir: Path | None) -> Dataset:
    missing = [name for name in FILES if not (directory / name).is_file()]
    if missing:
        raise DatasetUnavailable(f"{len(missing)} dataset file(s) missing")

    fingerprint = _fingerprint(directory)
    if cache_dir is not None:
        manifest = cache_dir / "manifest.json"
        try:
            meta = json.loads(manifest.read_text(encoding="utf-8"))
            if meta["fingerprint"] == fingerprint:
                return Dataset(
                    pd.read_parquet(cache_dir / "products.parquet"),
                    pd.read_parquet(cache_dir / "reviews.parquet"),
                    meta["raw_review_rows"],
                    meta["duplicates_removed"],
                )
        except (OSError, ValueError, KeyError):
            pass  # no usable cache: rebuild below

    ds = build(directory)
    if cache_dir is not None:
        try:
            cache_dir.mkdir(parents=True, exist_ok=True)
            ds.products.to_parquet(cache_dir / "products.parquet", index=False)
            ds.reviews.to_parquet(cache_dir / "reviews.parquet", index=False)
            (cache_dir / "manifest.json").write_text(
                json.dumps(
                    {
                        "fingerprint": fingerprint,
                        "raw_review_rows": ds.raw_review_rows,
                        "duplicates_removed": ds.duplicates_removed,
                    }
                ),
                encoding="utf-8",
            )
        except OSError:
            log.warning("Could not write the dataset cache; continuing without it")
    return ds


# --------------------------------------------------------------------------- process-wide store
_ROOT = Path(__file__).resolve().parents[1]
_store: Dataset | None = None
_store_lock = threading.Lock()


def dataset_dir() -> Path | None:
    configured = os.getenv("SEPHORA_DATASET_DIR", "").strip()
    if not configured:
        return None
    directory = Path(configured).expanduser()
    return directory if directory.is_absolute() else _ROOT / directory


def cache_dir() -> Path | None:
    if os.getenv("SEPHORA_CACHE", "1").strip() == "0":
        return None
    configured = os.getenv("SEPHORA_CACHE_DIR", "").strip()
    return Path(configured).expanduser() if configured else _ROOT / ".cache"


def get_dataset() -> Dataset:
    """Load the dataset once per process (thread-safe)."""
    global _store
    if _store is None:
        with _store_lock:
            if _store is None:
                directory = dataset_dir()
                if directory is None:
                    raise DatasetUnavailable("SEPHORA_DATASET_DIR is not set")
                _store = load(directory, cache_dir())
    return _store


def is_loaded() -> bool:
    return _store is not None


def reset() -> None:
    """Forget the loaded dataset (used by tests)."""
    global _store
    with _store_lock:
        _store = None
