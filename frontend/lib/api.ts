/**
 * Typed client for the FastAPI backend. Only used on the server (SEPHORA_API_URL is not
 * exposed to the browser), so the backend never needs to accept cross-origin requests.
 */

export interface Overview {
  /** The primary category the figures are scoped to, or null for the whole catalogue. */
  category: string | null;
  total_products: number;
  total_brands: number;
  total_categories: number;
  average_price: number | null;
  median_price: number | null;
  /** Mean of Sephora's catalogue rating over rated products. */
  average_catalogue_rating: number | null;
  total_loves: number;
  total_reviews: number;
  average_rating: number | null;
  five_star_share: number | null;
  recommend_rate: number | null;
  /** Reviews that answered the recommendation question. */
  recommend_answered: number;
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

export type ProductFlag = "new" | "exclusive" | "online_only" | "limited_edition" | "on_sale" | "out_of_stock";

export interface ProductRow {
  product_id: string;
  product_name: string;
  brand_id: number;
  brand_name: string;
  category: string;
  subcategory: string;
  price: number;
  sale_price: number | null;
  /** Sephora's catalogue rating. */
  rating: number | null;
  /** Sephora's catalogue review count (not the review rows). */
  catalogue_reviews: number | null;
  loves: number;
  /** Rows in the review files (Skincare only). */
  review_count: number;
  /** Catalogue rating minus the mean rating of the product's primary category. */
  rating_vs_category: number | null;
  /** Share of products in the same primary category with fewer loves (0–1). */
  loves_percentile: number | null;
  flags: ProductFlag[];
}

export interface Bucket {
  label: string;
  count: number;
}

export interface ProductSummary {
  total: number;
  brands: number;
  categories: number;
  median_price: number | null;
  average_price: number | null;
  min_price: number | null;
  max_price: number | null;
  average_rating: number | null;
  rated: number;
  total_loves: number;
  with_reviews_in_dataset: number;
  flags: Record<string, number>;
  price_histogram: Bucket[];
  rating_histogram: Bucket[];
  top_brands: { brand_name: string; products: number; average_rating: number | null; loves: number }[];
  category_split: NamedCount[];
  best_rated: ProductRow[];
  most_loved: ProductRow[];
  min_reviews_for_ranking: number;
}

export interface ProductDetail extends ProductRow {
  tertiary_category: string | null;
  size: string | null;
  variation_type: string | null;
  variation_value: string | null;
  variation_desc: string | null;
  value_price: number | null;
  variants: number;
  variant_min_price: number | null;
  variant_max_price: number | null;
  highlights: string[];
  ingredients: string[];
  category_rating: number | null;
}

export interface ReviewCardData {
  rating: number;
  recommended: boolean | null;
  helpful_votes: number;
  unhelpful_votes?: number;
  date: string;
  title: string | null;
  text: string | null;
  skin_type: string | null;
}

export interface ProductReviewStats {
  count: number;
  average_rating: number;
  recommend_rate: number | null;
  recommend_answered: number;
  first_review: string;
  last_review: string;
  ratings: RatingBucket[];
  granularity: "month" | "year";
  trend: TrendPoint[];
  by_skin_type: { name: string; count: number; average_rating: number | null; recommend_rate: number | null }[];
  most_helpful: ReviewCardData[];
}

export interface ProductDetails {
  product: ProductDetail;
  /** null when the review files do not contain the product (they cover Skincare only). */
  reviews: ProductReviewStats | null;
  related: ProductRow[];
  same_brand: ProductRow[];
  related_rule: string;
}

export interface BrandRow {
  brand_id: number;
  brand_name: string;
  products: number;
  categories: number;
  main_category: string;
  median_price: number | null;
  average_price: number | null;
  min_price: number | null;
  max_price: number | null;
  average_catalogue_rating: number | null;
  rated_products: number;
  total_loves: number;
  catalogue_reviews: number;
  exclusives: number;
  new_products: number;
  /** Rows in the review files; 0 when the brand has no Skincare reviews there. */
  review_rows: number;
  reviewed_products: number;
  average_review_rating: number | null;
  recommend_rate: number | null;
  rank_products: number;
  rank_loves: number;
  rank_reviews: number | null;
}

export interface BrandSummary {
  brands: number;
  brands_with_reviews: number;
  median_products: number | null;
  top10_product_share: number | null;
  size_distribution: Bucket[];
  by_products: BrandRow[];
  by_loves: BrandRow[];
  by_reviews: BrandRow[];
  price_vs_rating: { brand_id: number; brand_name: string; median_price: number; average_catalogue_rating: number; products: number }[];
  scatter_min_rated: number;
}

export interface BrandDetails {
  brand: BrandRow;
  brands_total: number;
  catalogue_average_rating: number;
  catalogue_median_price: number;
  categories: { category: string; subcategory: string; products: number; average_rating: number | null; median_price: number }[];
  price_quartiles: number[];
  products: ProductRow[];
  reviews: {
    count: number;
    average_rating: number;
    recommend_rate: number | null;
    recommend_answered: number;
    ratings: RatingBucket[];
    granularity: "month" | "year";
    trend: TrendPoint[];
    top_products: { product_id: string; product_name: string; review_count: number; average_rating: number }[];
  } | null;
}

export interface CategoryNode {
  name: string;
  products: number;
  share: number | null;
  brands: number;
  median_price: number | null;
  p25_price: number | null;
  p75_price: number | null;
  average_price: number | null;
  average_catalogue_rating: number | null;
  rated_products: number;
  total_loves: number;
  /** Median loves per product: the main popularity measure (engagement, not sales). */
  median_loves: number | null;
  loves_per_product: number | null;
  catalogue_reviews_per_product: number | null;
  exclusive_share: number | null;
  review_rows: number;
  average_review_rating: number | null;
  recommend_rate: number | null;
  can_drill: boolean;
}

export interface CategoryAnalytics {
  level: "primary_category" | "secondary_category" | "tertiary_category";
  path: string[];
  totals: {
    products: number;
    brands: number;
    children: number;
    median_price: number | null;
    average_catalogue_rating: number | null;
    median_loves: number | null;
    review_rows: number;
  };
  children: CategoryNode[];
  most_loved: ProductRow[];
  best_rated: ProductRow[];
  min_reviews_for_ranking: number;
}

export type ReviewerAttribute = "skin_type" | "skin_tone" | "eye_color" | "hair_color";

export interface AttributeGroup {
  key: string;
  label: string;
  /** Reviews (not people) that gave this answer. */
  count: number;
  share: number;
  average_rating: number | null;
  recommend_rate: number | null;
  positive_share: number | null;
  negative_share: number | null;
  /** Share of 1★..5★ reviews within the group. */
  rating_shares: (number | null)[];
}

export interface CustomerSummary {
  subcategory: string | null;
  reviews: number;
  average_rating: number | null;
  recommend_rate: number | null;
  attributes: { attribute: ReviewerAttribute; name: string; answered: number; coverage: number | null; groups: AttributeGroup[] }[];
  activity: { distinct_reviewer_ids: number; bands: { label: string; reviewers: number; reviews: number }[] };
  total_reviews: number;
}

export interface CustomerPreferences {
  attribute: ReviewerAttribute;
  name: string;
  min_group_reviews_for_product: number;
  min_subcategory_reviews: number;
  groups: {
    key: string;
    label: string;
    count: number;
    average_rating: number | null;
    subcategories: { name: string; reviews: number; share: number; lift: number }[];
    top_rated: { product_id: string; product_name: string; brand_name: string; reviews: number; average_rating: number }[];
  }[];
}

export interface PriceSpread {
  name: string;
  products: number;
  median_price: number;
  p25_price: number;
  p75_price: number;
  min_price: number;
  max_price: number;
}

export interface PricedProduct extends ProductRow {
  segment: string;
  /** Price divided by the median price of the product's primary category. */
  price_index: number;
  category_median_price: number;
  value_position: string;
}

export interface Pricing {
  category: string | null;
  products: number;
  average_price: number | null;
  median_price: number | null;
  percentiles: Record<"p10" | "p25" | "p75" | "p90", number | null>;
  min_price: number | null;
  max_price: number | null;
  histogram: Bucket[];
  segments: {
    segment: string;
    products: number;
    share: number | null;
    median_price: number | null;
    min_price: number | null;
    max_price: number | null;
    average_rating: number | null;
    median_loves: number | null;
    recommend_rate: number | null;
    review_rows: number;
  }[];
  bands: { label: string; products: number; average_rating: number | null; top_rated_share: number | null; median_loves: number | null }[];
  rating_price_correlation: number | null;
  loves_price_correlation: number | null;
  by_category: PriceSpread[];
  by_brand: PriceSpread[];
  value_positions: { key: string; label: string; products: number }[];
  best_affordable: PricedProduct[];
  high_value: PricedProduct[];
  sale: { products: number; median_discount: number | null };
  min_reviews_for_ranking: number;
}

export interface ProductOptions {
  brands: NamedCount[];
  subcategories: { category: string; name: string; count: number }[];
  flags: { key: string; label: string }[];
  price_range: [number, number];
}

export interface ReviewSummary {
  filters: Record<string, string | number | boolean>;
  total_reviews: number;
  average_rating: number | null;
  recommend_rate: number | null;
  reviewed_products: number;
  ratings: RatingBucket[];
  /** Star-rating groups (not text sentiment): positive 4–5★, neutral 3★, negative 1–2★. */
  rating_groups: { key: "positive" | "neutral" | "negative"; label: string; count: number; share: number | null }[];
  recommendation: { yes: number; no: number; unknown: number };
  granularity: "month" | "year";
  trend: TrendPoint[];
  top_products: RankedProduct[];
  text: { with_text: number; median_length: number | null; length_bands: { label: string; count: number; average_rating: number | null }[] };
  helpfulness: { with_votes: number; total_helpful_votes: number; total_unhelpful_votes: number };
  most_helpful: ReviewRow[];
  term?: {
    q: string;
    matches: number;
    base_reviews: number;
    mention_share: number | null;
    average_rating_with_term: number | null;
    average_rating_without_term: number | null;
  };
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

export interface CategoryPerformance {
  category: string;
  products: number;
  share: number;
  brands: number;
  average_price: number | null;
  median_price: number | null;
  average_catalogue_rating: number | null;
  rated_products: number;
  total_loves: number;
  median_loves: number | null;
  /** Sephora's catalogue review counts, summed. */
  catalogue_reviews: number;
  /** Rows in the review files (Skincare only). */
  review_rows: number;
  average_review_rating: number | null;
  recommend_rate: number | null;
}

export interface RecommendationPatterns {
  answered: number;
  unanswered: number;
  recommend_rate: number | null;
  by_rating: { rating: number; answered: number; recommend_rate: number | null }[];
  by_year: { year: number; answered: number; recommend_rate: number | null }[];
}

export type Tone = "neutral" | "positive" | "warning" | "negative";

export interface Observation {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
  /** The figures the observation was computed from. */
  evidence: Record<string, number | string | null>;
}

/* ----------------------------------------------------------------------------- sentiment */
export type SentimentLabel = "negative" | "neutral" | "positive";
export type SentimentShares = Record<SentimentLabel, number | null>;

export interface SentimentSummary {
  model: string;
  model_version: string;
  reviews: number;
  shares: SentimentShares;
  counts: Record<SentimentLabel, number>;
  /** Mean adapted VADER compound score, from -1 (negative) to 1 (positive). */
  average_compound: number | null;
  /** Share of reviews whose text label matches their star group (1–2, 3, 4–5★). */
  agreement_with_stars: number | null;
  trend: ({ period: string; reviews: number; average_compound: number | null } & SentimentShares)[];
  by_stars: ({ rating: number; reviews: number } & SentimentShares)[];
  by_subcategory: { name: string; reviews: number; positive: number; negative: number; average_compound: number }[];
}

export interface SentimentRankRow {
  reviews: number;
  positive: number;
  negative: number;
  average_compound: number;
  average_rating: number;
  brand_name: string;
  product_id?: string;
  product_name?: string;
}

export interface SentimentRankings {
  level: "product" | "brand";
  min_reviews: number;
  eligible: number;
  most_positive: SentimentRankRow[];
  most_negative: SentimentRankRow[];
}

export interface SentimentExample extends ReviewCardData {
  product_id: string;
  product_name: string;
  brand_name: string;
  compound: number;
  sentiment: SentimentLabel;
}

export type SentimentExamples = Record<SentimentLabel | "disagreements", SentimentExample[]>;

export interface SentimentTerm {
  term: string;
  reviews: number;
  share: number;
  log_ratio: number;
}

export interface SentimentTopics {
  aspects: ({ aspect: string; pattern: string; mentions: number; share: number | null; average_rating: number | null } & SentimentShares)[];
  words: {
    sample_size: number;
    classes: Partial<Record<"positive" | "negative", {
      reviews: number;
      frequent_words: SentimentTerm[];
      distinctive_words: SentimentTerm[];
      frequent_phrases: SentimentTerm[];
      distinctive_phrases: SentimentTerm[];
    }>>;
  };
}

export interface SentimentMetrics {
  accuracy: number;
  macro_f1: number;
  cohen_kappa: number | null;
  per_class: { label: SentimentLabel; precision: number; recall: number; f1: number; support: number }[];
  /** Rows: star group (negative, neutral, positive); columns: text label in the same order. */
  confusion: number[][];
}

export interface SentimentMethodology {
  model: string;
  model_version: string;
  threshold: number;
  title_weight: number;
  domain_lexicon: Record<string, number>;
  phrases: { pattern: string; replacement: string }[];
  reviews: number;
  validation: {
    sample_size: number;
    reference: string;
    base_vader: SentimentMetrics | null;
    adapted: SentimentMetrics | null;
    full_data_agreement: number;
  };
  seconds_scoring: number;
  seconds_total: number;
  workers: number;
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
/** The requested item does not exist (HTTP 404). */
export class NotFoundError extends ApiError {}

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
  if (response.status === 503) {
    // The backend's 503 details are short fixed messages (no paths), so they can be shown as they are.
    const detail = await response.json().then((b) => b?.detail, () => undefined);
    throw new ApiError(typeof detail === "string" && detail !== "Dataset is not available" ? `${detail}.` : "The dataset is not available on the server.");
  }
  if (response.status === 404) throw new NotFoundError("Not found.");
  if (!response.ok) throw new ApiError(`The analytics service returned an error (${response.status}).`);
  return (await response.json()) as T;
}

export const api = {
  overview: (category?: string) => get<Overview>("/api/overview", { category }),
  categories: () => get<CategoryShare[]>("/api/categories"),
  topProducts: (limit = 10, category?: string) => get<RankedProduct[]>("/api/top-products", { limit, category }),
  topBrands: (limit = 10, category?: string) => get<RankedBrand[]>("/api/top-brands", { limit, category }),
  ratings: (category?: string) => get<RatingBucket[]>("/api/ratings", { category }),
  trend: (granularity: "month" | "year", category?: string) => get<TrendPoint[]>("/api/trend", { granularity, category }),
  categoryPerformance: () => get<CategoryPerformance[]>("/api/category-performance"),
  recommendations: (category?: string) => get<RecommendationPatterns>("/api/recommendations", { category }),
  observations: (category?: string) => get<Observation[]>("/api/observations", { category }),
  filters: () => get<FilterOptions>("/api/filters"),
  products: (q: Query) => get<Page<ProductRow>>("/api/products", q),
  productSummary: (q: Query) => get<ProductSummary>("/api/products/summary", q),
  productOptions: () => get<ProductOptions>("/api/products/options"),
  categoryAnalytics: (q: Query) => get<CategoryAnalytics>("/api/category-analytics", q),
  pricing: (category?: string) => get<Pricing>("/api/pricing", { category }),
  customers: (q: Query) => get<CustomerSummary>("/api/customers", q),
  customerPreferences: (q: Query) => get<CustomerPreferences>("/api/customers/preferences", q),
  brands: (q: Query) => get<Page<BrandRow>>("/api/brands", q),
  brandSummary: (q: Query) => get<BrandSummary>("/api/brands/summary", q),
  brandOptions: () => get<{ brand_id: number; brand_name: string; products: number }[]>("/api/brands/options"),
  brand: (id: number) => get<BrandDetails>(`/api/brands/${id}`),
  product: (id: string) => get<ProductDetails>(`/api/products/${encodeURIComponent(id)}`),
  reviewSummary: (q: Query) => get<ReviewSummary>("/api/reviews/summary", q),
  reviews: (q: Query) => get<Page<ReviewRow>>("/api/reviews", q),
  reviewOptions: () => get<{ brands: string[]; skin_types: string[] }>("/api/reviews/options"),
  sentiment: (q: Query) => get<SentimentSummary>("/api/sentiment", q),
  sentimentRankings: (q: Query) => get<SentimentRankings>("/api/sentiment/rankings", q),
  sentimentExamples: (q: Query) => get<SentimentExamples>("/api/sentiment/examples", q),
  sentimentTopics: () => get<SentimentTopics>("/api/sentiment/topics"),
  sentimentMethodology: () => get<SentimentMethodology>("/api/sentiment/methodology"),
};

/** Run a request without letting its failure break the whole page. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function attempt<T>(promise: Promise<T>): Promise<Result<T> & { notFound?: boolean }> {
  try {
    return { ok: true, data: await promise };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unexpected error.", notFound: e instanceof NotFoundError };
  }
}
