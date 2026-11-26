/** Chart preparation and one-line takeaways. Every sentence restates a computed figure. */
import type { CategoryShare, RankedBrand, RankedProduct, RatingBucket, RecommendationPatterns, TrendPoint } from "@/lib/api";
import { formatInteger, formatPercent, formatPeriod } from "@/lib/format";
import { categorical, colors, starRamp } from "@/lib/theme";
import type { Slice } from "@/components/charts/DonutChart";
import type { Column } from "@/components/charts/ColumnChart";

/** Largest categories get the fixed colours in order; the rest fold into one grey "Other" slice. */
export function categorySlices(items: CategoryShare[], max = categorical.length): Slice[] {
  const sorted = [...items].sort((a, b) => b.products - a.products || a.category.localeCompare(b.category));
  const head = sorted.slice(0, max);
  const tail = sorted.slice(max);
  const slices: Slice[] = head.map((c, i) => ({ label: c.category, value: c.products, color: categorical[i] }));
  if (tail.length === 1) {
    slices.push({ label: tail[0].category, value: tail[0].products, color: colors.other });
  } else if (tail.length > 1) {
    slices.push({
      label: `Other (${tail.length})`,
      value: tail.reduce((a, c) => a + c.products, 0),
      color: colors.other,
      detail: tail.map((c) => c.category).join(", "),
    });
  }
  return slices;
}

/** 5 -> 1 stars, darkest for 5 stars (ordered values use one hue). */
export function ratingSlices(buckets: RatingBucket[]): Slice[] {
  return [...buckets]
    .sort((a, b) => b.rating - a.rating)
    .map((b) => ({ label: `${b.rating} star${b.rating === 1 ? "" : "s"}`, value: b.count, color: starRamp[b.rating - 1] }));
}

export function categoryInsight(items: CategoryShare[]): string | undefined {
  const [first, second] = [...items].sort((a, b) => b.products - a.products);
  if (!first) return undefined;
  const lead = `${first.category} leads with ${formatPercent(first.share)} of products`;
  return second ? `${lead}, followed by ${second.category} (${formatPercent(second.share)}).` : `${lead}.`;
}

export function topProductInsight(items: RankedProduct[]): string | undefined {
  const top = items[0];
  if (!top) return undefined;
  return `${top.brand_name}'s ${top.product_name} is the most reviewed product, with ${formatInteger(top.review_count)} reviews.`;
}

export function brandInsight(items: RankedBrand[]): string | undefined {
  if (!items.length) return undefined;
  const share = items.reduce((a, b) => a + b.share, 0);
  return `${items[0].brand_name} leads; the top ${items.length} brands hold ${formatPercent(share)} of all reviews.`;
}

export function ratingInsight(buckets: RatingBucket[]): string | undefined {
  const total = buckets.reduce((a, b) => a + b.count, 0);
  if (!total) return undefined;
  const positive = buckets.filter((b) => b.rating >= 4).reduce((a, b) => a + b.count, 0) / total;
  return `${formatPercent(positive)} of reviews give 4 or 5 stars.`;
}

export function trendInsight(points: TrendPoint[]): string | undefined {
  const peak = points.reduce<TrendPoint | null>((a, p) => (!a || p.review_count > a.review_count ? p : a), null);
  if (!peak || peak.review_count === 0) return undefined;
  return `Busiest period: ${formatPeriod(peak.period)} with ${formatInteger(peak.review_count)} reviews.`;
}

/** Recommendation rate per star rating, on the 1 -> 5 star ramp; sample sizes go in the tooltip. */
export function recommendationColumns(p: RecommendationPatterns): Column[] {
  return p.by_rating.map((r) => ({
    label: `${r.rating} ★`,
    value: r.recommend_rate,
    color: starRamp[r.rating - 1],
    details: [{ label: "Reviewers who answered", value: formatInteger(r.answered) }],
  }));
}

export function recommendationInsight(p: RecommendationPatterns): string | undefined {
  if (p.recommend_rate === null) return undefined;
  const missing = p.answered + p.unanswered ? p.unanswered / (p.answered + p.unanswered) : 0;
  return `${formatPercent(p.recommend_rate)} recommend overall; ${formatPercent(missing)} of reviews did not answer and are excluded.`;
}

const FLAG_LABELS: Record<string, string> = {
  new: "New",
  exclusive: "Sephora exclusive",
  online_only: "Online only",
  limited_edition: "Limited edition",
  on_sale: "On sale",
  out_of_stock: "Out of stock",
};
export const flagLabel = (key: string) => FLAG_LABELS[key] ?? key;

/** "+0.25 vs category": the product's rating against its primary category's mean. */
export function ratingIndicator(delta: number | null): { text: string; tone: "positive" | "negative" | "neutral" } | null {
  if (delta === null) return null;
  if (Math.abs(delta) < 0.05) return { text: "At category average", tone: "neutral" };
  const sign = delta > 0 ? "+" : "−";
  return { text: `${sign}${Math.abs(delta).toFixed(2)} vs category`, tone: delta > 0 ? "positive" : "negative" };
}

/** "Top 5% loved in category" from the loves percentile (share of products with fewer loves). */
export function lovesIndicator(percentile: number | null): string | null {
  if (percentile === null) return null;
  // Round first: (1 - 0.97) * 100 is 3.0000000000000027 in floating point.
  const top = Math.max(1, Math.ceil(Math.round((1 - percentile) * 1000) / 10));
  return top <= 50 ? `Top ${top}% loved in category` : `Bottom ${101 - top}% loved in category`;
}
