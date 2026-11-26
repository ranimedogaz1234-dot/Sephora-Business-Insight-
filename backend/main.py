"""Sephora Business Insight API: read-only analytics over the local Sephora CSV files."""

import logging
import os
from pathlib import Path
from typing import Annotated, Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi import Path as PathParam
from fastapi.responses import JSONResponse

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

from sephora import analytics, dashboard, products as catalogue  # noqa: E402  (after .env is loaded)
from sephora.data import FILES, DatasetUnavailable, dataset_dir, get_dataset, is_loaded  # noqa: E402

log = logging.getLogger("sephora")
PRODUCTION = os.getenv("SEPHORA_ENV", "").strip().lower() == "production"

app = FastAPI(
    title="Sephora Business Insight",
    docs_url=None if PRODUCTION else "/docs",
    redoc_url=None,
    openapi_url=None if PRODUCTION else "/openapi.json",
)


@app.exception_handler(DatasetUnavailable)
def dataset_unavailable(_: Request, exc: DatasetUnavailable) -> JSONResponse:
    # Never reveal local paths; the reason is a short fixed message.
    log.warning("Dataset unavailable: %s", exc)
    return JSONResponse(status_code=503, content={"detail": "Dataset is not available"})


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/health")
def health() -> dict[str, str | bool]:
    directory = dataset_dir()
    dataset_ready = directory is not None and all((directory / f).is_file() for f in FILES)
    return {"status": "ok", "dataset_ready": dataset_ready, "dataset_loaded": is_loaded()}


# ----------------------------------------------------------------------------- shared params
SearchText = Annotated[str | None, Query(min_length=2, max_length=80)]
Name = Annotated[str | None, Query(min_length=1, max_length=80)]
PageNo = Annotated[int, Query(ge=1, le=10_000)]


def _check(value: str | None, allowed: list[str], field: str) -> None:
    if value is not None and value not in allowed:
        raise HTTPException(status_code=422, detail=f"Unknown {field}")


def _category(ds, category: str | None) -> str | None:
    """Validate a primary category against the catalogue."""
    _check(category, [c["name"] for c in analytics.filter_options(ds)["categories"]], "category")
    return category


# ----------------------------------------------------------------------------- dashboard
@app.get("/api/overview")
def overview(category: Name = None):
    """Headline KPIs, optionally for one primary category."""
    ds = get_dataset()
    return analytics.overview(ds, _category(ds, category))


@app.get("/api/categories")
def categories():
    """Products per primary category (catalogue, all products)."""
    return analytics.category_mix(get_dataset())


@app.get("/api/top-products")
def top_products(limit: Annotated[int, Query(ge=1, le=20)] = 10, category: Name = None):
    """Most reviewed products by number of review rows."""
    ds = get_dataset()
    return analytics.top_products(ds, limit, _category(ds, category))


@app.get("/api/top-brands")
def top_brands(limit: Annotated[int, Query(ge=1, le=20)] = 10, category: Name = None):
    """Brands ranked by number of review rows."""
    ds = get_dataset()
    return analytics.top_brands(ds, limit, _category(ds, category))


@app.get("/api/ratings")
def ratings(category: Name = None):
    """Number of reviews per star rating (1–5)."""
    ds = get_dataset()
    return analytics.ratings(ds, _category(ds, category))


@app.get("/api/trend")
def trend(granularity: Literal["month", "year"] = "month", category: Name = None):
    """Review volume and average rating over time."""
    ds = get_dataset()
    return analytics.trend(ds, granularity, _category(ds, category))


@app.get("/api/category-performance")
def category_performance():
    """Catalogue size, prices, catalogue rating, loves and review rows per primary category."""
    return dashboard.category_performance(get_dataset())


@app.get("/api/recommendations")
def recommendations(category: Name = None):
    """Recommendation rate (among reviewers who answered) by star rating and by year."""
    ds = get_dataset()
    return dashboard.recommendation_patterns(ds, _category(ds, category))


@app.get("/api/observations")
def observations(category: Name = None):
    """Automatically computed observations, each with the figures it is based on."""
    ds = get_dataset()
    return dashboard.observations(ds, _category(ds, category))


@app.get("/api/filters")
def filters():
    """Allowed values for the Products and Reviews filters."""
    return analytics.filter_options(get_dataset())


# ----------------------------------------------------------------------------- products
Price = Annotated[float | None, Query(ge=0, le=100_000)]


def product_filters(
    q: SearchText = None,
    category: Name = None,
    subcategory: Name = None,
    brand: Name = None,
    min_price: Price = None,
    max_price: Price = None,
    min_rating: Annotated[float | None, Query(ge=1, le=5)] = None,
    min_reviews: Annotated[int | None, Query(ge=0, le=1_000_000)] = None,
    flag: Literal[tuple(catalogue.FLAGS)] | None = None,  # type: ignore[valid-type]
) -> catalogue.ProductFilters:
    """Shared, validated product filters (used by the list, the summary and exports)."""
    ds = get_dataset()
    _category(ds, category)
    options = catalogue.product_options(ds)
    _check(brand, [b["name"] for b in options["brands"]], "brand")
    _check(subcategory, sorted({s["name"] for s in options["subcategories"]}), "subcategory")
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(status_code=422, detail="min_price is greater than max_price")
    return catalogue.ProductFilters(
        q=q.strip() if q else None,
        category=category,
        subcategory=subcategory,
        brand=brand,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
        min_reviews=min_reviews,
        flag=flag,
    )


ProductFilterParams = Annotated[catalogue.ProductFilters, Depends(product_filters)]


@app.get("/api/products")
def products(
    filters: ProductFilterParams,
    sort: Literal[tuple(catalogue.SORTS)] = "popular",  # type: ignore[valid-type]
    page: PageNo = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 20,
):
    """Catalogue search with brand, category, price, rating, review-count and listing filters.

    ``min_reviews`` uses Sephora's catalogue review count (reviews in this dataset cover
    Skincare only). Each item carries ``rating_vs_category`` and ``loves_percentile``.
    """
    return catalogue.list_products(get_dataset(), filters, sort, page, page_size)


@app.get("/api/products/summary")
def products_summary(filters: ProductFilterParams):
    """KPIs, price and rating distributions, top brands and highlights for the filtered products."""
    return catalogue.product_summary(get_dataset(), filters)


@app.get("/api/products/options")
def products_options():
    """Brands, subcategories, listing flags and the price range for the Products filters."""
    return catalogue.product_options(get_dataset())


# Registered after /summary and /options so those paths are not read as product IDs.
@app.get("/api/products/{product_id}")
def product_details(product_id: Annotated[str, PathParam(pattern=catalogue.PRODUCT_ID)]):
    """One product: catalogue attributes, indicators, review statistics when the review files
    contain it (Skincare only), and related products."""
    details = catalogue.product_details(get_dataset(), product_id)
    if details is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return details


# ----------------------------------------------------------------------------- reviews
Year = Annotated[int | None, Query(ge=1990, le=2100)]
Stars = Annotated[int | None, Query(ge=1, le=5)]


def _check_review_filters(ds, subcategory: str | None) -> None:
    options = analytics.filter_options(ds)
    _check(subcategory, [s["name"] for s in options["review_subcategories"]], "subcategory")


@app.get("/api/reviews/summary")
def review_summary(subcategory: Name = None, year: Year = None, rating: Stars = None):
    """Review KPIs, rating distribution, trend and top products for the selected filters."""
    ds = get_dataset()
    _check_review_filters(ds, subcategory)
    return analytics.review_summary(ds, subcategory, year, rating)


@app.get("/api/reviews")
def reviews(
    subcategory: Name = None,
    year: Year = None,
    rating: Stars = None,
    sort: Literal["recent", "helpful", "highest", "lowest"] = "recent",
    page: PageNo = 1,
    page_size: Annotated[int, Query(ge=1, le=20)] = 6,
):
    """Paginated review texts. Reviewer identifiers are never returned."""
    ds = get_dataset()
    _check_review_filters(ds, subcategory)
    return analytics.list_reviews(ds, subcategory, year, rating, sort, page, page_size)
