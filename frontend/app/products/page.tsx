import type { Metadata } from "next";
import Link from "next/link";
import { BadgeDollarSign, Heart, Search, ShoppingBag, Star } from "lucide-react";
import { api, attempt, type ProductRow } from "@/lib/api";
import { formatCompact, formatInteger, formatRating, formatUsd } from "@/lib/format";
import { flagLabel, lovesIndicator, ratingIndicator } from "@/lib/insights";
import {
  MIN_RATINGS,
  MIN_REVIEWS,
  PRODUCT_SORTS,
  hrefWith,
  parseProductParams,
  productFilterQuery,
  type SearchParams,
} from "@/lib/params";
import { colors } from "@/lib/theme";
import { Badge } from "@/components/ui/Badge";
import { Card, ChartCard, EmptyState, ErrorState, KpiCard, PageHeader } from "@/components/ui/Card";
import { FilterForm, NumberField, SelectField } from "@/components/ui/Filters";
import { Pagination } from "@/components/ui/Pagination";
import { ScopeNote } from "@/components/ui/ScopeNote";
import { DataTable, Missing, Td, Th } from "@/components/ui/Table";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { RankedBars } from "@/components/charts/RankedBars";

export const metadata: Metadata = { title: "Products" };

const PAGE_SIZE = 20;
const HEADER = {
  eyebrow: "Products",
  title: "Product analytics",
  description: "Search the full Sephora catalogue and filter by brand, category, price, rating, review count and listing type.",
};

function Indicators({ p }: { p: ProductRow }) {
  const rating = ratingIndicator(p.rating_vs_category);
  const loves = lovesIndicator(p.loves_percentile);
  return (
    <div className="flex flex-col items-end gap-1">
      {rating ? <Badge tone={rating.tone}>{rating.text}</Badge> : <Missing label="No catalogue rating" />}
      {loves && <span className="text-xs text-muted">{loves}</span>}
    </div>
  );
}

function ShortList({ title, items, metric }: { title: string; items: ProductRow[]; metric: (p: ProductRow) => string }) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-charcoal">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No products qualify with these filters.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {items.map((p, i) => (
            <li key={p.product_id} className="flex items-baseline gap-3">
              <span className="w-4 shrink-0 text-right text-xs font-semibold text-muted">{i + 1}</span>
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
      )}
    </Card>
  );
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [options, productOptions] = await Promise.all([attempt(api.filters()), attempt(api.productOptions())]);
  if (!options.ok || !productOptions.ok) {
    return (
      <>
        <PageHeader {...HEADER} />
        <ErrorState message={!options.ok ? options.error : (productOptions as { error: string }).error} />
      </>
    );
  }

  const params = parseProductParams(await searchParams, options.data, productOptions.data);
  const filters = productFilterQuery(params);
  const [result, summary] = await Promise.all([
    attempt(api.products({ ...params, page_size: PAGE_SIZE })),
    attempt(api.productSummary(filters)),
  ]);
  const filtered = Object.values(filters).some((v) => v !== undefined);
  const s = summary.ok ? summary.data : null;
  const subcategories = productOptions.data.subcategories.filter((x) => !params.category || x.category === params.category);

  return (
    <>
      <PageHeader {...HEADER} />

      <FilterForm action="/products">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-muted sm:min-w-64">
          Search
          <span className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              key={params.q ?? ""}
              minLength={2}
              maxLength={80}
              placeholder="Product or brand, e.g. vitamin c"
              className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm text-charcoal placeholder:text-muted hover:border-rose focus:border-burgundy focus:outline-none"
            />
          </span>
        </label>
        <SelectField label="Category" name="category" value={params.category ?? ""}>
          <option value="">All categories</option>
          {options.data.categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({formatInteger(c.count)})
            </option>
          ))}
        </SelectField>
        <SelectField label="Subcategory" name="subcategory" value={params.subcategory ?? ""}>
          <option value="">All subcategories</option>
          {subcategories.map((c) => (
            <option key={`${c.category}-${c.name}`} value={c.name}>
              {params.category ? c.name : `${c.category} › ${c.name}`} ({formatInteger(c.count)})
            </option>
          ))}
        </SelectField>
        <SelectField label="Brand" name="brand" value={params.brand ?? ""}>
          <option value="">All brands</option>
          {productOptions.data.brands.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name} ({formatInteger(b.count)})
            </option>
          ))}
        </SelectField>
        <NumberField label="Min price" name="min_price" value={params.min_price} prefix="$" placeholder="0" />
        <NumberField label="Max price" name="max_price" value={params.max_price} prefix="$" placeholder="Any" />
        <SelectField label="Catalogue rating" name="min_rating" value={params.min_rating ? String(params.min_rating) : ""}>
          <option value="">Any rating</option>
          {MIN_RATINGS.map((r) => (
            <option key={r} value={r}>
              {r.toFixed(1)} ★ and above
            </option>
          ))}
        </SelectField>
        <SelectField label="Minimum reviews" name="min_reviews" value={params.min_reviews ? String(params.min_reviews) : ""}>
          <option value="">Any number</option>
          {MIN_REVIEWS.map((n) => (
            <option key={n} value={n}>
              {formatInteger(n)}+ reviews
            </option>
          ))}
        </SelectField>
        <SelectField label="Listing" name="flag" value={params.flag ?? ""}>
          <option value="">All listings</option>
          {productOptions.data.flags.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Sort by" name="sort" value={params.sort}>
          {Object.entries(PRODUCT_SORTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <button
          type="submit"
          className="h-10 rounded-xl bg-burgundy px-5 text-sm font-medium text-white transition-colors hover:bg-burgundy-dark"
        >
          Apply
        </button>
        {filtered && (
          <Link href="/products" className="h-10 rounded-xl px-3 text-sm leading-10 text-muted hover:text-burgundy">
            Clear all
          </Link>
        )}
      </FilterForm>
      <ScopeNote className="mt-4">
        Rating, review count and loves are Sephora&apos;s catalogue figures for each product (all categories). The
        &ldquo;vs category&rdquo; indicator compares a product&apos;s rating with the mean rating of its primary category;
        &ldquo;loves percentile&rdquo; is the share of products in its category with fewer loves.
      </ScopeNote>

      {!summary.ok ? (
        <div className="mt-6">
          <ErrorState message={summary.error} />
        </div>
      ) : s!.total > 0 ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Matching products" value={formatInteger(s!.total)} note={`${formatInteger(s!.brands)} ${s!.brands === 1 ? "brand" : "brands"} · ${s!.categories} ${s!.categories === 1 ? "category" : "categories"}`} icon={ShoppingBag} accent />
            <KpiCard
              label="Median price"
              value={s!.median_price === null ? "—" : formatUsd(s!.median_price)}
              note={s!.min_price === null ? undefined : `From ${formatUsd(s!.min_price)} to ${formatUsd(s!.max_price!)}`}
              icon={BadgeDollarSign}
            />
            <KpiCard
              label="Average catalogue rating"
              value={s!.average_rating === null ? "—" : `${formatRating(s!.average_rating)} ★`}
              note={`${formatInteger(s!.rated)} of ${formatInteger(s!.total)} products are rated`}
              icon={Star}
            />
            <KpiCard label="Loves" value={formatCompact(s!.total_loves)} note="Saves by shoppers (not purchases)" icon={Heart} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard title="Price distribution" insight="Listed USD prices of the matching products.">
              <ColumnChart
                data={s!.price_histogram.map((b) => ({ label: b.label, value: b.count }))}
                caption="Number of products per price band"
                unit="Products"
                format="integer"
              />
            </ChartCard>
            <ChartCard title="Catalogue rating distribution" insight="Products per band of Sephora's catalogue rating.">
              <ColumnChart
                data={s!.rating_histogram.map((b, i, all) => ({
                  label: b.label,
                  value: b.count,
                  color: i === all.length - 1 ? colors.other : undefined,
                }))}
                caption="Number of products per catalogue rating band"
                unit="Products"
                format="integer"
              />
            </ChartCard>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <ChartCard title="Brands with the most matching products" className="xl:col-span-1">
              <RankedBars
                caption="Brands with the most matching products"
                unit="Products"
                color={colors.rose}
                items={s!.top_brands.map((b) => ({
                  label: b.brand_name,
                  sublabel: `${formatCompact(b.loves)} loves`,
                  value: b.products,
                  rating: b.average_rating,
                }))}
              />
            </ChartCard>
            <ShortList
              title={`Best rated (${s!.min_reviews_for_ranking}+ reviews)`}
              items={s!.best_rated}
              metric={(p) => `★ ${formatRating(p.rating!)}`}
            />
            <ShortList title="Most loved" items={s!.most_loved} metric={(p) => formatCompact(p.loves)} />
          </div>
        </>
      ) : null}

      <section aria-labelledby="results" className="mt-10">
        <h2 id="results" className="mb-3 text-sm text-muted">
          {result.ok ? (
            <>
              <span className="font-semibold text-charcoal">{formatInteger(result.data.total)}</span>{" "}
              {result.data.total === 1 ? "product" : "products"}
              {filtered ? " found" : ""} · sorted by {PRODUCT_SORTS[params.sort].toLowerCase()}
            </>
          ) : (
            "Products"
          )}
        </h2>

        {!result.ok ? (
          <ErrorState message={result.error} />
        ) : result.data.total === 0 ? (
          <EmptyState message="No products match these filters. Try widening the price range or removing a filter." />
        ) : (
          <>
            <DataTable caption="Products matching the filters" minWidth={900}>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Category</Th>
                  <Th align="right">Price</Th>
                  <Th align="right">Rating</Th>
                  <Th align="right">Reviews</Th>
                  <Th align="right">Loves</Th>
                  <Th align="right">Performance</Th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((p) => (
                  <tr key={p.product_id} className="border-t border-line align-top transition-colors hover:bg-blush/40">
                    <Td>
                      <Link href={`/products/${p.product_id}`} className="font-medium text-charcoal hover:text-burgundy hover:underline">
                        {p.product_name}
                      </Link>
                      <p className="text-xs text-muted">{p.brand_name}</p>
                      {p.flags.length > 0 && (
                        <p className="mt-1.5 flex flex-wrap gap-1">
                          {p.flags.map((f) => (
                            <Badge key={f} tone={f === "out_of_stock" ? "warning" : "brand"}>
                              {flagLabel(f)}
                            </Badge>
                          ))}
                        </p>
                      )}
                    </Td>
                    <Td className="text-muted">
                      {p.category}
                      <span className="block text-xs">{p.subcategory}</span>
                    </Td>
                    <Td align="right">
                      {p.sale_price !== null ? (
                        <>
                          {formatUsd(p.sale_price)}
                          <span className="block text-xs text-muted line-through">
                            <span className="sr-only">was </span>
                            {formatUsd(p.price)}
                          </span>
                        </>
                      ) : (
                        formatUsd(p.price)
                      )}
                    </Td>
                    <Td align="right">{p.rating === null ? <Missing label="No catalogue rating" /> : `★ ${formatRating(p.rating)}`}</Td>
                    <Td align="right">
                      {p.catalogue_reviews === null ? <Missing label="No catalogue review count" /> : formatInteger(p.catalogue_reviews)}
                    </Td>
                    <Td align="right">{formatInteger(p.loves)}</Td>
                    <Td align="right">
                      <Indicators p={p} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <Pagination
              page={params.page}
              totalPages={result.data.total_pages}
              total={result.data.total}
              pageSize={PAGE_SIZE}
              noun="products"
              href={(p) => hrefWith("/products", params, { page: p })}
            />
          </>
        )}
      </section>
    </>
  );
}
