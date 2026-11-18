/** Validated URL state for the Products and Reviews pages (filters live in the URL). */
import type { FilterOptions } from "@/lib/api";

export type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function page(v: string | undefined): number {
  return v && /^\d{1,4}$/.test(v) && Number(v) >= 1 ? Number(v) : 1;
}

export const PRODUCT_SORTS = {
  popular: "Most loved",
  rating: "Highest rated",
  reviews: "Most reviewed",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  name: "Name A–Z",
} as const;
export type ProductSort = keyof typeof PRODUCT_SORTS;

export interface ProductParams {
  q?: string;
  category?: string;
  sort: ProductSort;
  page: number;
}

export function parseProductParams(sp: SearchParams, options: FilterOptions): ProductParams {
  const q = one(sp.q)?.trim().slice(0, 80);
  const category = one(sp.category);
  const sort = one(sp.sort);
  return {
    q: q && q.length >= 2 ? q : undefined,
    category: category && options.categories.some((c) => c.name === category) ? category : undefined,
    sort: sort && sort in PRODUCT_SORTS ? (sort as ProductSort) : "popular",
    page: page(one(sp.page)),
  };
}

export const REVIEW_SORTS = {
  recent: "Most recent",
  helpful: "Most helpful",
  highest: "Highest rating",
  lowest: "Lowest rating",
} as const;
export type ReviewSort = keyof typeof REVIEW_SORTS;

export interface ReviewParams {
  subcategory?: string;
  year?: number;
  rating?: number;
  sort: ReviewSort;
  page: number;
}

export function parseReviewParams(sp: SearchParams, options: FilterOptions): ReviewParams {
  const subcategory = one(sp.subcategory);
  const year = Number(one(sp.year));
  const rating = Number(one(sp.rating));
  const sort = one(sp.sort);
  return {
    subcategory: subcategory && options.review_subcategories.some((s) => s.name === subcategory) ? subcategory : undefined,
    year: options.review_years.includes(year) ? year : undefined,
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : undefined,
    sort: sort && sort in REVIEW_SORTS ? (sort as ReviewSort) : "recent",
    page: page(one(sp.page)),
  };
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
