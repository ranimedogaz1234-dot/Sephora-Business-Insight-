import type { Metadata } from "next";
import Link from "next/link";
import { Gem, Layers, MessageSquareHeart, Search, ShoppingBag } from "lucide-react";
import { api, attempt, type BrandRow } from "@/lib/api";
import { formatCompact, formatInteger, formatPercent, formatRating, formatUsd } from "@/lib/format";
import { BRAND_MIN_PRODUCTS, BRAND_SORTS, hrefWith, parseBrandParams, type SearchParams } from "@/lib/params";
import { colors } from "@/lib/theme";
import { ChartCard, EmptyState, ErrorState, KpiCard, PageHeader, SectionTitle } from "@/components/ui/Card";
import { FilterForm, SelectField } from "@/components/ui/Filters";
import { Pagination } from "@/components/ui/Pagination";
import { ScopeNote } from "@/components/ui/ScopeNote";
import { DataTable, Missing, Td, Th } from "@/components/ui/Table";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { RankedBars } from "@/components/charts/RankedBars";
import { ScatterPlot } from "@/components/charts/ScatterPlot";

export const metadata: Metadata = { title: "Brands" };

const PAGE_SIZE = 20;
const HEADER = {
  eyebrow: "Brands",
  title: "Brand analytics",
  description: "Compare Sephora's brands by catalogue size, price, rating, engagement and customer reviews.",
};

function ranked(rows: BrandRow[], value: (b: BrandRow) => number, sub: (b: BrandRow) => string, rating: (b: BrandRow) => number | null) {
  return rows.map((b) => ({ label: b.brand_name, sublabel: sub(b), value: value(b), rating: rating(b) }));
}

export default async function BrandsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const options = await attempt(api.filters());
  if (!options.ok) {
    return (
      <>
        <PageHeader {...HEADER} />
        <ErrorState message={options.error} />
      </>
    );
  }
  const params = parseBrandParams(await searchParams, options.data);
  const scope = { category: params.category, min_products: params.min_products };
  const [list, summary] = await Promise.all([
    attempt(api.brands({ ...params, page_size: PAGE_SIZE })),
    attempt(api.brandSummary(scope)),
  ]);
  const filtered = params.q || params.category || params.min_products;
  const s = summary.ok ? summary.data : null;

  return (
    <>
      <PageHeader {...HEADER} />

      <FilterForm action="/brands">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-muted sm:min-w-56">
          Search brands
          <span className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              key={params.q ?? ""}
              minLength={2}
              maxLength={80}
              placeholder="e.g. Clinique"
              className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm text-charcoal placeholder:text-muted hover:border-rose focus:border-burgundy focus:outline-none"
            />
          </span>
        </label>
        <SelectField label="Sells in category" name="category" value={params.category ?? ""}>
          <option value="">All categories</option>
          {options.data.categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Brand size" name="min_products" value={params.min_products ? String(params.min_products) : ""}>
          <option value="">Any size</option>
          {BRAND_MIN_PRODUCTS.map((n) => (
            <option key={n} value={n}>
              {n}+ products
            </option>
          ))}
        </SelectField>
        <SelectField label="Rank by" name="sort" value={params.sort}>
          {Object.entries(BRAND_SORTS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </SelectField>
        <button type="submit" className="h-10 rounded-xl bg-burgundy px-5 text-sm font-medium text-white hover:bg-burgundy-dark">
          Search
        </button>
        {filtered && (
          <Link href="/brands" className="h-10 rounded-xl px-3 text-sm leading-10 text-muted hover:text-burgundy">
            Clear
          </Link>
        )}
      </FilterForm>
      <ScopeNote className="mt-4">
        Products, prices, catalogue rating and loves cover every brand. Customer-review figures exist only for brands
        with Skincare products in the review files; other brands show &ldquo;—&rdquo;. A brand&apos;s catalogue rating is
        the mean of its rated products. Ranking by an average works best with a minimum brand size.
      </ScopeNote>

      {!summary.ok ? (
        <div className="mt-6">
          <ErrorState message={summary.error} />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Brands" value={formatInteger(s!.brands)} note={params.category ? `Selling ${params.category} products` : "In the catalogue"} icon={Gem} accent />
            <KpiCard label="Products per brand" value={s!.median_products === null ? "—" : formatInteger(s!.median_products)} note="Median" icon={ShoppingBag} />
            <KpiCard
              label="Top 10 brands"
              value={s!.top10_product_share === null ? "—" : formatPercent(s!.top10_product_share)}
              note="Share of the products in scope"
              icon={Layers}
            />
            <KpiCard
              label="Brands with reviews"
              value={formatInteger(s!.brands_with_reviews)}
              note="Have Skincare reviews in the review files"
              icon={MessageSquareHeart}
            />
          </div>

          {s!.brands > 0 && (
            <>
              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <ChartCard title="Largest brands" insight="Number of products in scope.">
                  <RankedBars
                    caption="Brands with the most products"
                    unit="Products"
                    items={ranked(s!.by_products, (b) => b.products, (b) => b.main_category, (b) => b.average_catalogue_rating)}
                  />
                </ChartCard>
                <ChartCard title="Most loved brands" insight="Total loves across the brand's products.">
                  <RankedBars
                    caption="Brands with the most loves"
                    unit="Loves"
                    color={colors.rose}
                    items={ranked(s!.by_loves, (b) => b.total_loves, (b) => `${b.products} products`, (b) => b.average_catalogue_rating)}
                  />
                </ChartCard>
                <ChartCard title="Most reviewed brands" insight="Customer reviews in the review files (Skincare).">
                  {s!.by_reviews.length ? (
                    <RankedBars
                      caption="Brands with the most customer reviews"
                      items={ranked(s!.by_reviews, (b) => b.review_rows, (b) => `${b.reviewed_products} reviewed products`, (b) => b.average_review_rating)}
                    />
                  ) : (
                    <EmptyState message="No brand in scope has reviews in the review files." />
                  )}
                </ChartCard>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
                <ChartCard title="Brand size" insight="Number of brands by how many products they sell." className="xl:col-span-2">
                  <ColumnChart
                    data={s!.size_distribution.map((b) => ({ label: b.label, value: b.count }))}
                    caption="Number of brands by product count"
                    unit="Brands"
                    format="integer"
                  />
                </ChartCard>
                <ChartCard
                  title="Median price and catalogue rating"
                  insight={`One point per brand with at least ${s!.scatter_min_rated} rated products (log price scale).`}
                  className="xl:col-span-3"
                >
                  {s!.price_vs_rating.length ? (
                    <ScatterPlot
                      points={s!.price_vs_rating.map((b) => ({ label: b.brand_name, x: b.median_price, y: b.average_catalogue_rating, size: b.products }))}
                      caption="Median price against average catalogue rating, one point per brand"
                      xLabel="Median price"
                      yLabel="Catalogue rating"
                      sizeLabel="Products"
                      xFormat="usd"
                      yFormat="decimal2"
                      logX
                      height={280}
                    />
                  ) : (
                    <EmptyState message="No brand in scope has enough rated products." />
                  )}
                </ChartCard>
              </div>
            </>
          )}
        </>
      )}

      <SectionTitle id="directory" title="Brand directory" description={`Ranked by ${BRAND_SORTS[params.sort].toLowerCase()}. Select a brand for its full analysis.`} />
      {!list.ok ? (
        <ErrorState message={list.error} />
      ) : list.data.total === 0 ? (
        <EmptyState message="No brands match these filters." />
      ) : (
        <>
          <DataTable caption="Brand directory" minWidth={980}>
            <thead>
              <tr>
                <Th align="right">#</Th>
                <Th>Brand</Th>
                <Th align="right">Products</Th>
                <Th align="right">Median price</Th>
                <Th align="right">Catalogue rating</Th>
                <Th align="right">Loves</Th>
                <Th align="right">Customer reviews</Th>
                <Th align="right">Recommend</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((b, i) => (
                <tr key={b.brand_id} className="border-t border-line hover:bg-blush/40">
                  <Td align="right" className="text-muted">{(params.page - 1) * PAGE_SIZE + i + 1}</Td>
                  <Td>
                    <Link href={`/brands/${b.brand_id}`} className="font-medium text-charcoal hover:text-burgundy hover:underline">
                      {b.brand_name}
                    </Link>
                    <span className="block text-xs text-muted">
                      {b.main_category}
                      {b.categories > 1 ? ` + ${b.categories - 1} more` : ""}
                    </span>
                  </Td>
                  <Td align="right">{formatInteger(b.products)}</Td>
                  <Td align="right">{b.median_price === null ? <Missing /> : formatUsd(b.median_price)}</Td>
                  <Td align="right">{b.average_catalogue_rating === null ? <Missing label="No rated products" /> : `★ ${formatRating(b.average_catalogue_rating)}`}</Td>
                  <Td align="right">{formatCompact(b.total_loves)}</Td>
                  <Td align="right">{b.review_rows ? formatCompact(b.review_rows) : <Missing label="No reviews in the review files" />}</Td>
                  <Td align="right">{b.recommend_rate === null ? <Missing label="No recommendation answers" /> : formatPercent(b.recommend_rate, 0)}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination
            page={params.page}
            totalPages={list.data.total_pages}
            total={list.data.total}
            pageSize={PAGE_SIZE}
            noun="brands"
            href={(p) => hrefWith("/brands", params, { page: p })}
          />
        </>
      )}
    </>
  );
}
