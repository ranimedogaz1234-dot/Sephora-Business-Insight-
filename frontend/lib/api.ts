/**
 * Typed client for the FastAPI backend. Only used on the server (SEPHORA_API_URL is not
 * exposed to the browser), so the backend never needs to accept cross-origin requests.
 */

export interface Overview {
  total_products: number;
  total_brands: number;
  total_categories: number;
  average_price: number;
  total_reviews: number;
  average_rating: number | null;
  five_star_share: number | null;
  recommend_rate: number | null;
  reviewed_products: number;
  first_review: string | null;
  last_review: string | null;
  review_categories: string[];
  raw_review_rows: number;
  duplicates_removed: number;
}

export interface CategoryShare {
  category: string;
  products: number;
  share: number;
}

export interface RankedProduct {
  product_id: string;
  product_name: string;
  brand_name: string;
  review_count: number;
  average_rating: number;
}

export interface RankedBrand {
  brand_name: string;
  review_count: number;
  share: number;
  average_rating: number;
  products: number;
}

export interface RatingBucket {
  rating: number;
  count: number;
  share: number;
}

export interface TrendPoint {
  period: string;
  review_count: number;
  average_rating: number | null;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface FilterOptions {
  categories: NamedCount[];
  review_subcategories: NamedCount[];
  review_years: number[];
}

export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ProductRow {
  product_id: string;
  product_name: string;
  brand_name: string;
  category: string;
  subcategory: string;
  price: number;
  /** Sephora's catalogue rating. */
  rating: number | null;
  /** Sephora's catalogue review count (not the review rows). */
  catalogue_reviews: number | null;
  loves: number;
  /** Rows in the review files (Skincare only). */
  review_count: number;
}

export interface ReviewSummary {
  total_reviews: number;
  average_rating: number | null;
  recommend_rate: number | null;
  reviewed_products: number;
  ratings: RatingBucket[];
  granularity: "month" | "year";
  trend: TrendPoint[];
  top_products: RankedProduct[];
}

export interface ReviewRow {
  product_id: string;
  product_name: string;
  brand_name: string;
  subcategory: string | null;
  rating: number;
  recommended: boolean | null;
  helpful_votes: number;
  date: string;
  title: string | null;
  text: string | null;
  skin_type: string | null;
}

export type Query = Record<string, string | number | undefined | null>;

export function apiBase(): string {
  return (process.env.SEPHORA_API_URL || "http://127.0.0.1:8011").replace(/\/$/, "");
}

export function toQueryString(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export class ApiError extends Error {}

/** GET a JSON endpoint. The first request after a data change may take ~30 s (cache build). */
export async function get<T>(path: string, query?: Query): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}${toQueryString(query)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new ApiError("The analytics service could not be reached.");
  }
  if (response.status === 503) throw new ApiError("The dataset is not available on the server.");
  if (!response.ok) throw new ApiError(`The analytics service returned an error (${response.status}).`);
  return (await response.json()) as T;
}

export const api = {
  overview: () => get<Overview>("/api/overview"),
  categories: () => get<CategoryShare[]>("/api/categories"),
  topProducts: (limit = 10) => get<RankedProduct[]>("/api/top-products", { limit }),
  topBrands: (limit = 10) => get<RankedBrand[]>("/api/top-brands", { limit }),
  ratings: () => get<RatingBucket[]>("/api/ratings"),
  trend: (granularity: "month" | "year") => get<TrendPoint[]>("/api/trend", { granularity }),
  filters: () => get<FilterOptions>("/api/filters"),
  products: (q: Query) => get<Page<ProductRow>>("/api/products", q),
  reviewSummary: (q: Query) => get<ReviewSummary>("/api/reviews/summary", q),
  reviews: (q: Query) => get<Page<ReviewRow>>("/api/reviews", q),
};

/** Run a request without letting its failure break the whole page. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function attempt<T>(promise: Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unexpected error." };
  }
}
