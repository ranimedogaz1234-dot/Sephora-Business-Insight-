import { MessageSquareHeart, ShoppingBag, Sparkles, Star } from "lucide-react";
import { api, attempt } from "@/lib/api";
import { formatCompact, formatDate, formatInteger, formatPercent, formatRating } from "@/lib/format";
import {
  brandInsight,
  categoryInsight,
  categorySlices,
  ratingInsight,
  topProductInsight,
  trendInsight,
} from "@/lib/insights";
import { colors } from "@/lib/theme";
import { ChartCard, EmptyState, ErrorState, KpiCard, PageHeader } from "@/components/ui/Card";
import { DonutChart } from "@/components/charts/DonutChart";
import { RankedBars } from "@/components/charts/RankedBars";
import { RatingBars } from "@/components/charts/RatingBars";
import { TrendChart } from "@/components/charts/TrendChart";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [overview, categories, products, brands, ratings, monthly, yearly] = await Promise.all([
    attempt(api.overview()),
    attempt(api.categories()),
    attempt(api.topProducts(10)),
    attempt(api.topBrands(10)),
    attempt(api.ratings()),
    attempt(api.trend("month")),
    attempt(api.trend("year")),
  ]);

  const o = overview.ok ? overview.data : null;

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Business performance at a glance"
        description={
          o
            ? `${formatInteger(o.total_products)} Sephora products and ${formatCompact(o.total_reviews)} customer reviews, ${formatDate(o.first_review)} – ${formatDate(o.last_review)}.`
            : "Sephora products and customer reviews."
        }
      />

      {!overview.ok ? (
        <ErrorState message={overview.error} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total products"
            value={formatInteger(o!.total_products)}
            note={`${o!.total_categories} categories · avg. price $${o!.average_price.toFixed(0)}`}
            icon={ShoppingBag}
          />
          <KpiCard
            label="Total reviews"
            value={formatCompact(o!.total_reviews)}
            note={`On ${formatInteger(o!.reviewed_products)} ${o!.review_categories.join(", ")} products`}
            icon={MessageSquareHeart}
            accent
          />
          <KpiCard
            label="Average rating"
            value={o!.average_rating === null ? "—" : `${formatRating(o!.average_rating)} ★`}
            note={o!.five_star_share === null ? undefined : `${formatPercent(o!.five_star_share)} are five-star reviews`}
            icon={Star}
          />
          <KpiCard
            label="Total brands"
            value={formatInteger(o!.total_brands)}
            note={o!.recommend_rate === null ? undefined : `${formatPercent(o!.recommend_rate, 0)} of reviewers recommend`}
            icon={Sparkles}
          />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
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
            <DonutChart
              slices={categorySlices(categories.data)}
              centerLabel="products"
              unit="Products"
              caption="Donut chart of products per category"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Rating distribution"
          insight={ratings.ok ? ratingInsight(ratings.data) : undefined}
          className="xl:col-span-2"
        >
          {ratings.ok ? <RatingBars buckets={ratings.data} /> : <ErrorState message={ratings.error} />}
        </ChartCard>
      </div>

      <ChartCard
        title="Review activity over time"
        insight={monthly.ok ? trendInsight(monthly.data) : undefined}
        className="mt-6"
      >
        {monthly.ok && yearly.ok ? (
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
            <EmptyState />
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
            <EmptyState />
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
