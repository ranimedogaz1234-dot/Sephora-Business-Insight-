import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeDollarSign, Heart, MessageSquareHeart, ShoppingBag, Star, ThumbsUp } from "lucide-react";
import { api, attempt } from "@/lib/api";
import { formatCompact, formatInteger, formatPercent, formatRating, formatUsd } from "@/lib/format";
import { ratingInsight, trendInsight } from "@/lib/insights";
import { Card, ChartCard, ErrorState, KpiCard, PageHeader, SectionTitle } from "@/components/ui/Card";
import { ProductCard } from "@/components/ui/ProductCard";
import { ScopeNote } from "@/components/ui/ScopeNote";
import { DataTable, Missing, Td, Th } from "@/components/ui/Table";
import { RankedBars } from "@/components/charts/RankedBars";
import { RatingBars } from "@/components/charts/RatingBars";
import { TrendChart } from "@/components/charts/TrendChart";

type Props = { params: Promise<{ id: string }> };

const parseId = (id: string) => (/^\d{1,9}$/.test(id) && Number(id) >= 1 ? Number(id) : null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  if (id === null) return { title: "Brand" };
  const r = await attempt(api.brand(id));
  return { title: r.ok ? r.data.brand.brand_name : "Brand" };
}

function delta(value: number | null, reference: number, fmt: (n: number) => string, unit = "") {
  if (value === null) return undefined;
  const d = value - reference;
  return `${d >= 0 ? "+" : "−"}${fmt(Math.abs(d))}${unit} vs catalogue (${fmt(reference)}${unit})`;
}

export default async function BrandPage({ params }: Props) {
  const id = parseId((await params).id);
  if (id === null) notFound();
  const result = await attempt(api.brand(id));
  if (!result.ok && result.notFound) notFound();
  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Brand" title="Brand analysis" description="Analysis of one brand." />
        <ErrorState message={result.error} />
      </>
    );
  }
  const { brand: b, brands_total, catalogue_average_rating, catalogue_median_price, categories, price_quartiles, products, reviews } = result.data;
  const [min, q1, median, q3, max] = price_quartiles;

  return (
    <>
      <Link href="/brands" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-burgundy print:hidden">
        <ArrowLeft aria-hidden className="h-4 w-4" /> All brands
      </Link>
      <PageHeader
        eyebrow="Brand"
        title={b.brand_name}
        description={`#${b.rank_products} of ${brands_total} brands by number of products · #${b.rank_loves} by loves${b.rank_reviews ? ` · #${b.rank_reviews} by customer reviews` : ""}.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Products"
          value={formatInteger(b.products)}
          note={`${b.categories} ${b.categories === 1 ? "category" : "categories"} · ${b.exclusives} Sephora exclusive`}
          icon={ShoppingBag}
          accent
          href={`/products?brand=${encodeURIComponent(b.brand_name)}`}
        />
        <KpiCard
          label="Median price"
          value={b.median_price === null ? "—" : formatUsd(b.median_price)}
          note={delta(b.median_price, catalogue_median_price, (n) => formatUsd(n))}
          icon={BadgeDollarSign}
        />
        <KpiCard
          label="Catalogue rating"
          value={b.average_catalogue_rating === null ? "—" : `${formatRating(b.average_catalogue_rating)} ★`}
          note={delta(b.average_catalogue_rating, catalogue_average_rating, formatRating) ?? "No rated products"}
          icon={Star}
        />
        <KpiCard label="Loves" value={formatCompact(b.total_loves)} note={`${formatInteger(b.catalogue_reviews)} reviews on Sephora's product pages`} icon={Heart} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold text-charcoal">Price range</h2>
          <p className="mt-1 text-sm text-muted">Listed prices of the brand&apos;s {formatInteger(b.products)} products.</p>
          <div className="mt-6" role="img" aria-label={`Prices from ${formatUsd(min)} to ${formatUsd(max)}, half between ${formatUsd(q1)} and ${formatUsd(q3)}, median ${formatUsd(median)}`}>
            <div className="relative h-3 rounded-full bg-surface">
              <div
                className="absolute inset-y-0 rounded-full bg-rose"
                style={{ left: `${((q1 - min) / Math.max(1, max - min)) * 100}%`, width: `${((q3 - q1) / Math.max(1, max - min)) * 100}%` }}
              />
              <div className="absolute -top-1 h-5 w-1 rounded bg-burgundy" style={{ left: `calc(${((median - min) / Math.max(1, max - min)) * 100}% - 2px)` }} />
            </div>
            <dl className="mt-4 grid grid-cols-5 text-center text-xs">
              {[["Lowest", min], ["25%", q1], ["Median", median], ["75%", q3], ["Highest", max]].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-semibold tabular-nums text-charcoal">{formatUsd(v as number)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-charcoal">Categories</h2>
          <DataTable caption="Products per subcategory" minWidth={420}>
            <thead>
              <tr>
                <Th>Subcategory</Th>
                <Th align="right">Products</Th>
                <Th align="right">Median price</Th>
                <Th align="right">Rating</Th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={`${c.category}-${c.subcategory}`} className="border-t border-line">
                  <Td>
                    {c.subcategory}
                    <span className="block text-xs text-muted">{c.category}</span>
                  </Td>
                  <Td align="right">{formatInteger(c.products)}</Td>
                  <Td align="right">{formatUsd(c.median_price)}</Td>
                  <Td align="right">{c.average_rating === null ? <Missing /> : `★ ${formatRating(c.average_rating)}`}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Card>
      </div>

      <SectionTitle title="Customer reviews" description="From the review files (Skincare products only)." />
      {reviews ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard label="Customer reviews" value={formatInteger(reviews.count)} note={`On ${b.reviewed_products} products`} icon={MessageSquareHeart} accent />
            <KpiCard label="Average review rating" value={`${formatRating(reviews.average_rating)} ★`} icon={Star} />
            <KpiCard
              label="Would recommend"
              value={reviews.recommend_rate === null ? "—" : formatPercent(reviews.recommend_rate)}
              note={`Among ${formatInteger(reviews.recommend_answered)} reviewers who answered`}
              icon={ThumbsUp}
            />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
            <ChartCard title="Rating distribution" insight={ratingInsight(reviews.ratings)} className="xl:col-span-2">
              <RatingBars buckets={reviews.ratings} />
            </ChartCard>
            <ChartCard title={reviews.granularity === "year" ? "Reviews per year" : "Reviews per month"} insight={trendInsight(reviews.trend)} className="xl:col-span-3">
              <TrendChart series={[{ key: reviews.granularity, label: reviews.granularity, points: reviews.trend }]} height={260} />
            </ChartCard>
          </div>
          <ChartCard title="Most reviewed products" className="mt-6">
            <RankedBars
              caption={`${b.brand_name}'s most reviewed products`}
              items={reviews.top_products.map((p) => ({ label: p.product_name, sublabel: "", value: p.review_count, rating: p.average_rating }))}
            />
          </ChartCard>
        </>
      ) : (
        <ScopeNote>
          {b.brand_name} has no reviews in the review files, which cover Skincare products only. Its catalogue rating
          and loves are shown above.
        </ScopeNote>
      )}

      <SectionTitle title="Most loved products" description={`The brand's ${products.length} most loved products.`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.product_id} p={p} />
        ))}
      </div>
    </>
  );
}
