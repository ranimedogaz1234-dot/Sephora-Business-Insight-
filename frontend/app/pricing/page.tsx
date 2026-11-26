import type { Metadata } from "next";
import Link from "next/link";
import { BadgeDollarSign, Percent, Scale, Tag } from "lucide-react";
import { api, attempt, type PricedProduct, type PriceSpread } from "@/lib/api";
import { formatCompact, formatInteger, formatPercent, formatRating, formatUsd } from "@/lib/format";
import { correlationLabel, ratingIndicator } from "@/lib/insights";
import { parseDashboardParams, type SearchParams } from "@/lib/params";
import { colors } from "@/lib/theme";
import { Badge } from "@/components/ui/Badge";
import { ChartCard, EmptyState, ErrorState, KpiCard, PageHeader, SectionTitle } from "@/components/ui/Card";
import { FilterForm, SelectField } from "@/components/ui/Filters";
import { ScopeNote } from "@/components/ui/ScopeNote";
import { DataTable, Missing, Td, Th } from "@/components/ui/Table";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { RangeBars } from "@/components/charts/RangeBars";

export const metadata: Metadata = { title: "Pricing" };

const HEADER = {
  eyebrow: "Pricing",
  title: "Pricing analytics",
  description: "How Sephora's listed prices are distributed, how they compare across categories and brands, and how price relates to rating.",
};

function spreadRows(items: PriceSpread[]) {
  return items.map((c) => ({ label: c.name, value: c.median_price, low: c.p25_price, high: c.p75_price }));
}

function roundMax(items: PriceSpread[]) {
  const top = Math.max(20, ...items.map((c) => c.p75_price));
  return Math.ceil((top * 1.1) / 40) * 40;
}

function ProductTable({ items, caption }: { items: PricedProduct[]; caption: string }) {
  if (!items.length) return <EmptyState message="No product qualifies with this scope." />;
  return (
    <DataTable caption={caption} minWidth={760}>
      <thead>
        <tr>
          <Th>Product</Th>
          <Th align="right">Price</Th>
          <Th align="right">Price index</Th>
          <Th align="right">Rating</Th>
          <Th align="right">vs category</Th>
          <Th align="right">Reviews</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((p) => {
          const r = ratingIndicator(p.rating_vs_category);
          return (
            <tr key={p.product_id} className="border-t border-line hover:bg-blush/40">
              <Td>
                <Link href={`/products/${p.product_id}`} className="font-medium text-charcoal hover:text-burgundy">
                  {p.product_name}
                </Link>
                <span className="block text-xs text-muted">
                  {p.brand_name} · {p.category}
                </span>
              </Td>
              <Td align="right">{formatUsd(p.price)}</Td>
              <Td align="right">
                {p.price_index.toFixed(2)}×<span className="block text-xs text-muted">median {formatUsd(p.category_median_price)}</span>
              </Td>
              <Td align="right">{p.rating === null ? <Missing /> : `★ ${formatRating(p.rating)}`}</Td>
              <Td align="right">{r ? <Badge tone={r.tone}>{r.text}</Badge> : <Missing />}</Td>
              <Td align="right">{p.catalogue_reviews === null ? <Missing /> : formatInteger(p.catalogue_reviews)}</Td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}

export default async function PricingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await attempt(api.filters());
  const { category } = parseDashboardParams(await searchParams, filters.ok ? filters.data : null);
  const result = await attempt(api.pricing(category));
  if (!result.ok) {
    return (
      <>
        <PageHeader {...HEADER} />
        <ErrorState message={result.error} />
      </>
    );
  }
  const d = result.data;
  const ratedBands = d.bands.filter((b) => b.products > 0);

  return (
    <>
      <PageHeader {...HEADER} />
      <FilterForm action="/pricing">
        <SelectField label="Category" name="category" value={category ?? ""}>
          <option value="">All categories</option>
          {filters.ok && filters.data.categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </SelectField>
        <noscript>
          <button type="submit" className="h-10 rounded-xl bg-burgundy px-5 text-sm font-medium text-white">Apply</button>
        </noscript>
        {category && <Link href="/pricing" className="h-10 rounded-xl px-3 text-sm leading-10 text-muted hover:text-burgundy">Clear filter</Link>}
      </FilterForm>
      <ScopeNote className="mt-4">
        Listed USD prices from the catalogue. Prices are never multiplied by reviews or loves: the data has no sales,
        units or revenue. <strong>Segments</strong> are relative to each product&apos;s primary category: Budget ≤ 25th
        percentile, Mid-range ≤ 75th, Premium ≤ 90th, Luxury above. <strong>Price index</strong> = price ÷ the
        category&apos;s median price.
      </ScopeNote>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Median price" value={d.median_price === null ? "—" : formatUsd(d.median_price)} note={`${formatInteger(d.products)} products`} icon={BadgeDollarSign} accent />
        <KpiCard label="Average price" value={d.average_price === null ? "—" : formatUsd(d.average_price)} note="Pulled up by a few very expensive items" icon={Scale} />
        <KpiCard
          label="Middle 80% of prices"
          value={d.percentiles.p10 === null ? "—" : `${formatUsd(d.percentiles.p10)}–${formatUsd(d.percentiles.p90!)}`}
          note={d.min_price === null ? undefined : `Full range ${formatUsd(d.min_price)}–${formatUsd(d.max_price!)}`}
          icon={Tag}
        />
        <KpiCard
          label="On sale"
          value={formatInteger(d.sale.products)}
          note={d.sale.median_discount === null ? "No sale prices listed" : `Median discount ${formatPercent(d.sale.median_discount, 0)}`}
          icon={Percent}
        />
      </div>

      {d.products === 0 ? (
        <div className="mt-6"><EmptyState /></div>
      ) : (
        <>
          <ChartCard title="Price distribution" insight="Products per listed-price band." className="mt-6">
            <ColumnChart data={d.histogram.map((b) => ({ label: b.label, value: b.count }))} caption="Products per price band" unit="Products" format="integer" />
          </ChartCard>

          <SectionTitle title="Budget and premium segments" description="Segments compare each product with others in its own category." />
          <DataTable caption="Price segments" minWidth={820}>
            <thead>
              <tr>
                <Th>Segment</Th>
                <Th align="right">Products</Th>
                <Th align="right">Price range</Th>
                <Th align="right">Median price</Th>
                <Th align="right">Catalogue rating</Th>
                <Th align="right">Median loves</Th>
                <Th align="right">Recommend</Th>
              </tr>
            </thead>
            <tbody>
              {d.segments.map((s) => (
                <tr key={s.segment} className="border-t border-line">
                  <Td className="font-medium text-charcoal">{s.segment}</Td>
                  <Td align="right">
                    {formatInteger(s.products)} <span className="text-xs text-muted">{s.share === null ? "" : `(${formatPercent(s.share)})`}</span>
                  </Td>
                  <Td align="right">{s.min_price === null ? <Missing /> : `${formatUsd(s.min_price)}–${formatUsd(s.max_price!)}`}</Td>
                  <Td align="right">{s.median_price === null ? <Missing /> : formatUsd(s.median_price)}</Td>
                  <Td align="right">{s.average_rating === null ? <Missing /> : `★ ${formatRating(s.average_rating)}`}</Td>
                  <Td align="right">{s.median_loves === null ? <Missing /> : formatCompact(s.median_loves)}</Td>
                  <Td align="right">{s.recommend_rate === null ? <Missing label="No customer reviews" /> : formatPercent(s.recommend_rate)}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <p className="mt-2 text-xs text-muted">Price ranges overlap across categories because segments are set within each category. Recommend uses Skincare customer reviews only.</p>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard title={category ? "Price range by subcategory" : "Price range by category"} insight="Dot = median price; band = middle 50% of products.">
              <RangeBars caption="Median and interquartile price by category" rows={spreadRows(d.by_category)} domain={[0, roundMax(d.by_category)]} format="usd" valueLabel="Median price" bandLabel="Middle 50%" />
            </ChartCard>
            <ChartCard title="Price range of the largest brands" insight="The 15 brands with the most products in scope (at least 5).">
              {d.by_brand.length ? (
                <RangeBars caption="Median and interquartile price by brand" rows={spreadRows(d.by_brand)} domain={[0, roundMax(d.by_brand)]} format="usd" valueLabel="Median price" bandLabel="Middle 50%" />
              ) : (
                <EmptyState message="No brand has 5 or more products in scope." />
              )}
            </ChartCard>
          </div>

          <SectionTitle
            title="Rating against price"
            description={`Spearman rank correlation between price and catalogue rating: ${d.rating_price_correlation === null ? "—" : d.rating_price_correlation.toFixed(2)} (${correlationLabel(d.rating_price_correlation)}). Between price and loves: ${d.loves_price_correlation === null ? "—" : d.loves_price_correlation.toFixed(2)} (${correlationLabel(d.loves_price_correlation)}).`}
          />
          <div className="grid grid-cols-1 gap-6">
            <ChartCard title="Average catalogue rating by price band">
              <RangeBars
                caption="Average catalogue rating per price band"
                rows={ratedBands.map((b) => ({ label: b.label, value: b.average_rating }))}
                domain={[3.5, 5]}
                steps={3}
                format="decimal2"
                valueLabel="Average rating"
              />
            </ChartCard>
            <ChartCard title="Share of products rated 4.5 or higher, by price band">
              <ColumnChart
                data={ratedBands.map((b) => ({ label: b.label, value: b.top_rated_share, details: [{ label: "Products", value: formatInteger(b.products) }] }))}
                caption="Share of rated products with 4.5 stars or more, per price band"
                unit="Rated 4.5+"
                format="percent"
                domain={[0, 1]}
                color={colors.rose}
              />
            </ChartCard>
          </div>

          <SectionTitle title="Value indicators" description="Each product is placed by its catalogue rating against its category mean and its price against its category median." />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {d.value_positions.map((v) => (
              <div key={v.key} className={`rounded-2xl border p-4 ${v.key === "high_value" ? "border-burgundy bg-blush/50" : "border-line bg-white"}`}>
                <p className="text-2xl font-semibold tabular-nums text-charcoal">{formatInteger(v.products)}</p>
                <p className="mt-1 text-xs text-muted">{v.label}</p>
              </div>
            ))}
          </div>

          <SectionTitle title="Best-rated affordable products" description={`Budget-segment products (bottom quarter of prices in their category) with at least ${d.min_reviews_for_ranking} catalogue reviews, by rating.`} />
          <ProductTable items={d.best_affordable} caption="Best-rated affordable products" />

          <SectionTitle title="High-value products" description={`Rated above their category average and priced below its median, with at least ${d.min_reviews_for_ranking} catalogue reviews; largest rating advantage first.`} />
          <ProductTable items={d.high_value} caption="High-value products" />
        </>
      )}
    </>
  );
}
