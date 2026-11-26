import type { Metadata } from "next";
import Link from "next/link";
import { BadgeDollarSign, ChevronRight, FolderTree, Heart, Star } from "lucide-react";
import { api, attempt, type CategoryNode, type ProductRow } from "@/lib/api";
import { formatCompact, formatInteger, formatPercent, formatRating, formatUsd } from "@/lib/format";
import { CATEGORY_METRICS, hrefWith, parseCategoryParams, type CategoryMetric, type SearchParams } from "@/lib/params";
import { colors } from "@/lib/theme";
import { Card, ChartCard, EmptyState, ErrorState, KpiCard, PageHeader, SectionTitle } from "@/components/ui/Card";
import { SegmentedLinks } from "@/components/ui/Segmented";
import { ScopeNote } from "@/components/ui/ScopeNote";
import { DataTable, Missing, Td, Th } from "@/components/ui/Table";
import { RangeBars } from "@/components/charts/RangeBars";
import { RankedBars } from "@/components/charts/RankedBars";

export const metadata: Metadata = { title: "Categories" };

const LEVEL_NAME = { primary_category: "categories", secondary_category: "subcategories", tertiary_category: "product types" } as const;
const LEVEL_SINGULAR = { primary_category: "category", secondary_category: "subcategory", tertiary_category: "product type" } as const;

function metricValue(c: CategoryNode, m: CategoryMetric): number | null {
  return c[m];
}

function ProductList({ title, items, metric }: { title: string; items: ProductRow[]; metric: (p: ProductRow) => string }) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-charcoal">{title}</h2>
      {items.length ? (
        <ol className="mt-4 space-y-2.5">
          {items.map((p, i) => (
            <li key={p.product_id} className="flex items-baseline gap-3">
              <span className="w-5 shrink-0 text-right text-xs font-semibold text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <Link href={`/products/${p.product_id}`} className="block truncate text-sm font-medium text-charcoal hover:text-burgundy" title={p.product_name}>
                  {p.product_name}
                </Link>
                <span className="text-xs text-muted">{p.brand_name}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-charcoal">{metric(p)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted">No product qualifies in this category.</p>
      )}
    </Card>
  );
}

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const options = await attempt(api.productOptions());
  const paths: Record<string, string[]> | null = options.ok
    ? options.data.subcategories.reduce<Record<string, string[]>>((acc, s) => ((acc[s.category] ??= []).push(s.name), acc), {})
    : null;
  const params = parseCategoryParams(await searchParams, paths);
  const result = await attempt(api.categoryAnalytics({ primary: params.primary, secondary: params.secondary }));

  const header = (
    <PageHeader
      eyebrow="Categories"
      title={params.secondary ?? params.primary ?? "Category analytics"}
      description="Drill down from primary categories to subcategories and product types. Compare size, price, rating and engagement."
    />
  );
  if (!result.ok) {
    return (
      <>
        {header}
        <ErrorState message={result.error} />
      </>
    );
  }
  const d = result.data;
  const childNoun = LEVEL_NAME[d.level];
  const sorted = [...d.children].sort((a, b) => (metricValue(b, params.sort) ?? -1) - (metricValue(a, params.sort) ?? -1));
  const maxP75 = Math.max(10, ...d.children.map((c) => c.p75_price ?? 0));
  // A multiple of 40, so the four scale steps are round dollar amounts.
  const priceMax = Math.ceil((maxP75 * 1.1) / 40) * 40;
  const ratings = d.children.map((c) => c.average_catalogue_rating).filter((x): x is number => x !== null);
  const ratingMin = Math.min(3.5, Math.floor((Math.min(...ratings, 5) - 0.1) * 2) / 2);
  const drill = (c: CategoryNode) =>
    d.level === "primary_category" ? hrefWith("/categories", {}, { primary: c.name }) : hrefWith("/categories", {}, { primary: params.primary, secondary: c.name });

  return (
    <>
      {header}

      <nav aria-label="Category path" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            {d.path.length ? (
              <Link href="/categories" className="text-burgundy hover:underline">
                All categories
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-charcoal">All categories</span>
            )}
          </li>
          {d.path.map((name, i) => (
            <li key={name} className="flex items-center gap-1.5">
              <ChevronRight aria-hidden className="h-4 w-4 text-muted" />
              {i < d.path.length - 1 ? (
                <Link href={hrefWith("/categories", {}, { primary: name })} className="text-burgundy hover:underline">
                  {name}
                </Link>
              ) : (
                <span aria-current="page" className="font-medium text-charcoal">{name}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Products" value={formatInteger(d.totals.products)} note={`${d.totals.children} ${childNoun} · ${formatInteger(d.totals.brands)} brands`} icon={FolderTree} accent />
        <KpiCard label="Median price" value={d.totals.median_price === null ? "—" : formatUsd(d.totals.median_price)} note="Listed USD prices" icon={BadgeDollarSign} />
        <KpiCard
          label="Catalogue rating"
          value={d.totals.average_catalogue_rating === null ? "—" : `${formatRating(d.totals.average_catalogue_rating)} ★`}
          note="Mean of Sephora's product ratings"
          icon={Star}
        />
        <KpiCard
          label="Median loves per product"
          value={d.totals.median_loves === null ? "—" : formatCompact(d.totals.median_loves)}
          note={d.totals.review_rows ? `${formatCompact(d.totals.review_rows)} customer reviews in the review files` : "No customer reviews in the review files"}
          icon={Heart}
        />
      </div>
      <ScopeNote className="mt-4">
        Popularity is measured with engagement, not sales: <strong>median loves per product</strong> (saves on Sephora&apos;s
        site; the median is not distorted by a few hit products) and <strong>catalogue reviews per product</strong>
        (Sephora&apos;s own review counts). Customer reviews from the review files exist for Skincare only.
      </ScopeNote>

      {d.children.length === 0 ? (
        <div className="mt-6">
          <EmptyState message="This category has no further subdivisions." />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard title={`Products per ${LEVEL_SINGULAR[d.level]}`} insight={`Share of the ${formatInteger(d.totals.products)} products in scope.`}>
              <RankedBars
                caption={`Products per ${childNoun}`}
                unit="Products"
                items={d.children.map((c) => ({ label: c.name, sublabel: c.share === null ? "" : formatPercent(c.share), value: c.products, rating: c.average_catalogue_rating }))}
              />
            </ChartCard>
            <ChartCard title="Popularity: median loves per product" insight="Higher means a typical product in the group is saved more often.">
              <RankedBars
                caption={`Median loves per product, by ${childNoun}`}
                unit="Median loves"
                color={colors.rose}
                items={[...d.children]
                  .sort((a, b) => (b.median_loves ?? 0) - (a.median_loves ?? 0))
                  .map((c) => ({ label: c.name, sublabel: `${formatInteger(c.products)} products`, value: c.median_loves ?? 0, rating: c.average_catalogue_rating }))}
              />
            </ChartCard>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard title="Price comparison" insight="Dot = median price; band = middle half of products (25th–75th percentile).">
              <RangeBars
                caption={`Median and interquartile price range by ${childNoun}`}
                rows={[...d.children].sort((a, b) => (b.median_price ?? 0) - (a.median_price ?? 0)).map((c) => ({ label: c.name, value: c.median_price, low: c.p25_price, high: c.p75_price }))}
                domain={[0, priceMax]}
                format="usd"
                valueLabel="Median price"
                bandLabel="Middle 50% of prices"
              />
            </ChartCard>
            <ChartCard title="Rating comparison" insight={`Mean catalogue rating; the scale starts at ${ratingMin.toFixed(1)} to show differences.`}>
              <RangeBars
                caption={`Mean catalogue rating by ${childNoun}`}
                rows={[...d.children].sort((a, b) => (b.average_catalogue_rating ?? 0) - (a.average_catalogue_rating ?? 0)).map((c) => ({ label: c.name, value: c.average_catalogue_rating }))}
                domain={[ratingMin, 5]}
                steps={Math.round((5 - ratingMin) / 0.5)}
                format="decimal2"
                valueLabel="Catalogue rating"
              />
            </ChartCard>
          </div>

          <SectionTitle
            title={`Compare ${childNoun}`}
            description={d.children.some((c) => c.can_drill) ? "Select a name to drill down." : "This is the most detailed level in the catalogue."}
          />
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-muted">Sort by</span>
            <SegmentedLinks
              label="Sort categories"
              options={CATEGORY_METRICS}
              active={params.sort}
              href={(v) => hrefWith("/categories", {}, { primary: params.primary, secondary: params.secondary, sort: v === "products" ? undefined : v })}
            />
          </div>
          <DataTable caption={`Comparison of ${childNoun}`} minWidth={1040}>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th align="right">Products</Th>
                <Th align="right">Brands</Th>
                <Th align="right">Median price</Th>
                <Th align="right">Rating</Th>
                <Th align="right">Median loves</Th>
                <Th align="right">Cat. reviews / product</Th>
                <Th align="right">Customer reviews</Th>
                <Th align="right">Recommend</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.name} className="border-t border-line hover:bg-blush/40">
                  <Td>
                    {c.can_drill ? (
                      <Link href={drill(c)} className="inline-flex items-center gap-1 font-medium text-charcoal hover:text-burgundy">
                        {c.name} <ChevronRight aria-hidden className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <span className="font-medium text-charcoal">{c.name}</span>
                    )}
                    <span className="block text-xs text-muted">{c.share === null ? "" : `${formatPercent(c.share)} of products`}</span>
                  </Td>
                  <Td align="right">{formatInteger(c.products)}</Td>
                  <Td align="right">{formatInteger(c.brands)}</Td>
                  <Td align="right">{c.median_price === null ? <Missing /> : formatUsd(c.median_price)}</Td>
                  <Td align="right">{c.average_catalogue_rating === null ? <Missing label="No rated products" /> : `★ ${formatRating(c.average_catalogue_rating)}`}</Td>
                  <Td align="right">{c.median_loves === null ? <Missing /> : formatCompact(c.median_loves)}</Td>
                  <Td align="right">{c.catalogue_reviews_per_product === null ? <Missing /> : formatInteger(Math.round(c.catalogue_reviews_per_product))}</Td>
                  <Td align="right">{c.review_rows ? formatCompact(c.review_rows) : <Missing label="No customer reviews in the review files" />}</Td>
                  <Td align="right">{c.recommend_rate === null ? <Missing label="No recommendation answers" /> : formatPercent(c.recommend_rate, 0)}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </>
      )}

      <SectionTitle title="Product rankings in this category" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProductList title="Most loved" items={d.most_loved} metric={(p) => formatCompact(p.loves)} />
        <ProductList title={`Best rated (${d.min_reviews_for_ranking}+ reviews)`} items={d.best_rated} metric={(p) => `★ ${formatRating(p.rating!)}`} />
      </div>
    </>
  );
}
