/** Validated URL state for the Products and Reviews pages (filters live in the URL). */
import type { FilterOptions, ProductOptions } from "@/lib/api";

export type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function page(v: string | undefined): number {
  return v && /^\d{1,4}$/.test(v) && Number(v) >= 1 ? Number(v) : 1;
}

export const PRODUCT_SORTS = {
  popular: "Most loved",
  rating: "Highest rated",
  reviews: "Most reviewed",
  above_category: "Most above category rating",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  name: "Name A–Z",
} as const;
export type ProductSort = keyof typeof PRODUCT_SORTS;

export const MIN_RATINGS = [3, 3.5, 4, 4.5] as const;
export const MIN_REVIEWS = [10, 50, 100, 500, 1000] as const;

export interface ProductParams {
  q?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  min_reviews?: number;
  flag?: string;
  sort: ProductSort;
  page: number;
}

function price(v: string | undefined): number | undefined {
  if (!v || !/^\d{1,5}(\.\d{1,2})?$/.test(v.trim())) return undefined;
  return Number(v);
}

export function parseProductParams(
  sp: SearchParams,
  options: FilterOptions,
  products?: ProductOptions | null,
): ProductParams {
  const q = one(sp.q)?.trim().slice(0, 80);
  const category = one(sp.category);
  const sort = one(sp.sort);
  const subcategory = one(sp.subcategory);
  const brand = one(sp.brand);
  const flag = one(sp.flag);
  const minRating = Number(one(sp.min_rating));
  const minReviews = Number(one(sp.min_reviews));
  let minPrice = price(one(sp.min_price));
  let maxPrice = price(one(sp.max_price));
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
  return {
    q: q && q.length >= 2 ? q : undefined,
    category: category && options.categories.some((c) => c.name === category) ? category : undefined,
    subcategory: subcategory && products?.subcategories.some((s) => s.name === subcategory) ? subcategory : undefined,
    brand: brand && products?.brands.some((b) => b.name === brand) ? brand : undefined,
    min_price: minPrice,
    max_price: maxPrice,
    min_rating: (MIN_RATINGS as readonly number[]).includes(minRating) ? minRating : undefined,
    min_reviews: (MIN_REVIEWS as readonly number[]).includes(minReviews) ? minReviews : undefined,
    flag: flag && products?.flags.some((f) => f.key === flag) ? flag : undefined,
    sort: sort && sort in PRODUCT_SORTS ? (sort as ProductSort) : "popular",
    page: page(one(sp.page)),
  };
}

/** Product filters without sort and page (for summaries and exports). */
export function productFilterQuery(p: ProductParams) {
  const { sort: _sort, page: _page, ...filters } = p;
  void _sort;
  void _page;
  return filters;
}

export const REVIEW_SORTS = {
  recent: "Most recent",
  helpful: "Most helpful",
  highest: "Highest rating",
  lowest: "Lowest rating",
  longest: "Longest",
} as const;
export type ReviewSort = keyof typeof REVIEW_SORTS;

export const RECOMMENDED = { yes: "Recommends", no: "Does not recommend", unknown: "Did not answer" } as const;

export interface ReviewParams {
  q?: string;
  subcategory?: string;
  year?: number;
  rating?: number;
  product_id?: string;
  brand?: string;
  recommended?: keyof typeof RECOMMENDED;
  skin_type?: string;
  has_text?: "true";
  sort: ReviewSort;
  page: number;
}

export function parseReviewParams(
  sp: SearchParams,
  options: FilterOptions,
  extra?: { brands: string[]; skin_types: string[] } | null,
): ReviewParams {
  const q = one(sp.q)?.trim().slice(0, 60);
  const subcategory = one(sp.subcategory);
  const year = Number(one(sp.year));
  const rating = Number(one(sp.rating));
  const sort = one(sp.sort);
  const productId = one(sp.product_id);
  const brand = one(sp.brand);
  const recommended = one(sp.recommended);
  const skinType = one(sp.skin_type);
  return {
    q: q && q.length >= 3 ? q : undefined,
    subcategory: subcategory && options.review_subcategories.some((s) => s.name === subcategory) ? subcategory : undefined,
    year: options.review_years.includes(year) ? year : undefined,
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : undefined,
    product_id: productId && /^P\d{1,12}$/.test(productId) ? productId : undefined,
    brand: brand && extra?.brands.includes(brand) ? brand : undefined,
    recommended: recommended && recommended in RECOMMENDED ? (recommended as keyof typeof RECOMMENDED) : undefined,
    skin_type: skinType && extra?.skin_types.includes(skinType) ? skinType : undefined,
    has_text: one(sp.has_text) === "true" ? "true" : undefined,
    sort: sort && sort in REVIEW_SORTS ? (sort as ReviewSort) : "recent",
    page: page(one(sp.page)),
  };
}

/** Review filters without sort and page (for summaries and exports). */
export function reviewFilterQuery(p: ReviewParams) {
  const { sort: _sort, page: _page, ...filters } = p;
  void _sort;
  void _page;
  return filters;
}

/** Link to the same page with some parameters changed; empty values and page 1 are dropped. */
export function hrefWith(path: string, params: object, changes: Record<string, string | number | undefined>): string {
  const merged: Record<string, unknown> = { ...params, ...changes };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "page" && Number(v) <= 1) continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export interface DashboardParams {
  category?: string;
}

/** The dashboard's global filter: a primary category that exists in the catalogue. */
export function parseDashboardParams(sp: SearchParams, options: FilterOptions | null): DashboardParams {
  const category = one(sp.category);
  return { category: category && options?.categories.some((c) => c.name === category) ? category : undefined };
}

export const BRAND_SORTS = {
  products: "Most products",
  loves: "Most loved",
  rating: "Highest catalogue rating",
  reviews: "Most customer reviews",
  recommend: "Highest recommendation rate",
  price_desc: "Median price: high to low",
  price_asc: "Median price: low to high",
  name: "Name A–Z",
} as const;
export type BrandSort = keyof typeof BRAND_SORTS;
export const BRAND_MIN_PRODUCTS = [5, 10, 25, 50] as const;

export interface BrandParams {
  q?: string;
  category?: string;
  min_products?: number;
  sort: BrandSort;
  page: number;
}

export function parseBrandParams(sp: SearchParams, options: FilterOptions): BrandParams {
  const q = one(sp.q)?.trim().slice(0, 80);
  const category = one(sp.category);
  const sort = one(sp.sort);
  const min = Number(one(sp.min_products));
  return {
    q: q && q.length >= 2 ? q : undefined,
    category: category && options.categories.some((c) => c.name === category) ? category : undefined,
    min_products: (BRAND_MIN_PRODUCTS as readonly number[]).includes(min) ? min : undefined,
    sort: sort && sort in BRAND_SORTS ? (sort as BrandSort) : "products",
    page: page(one(sp.page)),
  };
}

export const CATEGORY_METRICS = {
  products: "Products",
  median_loves: "Median loves per product",
  catalogue_reviews_per_product: "Catalogue reviews per product",
  median_price: "Median price",
  average_catalogue_rating: "Catalogue rating",
} as const;
export type CategoryMetric = keyof typeof CATEGORY_METRICS;

export interface CategoryParams {
  primary?: string;
  secondary?: string;
  sort: CategoryMetric;
}

/** Drill-down path from the URL; a secondary category is kept only under its own primary. */
export function parseCategoryParams(sp: SearchParams, paths: Record<string, string[]> | null): CategoryParams {
  const primary = one(sp.primary);
  const secondary = one(sp.secondary);
  const sort = one(sp.sort);
  const okPrimary = primary && paths && primary in paths ? primary : undefined;
  return {
    primary: okPrimary,
    secondary: okPrimary && secondary && paths![okPrimary].includes(secondary) ? secondary : undefined,
    sort: sort && sort in CATEGORY_METRICS ? (sort as CategoryMetric) : "products",
  };
}

export const REVIEWER_ATTRIBUTES = {
  skin_type: "Skin type",
  skin_tone: "Skin tone",
  eye_color: "Eye colour",
  hair_color: "Hair colour",
} as const;
export type AttributeKey = keyof typeof REVIEWER_ATTRIBUTES;

export interface CustomerParams {
  subcategory?: string;
  attribute: AttributeKey;
}

export function parseCustomerParams(sp: SearchParams, options: FilterOptions): CustomerParams {
  const subcategory = one(sp.subcategory);
  const attribute = one(sp.attribute);
  return {
    subcategory: subcategory && options.review_subcategories.some((s) => s.name === subcategory) ? subcategory : undefined,
    attribute: attribute && attribute in REVIEWER_ATTRIBUTES ? (attribute as AttributeKey) : "skin_type",
  };
}
