import Link from "next/link";
import { BadgeDollarSign, Heart, MessageSquareHeart, ShoppingBag, Sparkles, Star, ThumbsUp, Tags } from "lucide-react";
import { api, attempt, type CategoryPerformance } from "@/lib/api";
import { formatCompact, formatDate, formatInteger, formatPercent, formatRating, formatUsd } from "@/lib/format";
import {
  brandInsight,
  categoryInsight,
  categorySlices,
  ratingInsight,
  recommendationColumns,
  recommendationInsight,
  topProductInsight,
  trendInsight,
} from "@/lib/insights";
import { hrefWith, parseDashboardParams, type SearchParams } from "@/lib/params";
import { colors } from "@/lib/theme";
import { ChartCard, EmptyState, ErrorState, KpiCard, PageHeader, SectionTitle } from "@/components/ui/Card";
import { FilterForm, SelectField } from "@/components/ui/Filters";
import { ObservationList } from "@/components/ui/Observations";
import { ScopeNote } from "@/components/ui/ScopeNote";
import { DataTable, Missing, Td, Th } from "@/components/ui/Table";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { RankedBars } from "@/components/charts/RankedBars";
import { RatingBars } from "@/components/charts/RatingBars";
import { TrendChart } from "@/components/charts/TrendChart";

export const dynamic = "force-dynamic";

function CategoryTable({ rows }: { rows: CategoryPerformance[] }) {
  const maxShare = Math.max(...rows.map((r) => r.share));
  return (
    <DataTable caption="Performance by primary category" minWidth={860}>
      <thead>
        <tr>
          <Th>Category</Th>
          <Th align="right">Products</Th>
          <Th align="right">Brands</Th>
          <Th align="right">Median price</Th>
          <Th align="right">Catalogue rating</Th>
          <Th align="right">Median loves</Th>
          <Th align="right">Customer reviews</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.category} className="border-t border-line hover:bg-blush/40">
            <Td>
              <Link href={hrefWith("/", {}, { category: r.category })} className="font-medium text-charcoal hover:text-burgundy">
                {r.category}
              </Link>
              <span aria-hidden className="mt-1.5 block h-1.5 rounded-full bg-surface">
                <span className="block h-full rounded-full bg-burgundy" style={{ width: `${(r.share / maxShare) * 100}%` }} />
              </span>
            </Td>
            <Td align="right">
              {formatInteger(r.products)} <span className="text-xs text-muted">({formatPercent(r.share)})</span>
            </Td>
            <Td align="right">{formatInteger(r.brands)}</Td>
            <Td align="right">{r.median_price === null ? <Missing /> : formatUsd(r.median_price)}</Td>
            <Td align="right">
              {r.average_catalogue_rating === null ? <Missing label="No rated products" /> : `★ ${formatRating(r.average_catalogue_rating)}`}
            </Td>
            <Td align="right">{r.median_loves === null ? <Missing /> : formatCompact(r.median_loves)}</Td>
            <Td align="right">{r.review_rows ? formatCompact(r.review_rows) : <Missing label="No customer reviews in the dataset" />}</Td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await attempt(api.filters());
  const { category } = parseDashboardParams(await searchParams, filters.ok ? filters.data : null);

  const [overview, categories, products, brands, ratings, monthly, yearly, perf, recs, obs] = await Promise.all([
    attempt(api.overview(category)),
    attempt(api.categories()),
    attempt(api.topProducts(10, category)),
    attempt(api.topBrands(10, category)),
    attempt(api.ratings(category)),
    attempt(api.trend("month", category)),
    attempt(api.trend("year", category)),
    attempt(api.categoryPerformance()),
    attempt(api.recommendations(category)),
    attempt(api.observations(category)),
  ]);

  const o = overview.ok ? overview.data : null;
  const hasReviews = (o?.total_reviews ?? 0) > 0;
  const scope = category ? `${category} products` : "Sephora products";
  const noReviews = (
    <EmptyState
      message={`The review files contain no ${category ?? ""} reviews: customer reviews cover ${o?.review_categories.length ? o.review_categories.join(", ") : "Skincare"} products only.`}
    />
  );

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Business performance at a glance"
        description={
          o
            ? hasReviews
              ? `${formatInteger(o.total_products)} ${scope} and ${formatCompact(o.total_reviews)} customer reviews, ${formatDate(o.first_review)} – ${formatDate(o.last_review)}.`
              : `${formatInteger(o.total_products)} ${scope}. No customer reviews in the dataset for this category.`
            : "Sephora products and customer reviews."
        }
      />

      <FilterForm action="/">
        <SelectField label="Category" name="category" value={category ?? ""}>
          <option value="">All categories</option>
          {filters.ok &&
            filters.data.categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({formatInteger(c.count)})
              </option>
            ))}
        </SelectField>
        <noscript>
          <button type="submit" className="h-10 rounded-xl bg-burgundy px-5 text-sm font-medium text-white">
            Apply
          </button>
        </noscript>
        {category && (
          <Link href="/" className="h-10 rounded-xl px-3 text-sm leading-10 text-muted hover:text-burgundy">
            Clear filter
          </Link>
        )}
      </FilterForm>
      <ScopeNote className="mt-4">
        Catalogue figures (products, brands, prices, catalogue rating, loves) cover every category. Customer-review
        figures come from the review files, which cover Skincare only. Loves are saves on Sephora&apos;s site, not sales.
      </ScopeNote>

      {!overview.ok ? (
        <div className="mt-6">
          <ErrorState message={overview.error} />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Products"
            value={formatInteger(o!.total_products)}
            note={category ? `${formatInteger(o!.total_brands)} brands` : `${o!.total_categories} categories · ${formatInteger(o!.total_brands)} brands`}
            icon={ShoppingBag}
            href={hrefWith("/products", {}, { category })}
          />
          <KpiCard
            label="Customer reviews"
            value={hasReviews ? formatCompact(o!.total_reviews) : "—"}
            note={hasReviews ? `On ${formatInteger(o!.reviewed_products)} ${o!.review_categories.join(", ")} products` : "No reviews for this category"}
            icon={MessageSquareHeart}
            accent
            href={hasReviews ? "/reviews" : undefined}
          />
          <KpiCard
            label="Average review rating"
            value={o!.average_rating === null ? "—" : `${formatRating(o!.average_rating)} ★`}
            note={o!.five_star_share === null ? "No reviews for this category" : `${formatPercent(o!.five_star_share)} are five-star reviews`}
            icon={Star}
          />
          <KpiCard
            label="Recommendation rate"
            value={o!.recommend_rate === null ? "—" : formatPercent(o!.recommend_rate)}
            note={o!.recommend_rate === null ? "No reviews for this category" : `Among ${formatCompact(o!.recommend_answered)} reviewers who answered`}
            icon={ThumbsUp}
          />
          <KpiCard
            label="Brands"
            value={formatInteger(o!.total_brands)}
            note={`Selling ${formatInteger(o!.total_products)} products`}
            icon={Sparkles}
          />
          <KpiCard
            label="Median price"
            value={o!.median_price === null ? "—" : formatUsd(o!.median_price)}
            note={o!.average_price === null ? undefined : `Average ${formatUsd(o!.average_price)} (listed USD prices)`}
            icon={BadgeDollarSign}
          />
          <KpiCard
            label="Catalogue rating"
            value={o!.average_catalogue_rating === null ? "—" : `${formatRating(o!.average_catalogue_rating)} ★`}
            note="Mean of Sephora's product ratings"
            icon={Tags}
          />
          <KpiCard
            label="Loves"
            value={formatCompact(o!.total_loves)}
            note="Times products were saved by shoppers"
            icon={Heart}
          />
        </div>
      )}

      <SectionTitle title="Key observations" description="Computed from the data on every load; each one states the figures behind it." />
      {obs.ok ? obs.data.length ? <ObservationList items={obs.data} /> : <EmptyState /> : <ErrorState message={obs.error} />}

      {!category && (
        <>
          <SectionTitle
            title="Category performance"
            description="Size, price, Sephora's catalogue rating and engagement for each primary category. Select a category to focus the dashboard on it."
          />
          {perf.ok ? <CategoryTable rows={perf.data} /> : <ErrorState message={perf.error} />}
        </>
      )}

      <div className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-5">
        {!category && (
          <ChartCard
            title="Products by category"
            insight={categories.ok ? categoryInsight(categories.data) : undefined}
            className="xl:col-span-3"
          >
            {!categories.ok ? (
              <ErrorState message={categories.error} />
            ) : categories.data.length === 0 ? (
              <EmptyState />
            ) : (
              <DonutChart slices={categorySlices(categories.data)} centerLabel="products" unit="Products" caption="Donut chart of products per category" />
            )}
          </ChartCard>
        )}

        <ChartCard
          title="Rating distribution"
          insight={ratings.ok && hasReviews ? ratingInsight(ratings.data) : undefined}
          className={category ? "xl:col-span-3" : "xl:col-span-2"}
        >
          {!ratings.ok ? <ErrorState message={ratings.error} /> : hasReviews ? <RatingBars buckets={ratings.data} /> : noReviews}
        </ChartCard>

        {category && (
          <ChartCard title="Recommendation rate by star rating" className="xl:col-span-2">
            {!recs.ok ? <ErrorState message={recs.error} /> : hasReviews ? (
              <ColumnChart data={recommendationColumns(recs.data)} caption="Recommendation rate by star rating" unit="Recommend" format="percent" domain={[0, 1]} />
            ) : noReviews}
          </ChartCard>
        )}
      </div>

      {!category && (
        <ChartCard
          title="Recommendation rate by star rating"
          insight={recs.ok ? recommendationInsight(recs.data) : undefined}
          className="mt-6"
        >
          {!recs.ok ? (
            <ErrorState message={recs.error} />
          ) : (
            <ColumnChart
              data={recommendationColumns(recs.data)}
              caption="Share of reviewers who recommend the product, by star rating"
              unit="Recommend"
              format="percent"
              domain={[0, 1]}
            />
          )}
        </ChartCard>
      )}

      <ChartCard
        title="Review activity over time"
        insight={monthly.ok && hasReviews ? trendInsight(monthly.data) : undefined}
        className="mt-6"
      >
        {!hasReviews && overview.ok ? (
          noReviews
        ) : monthly.ok && yearly.ok ? (
          <TrendChart
            series={[
              { key: "month", label: "Monthly", points: monthly.data },
              { key: "year", label: "Yearly", points: yearly.data },
            ]}
          />
        ) : (
          <ErrorState message={monthly.ok ? (yearly as { error: string }).error : monthly.error} />
        )}
      </ChartCard>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Top 10 most reviewed products" insight={products.ok ? topProductInsight(products.data) : undefined}>
          {!products.ok ? (
            <ErrorState message={products.error} />
          ) : products.data.length === 0 ? (
            noReviews
          ) : (
            <RankedBars
              caption="Top 10 most reviewed products"
              items={products.data.map((p) => ({
                label: p.product_name,
                sublabel: p.brand_name,
                value: p.review_count,
                rating: p.average_rating,
              }))}
            />
          )}
        </ChartCard>

        <ChartCard title="Top brands by reviews" insight={brands.ok ? brandInsight(brands.data) : undefined}>
          {!brands.ok ? (
            <ErrorState message={brands.error} />
          ) : brands.data.length === 0 ? (
            noReviews
          ) : (
            <RankedBars
              caption="Top 10 brands by number of reviews"
              color={colors.rose}
              items={brands.data.map((b) => ({
                label: b.brand_name,
                sublabel: `${b.products} reviewed products`,
                value: b.review_count,
                rating: b.average_rating,
              }))}
            />
          )}
        </ChartCard>
      </div>
    </>
  );
}
