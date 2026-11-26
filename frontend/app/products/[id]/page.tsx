import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeDollarSign, Heart, MessageSquareHeart, Star, ThumbsUp } from "lucide-react";
import { api, attempt, type ProductDetail, type ProductReviewStats } from "@/lib/api";
import { formatCompact, formatDate, formatInteger, formatPercent, formatRating, formatUsd } from "@/lib/format";
import { flagLabel, lovesIndicator, ratingIndicator, ratingInsight, trendInsight } from "@/lib/insights";
import { Badge } from "@/components/ui/Badge";
import { Card, ChartCard, ErrorState, KpiCard, PageHeader, SectionTitle } from "@/components/ui/Card";
import { ProductCard } from "@/components/ui/ProductCard";
import { ReviewCard } from "@/components/ui/ReviewCard";
import { ScopeNote } from "@/components/ui/ScopeNote";
import { DataTable, Missing, Td, Th } from "@/components/ui/Table";
import { RatingBars } from "@/components/charts/RatingBars";
import { TrendChart } from "@/components/charts/TrendChart";

type Props = { params: Promise<{ id: string }> };

const VALID_ID = /^P\d{1,12}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!VALID_ID.test(id)) return { title: "Product" };
  const r = await attempt(api.product(id));
  return { title: r.ok ? r.data.product.product_name : "Product" };
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-charcoal">{children}</dd>
    </div>
  );
}

function Pricing({ p }: { p: ProductDetail }) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-charcoal">Pricing</h2>
      <dl className="mt-3">
        <Fact label="Listed price">{formatUsd(p.price)}</Fact>
        <Fact label="Sale price">{p.sale_price === null ? <Missing label="Not on sale" /> : formatUsd(p.sale_price)}</Fact>
        <Fact label="Value price">{p.value_price === null ? <Missing label="No value price listed" /> : formatUsd(p.value_price)}</Fact>
        <Fact label="Variants">{p.variants ? formatInteger(p.variants) : <Missing label="No variants" />}</Fact>
        <Fact label="Variant prices">
          {p.variant_min_price === null ? (
            <Missing label="No variant prices" />
          ) : p.variant_min_price === p.variant_max_price ? (
            formatUsd(p.variant_min_price)
          ) : (
            `${formatUsd(p.variant_min_price)} – ${formatUsd(p.variant_max_price!)}`
          )}
        </Fact>
      </dl>
    </Card>
  );
}

function Catalogue({ p }: { p: ProductDetail }) {
  const rating = ratingIndicator(p.rating_vs_category);
  return (
    <Card>
      <h2 className="text-base font-semibold text-charcoal">Catalogue performance</h2>
      <dl className="mt-3">
        <Fact label="Catalogue rating">{p.rating === null ? <Missing label="Not rated" /> : `★ ${formatRating(p.rating)}`}</Fact>
        <Fact label={`${p.category} average`}>{p.category_rating === null ? <Missing /> : `★ ${formatRating(p.category_rating)}`}</Fact>
        <Fact label="Against category">{rating ? <Badge tone={rating.tone}>{rating.text}</Badge> : <Missing />}</Fact>
        <Fact label="Catalogue reviews">{p.catalogue_reviews === null ? <Missing /> : formatInteger(p.catalogue_reviews)}</Fact>
        <Fact label="Loves">
          {formatInteger(p.loves)}
          {p.loves_percentile !== null && <span className="block text-xs font-normal text-muted">{lovesIndicator(p.loves_percentile)}</span>}
        </Fact>
      </dl>
    </Card>
  );
}

function Attributes({ p }: { p: ProductDetail }) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-charcoal">Attributes</h2>
      <dl className="mt-3">
        <Fact label="Brand">
          <Link href={`/brands/${p.brand_id}`} className="text-burgundy hover:underline">
            {p.brand_name}
          </Link>
        </Fact>
        <Fact label="Category">
          {[p.category, p.subcategory, p.tertiary_category].filter(Boolean).join(" › ")}
        </Fact>
        <Fact label="Size">{p.size ?? <Missing label="No size listed" />}</Fact>
        <Fact label={p.variation_type ?? "Variation"}>
          {p.variation_value ?? <Missing label="No variation listed" />}
          {p.variation_desc && <span className="block text-xs font-normal text-muted">{p.variation_desc}</span>}
        </Fact>
        <Fact label="Listing">
          {p.flags.length ? (
            <span className="flex flex-wrap justify-end gap-1">
              {p.flags.map((f) => (
                <Badge key={f} tone={f === "out_of_stock" ? "warning" : "brand"}>
                  {flagLabel(f)}
                </Badge>
              ))}
            </span>
          ) : (
            "Standard"
          )}
        </Fact>
      </dl>
    </Card>
  );
}

function CustomerReviews({ r }: { r: ProductReviewStats }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Customer reviews"
          value={formatInteger(r.count)}
          note={`${formatDate(r.first_review)} – ${formatDate(r.last_review)}`}
          icon={MessageSquareHeart}
          accent
        />
        <KpiCard label="Average review rating" value={`${formatRating(r.average_rating)} ★`} note="Stars given in the review files" icon={Star} />
        <KpiCard
          label="Would recommend"
          value={r.recommend_rate === null ? "—" : formatPercent(r.recommend_rate)}
          note={`Among ${formatInteger(r.recommend_answered)} reviewers who answered`}
          icon={ThumbsUp}
        />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <ChartCard title="Rating distribution" insight={ratingInsight(r.ratings)} className="xl:col-span-2">
          <RatingBars buckets={r.ratings} />
        </ChartCard>
        <ChartCard
          title={r.granularity === "year" ? "Reviews per year" : "Reviews per month"}
          insight={trendInsight(r.trend)}
          className="xl:col-span-3"
        >
          <TrendChart series={[{ key: r.granularity, label: r.granularity, points: r.trend }]} height={260} />
        </ChartCard>
      </div>
      {r.by_skin_type.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-base font-semibold text-charcoal">Ratings and recommendations by reviewer skin type</h3>
          <DataTable caption="Ratings and recommendations by reviewer skin type" minWidth={520}>
            <thead>
              <tr>
                <Th>Skin type</Th>
                <Th align="right">Reviews</Th>
                <Th align="right">Average rating</Th>
                <Th align="right">Would recommend</Th>
              </tr>
            </thead>
            <tbody>
              {r.by_skin_type.map((s) => (
                <tr key={s.name} className="border-t border-line">
                  <Td className="capitalize">{s.name}</Td>
                  <Td align="right">{formatInteger(s.count)}</Td>
                  <Td align="right">{s.average_rating === null ? <Missing /> : `★ ${formatRating(s.average_rating)}`}</Td>
                  <Td align="right">{s.recommend_rate === null ? <Missing label="No answers" /> : formatPercent(s.recommend_rate)}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <p className="mt-2 text-xs text-muted">Skin type is optional; reviews without it are not counted in this table.</p>
        </div>
      )}
      {r.most_helpful.length > 0 && (
        <>
          <h3 className="mb-3 mt-8 text-base font-semibold text-charcoal">Most helpful reviews</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {r.most_helpful.map((x, i) => (
              <ReviewCard key={i} r={x} maxLength={420} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  if (!VALID_ID.test(id)) notFound();
  const result = await attempt(api.product(id));
  if (!result.ok && result.notFound) notFound();
  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Product" title="Product details" description="Details for one product." />
        <ErrorState message={result.error} />
      </>
    );
  }
  const { product: p, reviews, related, same_brand, related_rule } = result.data;

  return (
    <>
      <Link href="/products" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-burgundy print:hidden">
        <ArrowLeft aria-hidden className="h-4 w-4" /> All products
      </Link>
      <PageHeader eyebrow={p.brand_name} title={p.product_name} description={`${p.category} › ${p.subcategory} · Product ${p.product_id}`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Price"
          value={formatUsd(p.sale_price ?? p.price)}
          note={p.sale_price !== null ? `On sale, listed at ${formatUsd(p.price)}` : "Listed USD price"}
          icon={BadgeDollarSign}
        />
        <KpiCard
          label="Catalogue rating"
          value={p.rating === null ? "—" : `${formatRating(p.rating)} ★`}
          note={p.catalogue_reviews === null ? "No catalogue reviews" : `${formatInteger(p.catalogue_reviews)} reviews on Sephora`}
          icon={Star}
          accent
        />
        <KpiCard label="Loves" value={formatCompact(p.loves)} note={lovesIndicator(p.loves_percentile) ?? undefined} icon={Heart} />
        <KpiCard
          label="Reviews in this dataset"
          value={reviews ? formatCompact(reviews.count) : "—"}
          note={reviews ? `Average ${formatRating(reviews.average_rating)} ★` : "Review files cover Skincare only"}
          icon={MessageSquareHeart}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Pricing p={p} />
        <Catalogue p={p} />
        <Attributes p={p} />
      </div>

      {(p.highlights.length > 0 || p.ingredients.length > 0) && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="text-base font-semibold text-charcoal">Highlights</h2>
            {p.highlights.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {p.highlights.map((h) => (
                  <li key={h}>
                    <Badge tone="brand">{h}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No highlights listed for this product.</p>
            )}
          </Card>
          <Card>
            <h2 className="text-base font-semibold text-charcoal">Ingredients</h2>
            {p.ingredients.length ? (
              <details className="group mt-3">
                <summary className="cursor-pointer text-sm font-medium text-burgundy">
                  Show the full ingredient list{p.ingredients.length > 1 ? ` (${p.ingredients.length} parts)` : ""}
                </summary>
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto text-xs leading-relaxed text-muted">
                  {p.ingredients.map((part, i) => (
                    <p key={i}>{part}</p>
                  ))}
                </div>
              </details>
            ) : (
              <p className="mt-3 text-sm text-muted">No ingredient list in the dataset for this product.</p>
            )}
          </Card>
        </div>
      )}

      <SectionTitle title="Customer reviews" description="Statistics computed from the review files for this product." />
      {reviews ? (
        <CustomerReviews r={reviews} />
      ) : (
        <ScopeNote>
          The review files contain no reviews for this product: they cover Skincare products only
          {p.category === "Skincare" ? " (and not every Skincare product)" : ""}. Sephora&apos;s own catalogue rating
          {p.catalogue_reviews ? ` (${formatInteger(p.catalogue_reviews)} reviews)` : ""} is shown above.
        </ScopeNote>
      )}

      <SectionTitle title="Related products" description={`${related_rule}.`} />
      {related.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {related.map((x) => (
            <ProductCard key={x.product_id} p={x} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No other product in this subcategory falls within the price range.</p>
      )}

      {same_brand.length > 0 && (
        <>
          <SectionTitle title={`More from ${p.brand_name}`} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {same_brand.map((x) => (
              <ProductCard key={x.product_id} p={x} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
