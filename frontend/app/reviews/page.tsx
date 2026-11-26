import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareHeart, Star, ThumbsUp } from "lucide-react";
import { api, attempt } from "@/lib/api";
import { formatCompact, formatInteger, formatPercent, formatRating } from "@/lib/format";
import { ratingSlices, topProductInsight, trendInsight } from "@/lib/insights";
import { REVIEW_SORTS, hrefWith, parseReviewParams, type SearchParams } from "@/lib/params";
import { ChartCard, EmptyState, ErrorState, KpiCard, PageHeader } from "@/components/ui/Card";
import { FilterForm, SelectField } from "@/components/ui/Filters";
import { Pagination } from "@/components/ui/Pagination";
import { SegmentedLinks } from "@/components/ui/Segmented";
import { ReviewCard } from "@/components/ui/ReviewCard";
import { ScopeNote } from "@/components/ui/ScopeNote";
import { DonutChart } from "@/components/charts/DonutChart";
import { RankedBars } from "@/components/charts/RankedBars";
import { TrendChart } from "@/components/charts/TrendChart";

export const metadata: Metadata = { title: "Reviews" };

const PAGE_SIZE = 6;
const HEADER = {
  eyebrow: "Reviews",
  title: "What customers say",
  description: "Explore ratings, review activity and real customer reviews. Filter by category, year or star rating.",
};

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const options = await attempt(api.filters());
  if (!options.ok) {
    return (
      <>
        <PageHeader {...HEADER} />
        <ErrorState message={options.error} />
      </>
    );
  }

  const params = parseReviewParams(await searchParams, options.data);
  const filters = { subcategory: params.subcategory, year: params.year, rating: params.rating };
  const [summary, list] = await Promise.all([
    attempt(api.reviewSummary(filters)),
    attempt(api.reviews({ ...filters, sort: params.sort, page: params.page, page_size: PAGE_SIZE })),
  ]);
  const filtered = params.subcategory || params.year || params.rating;
  const s = summary.ok ? summary.data : null;

  return (
    <>
      <PageHeader {...HEADER} />

      <FilterForm action="/reviews">
        <SelectField label="Category" name="subcategory" value={params.subcategory ?? ""}>
          <option value="">All categories</option>
          {options.data.review_subcategories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({formatCompact(c.count)})
            </option>
          ))}
        </SelectField>
        <SelectField label="Year" name="year" value={params.year ? String(params.year) : ""}>
          <option value="">All years</option>
          {[...options.data.review_years].reverse().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </SelectField>
        <SelectField label="Rating" name="rating" value={params.rating ? String(params.rating) : ""}>
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} star{r === 1 ? "" : "s"}
            </option>
          ))}
        </SelectField>
        <input type="hidden" name="sort" value={params.sort === "recent" ? "" : params.sort} />
        <noscript>
          <button type="submit" className="h-10 rounded-xl bg-burgundy px-5 text-sm font-medium text-white">
            Apply
          </button>
        </noscript>
        {filtered && (
          <Link href="/reviews" className="h-10 rounded-xl px-3 text-sm leading-10 text-muted hover:text-burgundy">
            Clear filters
          </Link>
        )}
      </FilterForm>
      <ScopeNote className="mt-4">
        Customer reviews in this dataset cover Skincare products only. Ratings are the stars each reviewer gave.
      </ScopeNote>

      {!summary.ok ? (
        <div className="mt-6">
          <ErrorState message={summary.error} />
        </div>
      ) : s!.total_reviews === 0 ? (
        <div className="mt-6">
          <EmptyState message="No reviews match these filters." />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              label="Reviews"
              value={formatInteger(s!.total_reviews)}
              note={`On ${formatInteger(s!.reviewed_products)} products`}
              icon={MessageSquareHeart}
              accent
            />
            <KpiCard
              label="Average rating"
              value={s!.average_rating === null ? "—" : `${formatRating(s!.average_rating)} ★`}
              icon={Star}
            />
            <KpiCard
              label="Would recommend"
              value={s!.recommend_rate === null ? "—" : formatPercent(s!.recommend_rate, 0)}
              note="Among reviewers who answered"
              icon={ThumbsUp}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
            <ChartCard title="Star ratings" className="xl:col-span-2">
              <DonutChart
                slices={ratingSlices(s!.ratings)}
                centerLabel="reviews"
                unit="Reviews"
                caption="Donut chart of reviews per star rating"
              />
            </ChartCard>
            <ChartCard
              title={s!.granularity === "month" ? `Reviews per month in ${params.year}` : "Reviews per year"}
              insight={trendInsight(s!.trend)}
              className="xl:col-span-3"
            >
              <TrendChart series={[{ key: s!.granularity, label: s!.granularity, points: s!.trend }]} height={250} />
            </ChartCard>
          </div>

          <ChartCard title="Most reviewed products" insight={topProductInsight(s!.top_products)} className="mt-6">
            <RankedBars
              caption="Most reviewed products for the selected filters"
              items={s!.top_products.map((p) => ({
                label: p.product_name,
                sublabel: p.brand_name,
                value: p.review_count,
                rating: p.average_rating,
              }))}
            />
          </ChartCard>
        </>
      )}

      <section aria-labelledby="latest" className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 id="latest" className="font-display text-2xl text-charcoal">
            Customer reviews
          </h2>
          <SegmentedLinks
            label="Sort reviews"
            options={REVIEW_SORTS}
            active={params.sort}
            href={(value) => hrefWith("/reviews", params, { sort: value === "recent" ? undefined : value, page: 1 })}
          />
        </div>
        {!list.ok ? (
          <ErrorState message={list.error} />
        ) : list.data.total === 0 ? (
          <EmptyState message="No reviews match these filters." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.data.items.map((r, i) => (
                <ReviewCard key={`${r.product_id}-${r.date}-${i}`} r={r} product={{ id: r.product_id, name: r.product_name, brand: r.brand_name }} />
              ))}
            </div>
            <Pagination
              page={params.page}
              totalPages={list.data.total_pages}
              total={list.data.total}
              pageSize={PAGE_SIZE}
              noun="reviews"
              href={(p) => hrefWith("/reviews", params, { sort: params.sort === "recent" ? undefined : params.sort, page: p })}
            />
          </>
        )}
      </section>
    </>
  );
}
