"""Loader and cache tests on the synthetic dataset."""

import os

import pytest

from sephora import data


def test_cleaning(dataset_dir):
    ds = data.build(dataset_dir)
    assert len(ds.products) == 5
    assert (ds.raw_review_rows, ds.duplicates_removed, len(ds.reviews)) == (9, 1, 7)
    assert "author_id" not in ds.reviews.columns  # reviewer IDs are not kept
    # ...only their count: a1..a7 (a9 reviewed a product missing from the catalogue).
    assert ds.reviewer_activity["distinct_reviewer_ids"] == 7
    assert ds.reviewer_activity["bands"][0] == {"label": "1 review", "reviewers": 7, "reviews": 7}
    assert ds.products.loc[ds.products["product_id"] == "P5", "secondary_category"].item() == "Other"


def test_missing_files_raise(tmp_path):
    with pytest.raises(data.DatasetUnavailable):
        data.load(tmp_path, None)


def test_cache_is_reused_and_invalidated(dataset_dir, tmp_path):
    cache = tmp_path / "cache"
    first = data.load(dataset_dir, cache)
    assert (cache / "reviews.parquet").is_file()
    second = data.load(dataset_dir, cache)
    assert second.reviews.equals(first.reviews)
    assert second.duplicates_removed == 1
    assert second.reviewer_activity == first.reviewer_activity

    # A changed source file (new mtime) invalidates the cache.
    product_file = dataset_dir / "product_info.csv"
    stat = product_file.stat()
    os.utime(product_file, (stat.st_atime, stat.st_mtime + 10))
    manifest_before = (cache / "manifest.json").read_text()
    data.load(dataset_dir, cache)
    assert (cache / "manifest.json").read_text() != manifest_before
