import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareHeart, Search, Star, ThumbsUp, X } from "lucide-react";
import { api, attempt } from "@/lib/api";
import { formatCompact, formatInteger, formatPercent, formatRating } from "@/lib/format";
import { ratingSlices, topProductInsight, trendInsight } from "@/lib/insights";
import { RECOMMENDED, REVIEW_SORTS, hrefWith, parseReviewParams, reviewFilterQuery, type SearchParams } from "@/lib/params";
import { colors, starRamp } from "@/lib/theme";
import { Card, ChartCard, EmptyState, ErrorState, KpiCard, PageHeader, SectionTitle } from "@/components/ui/Card";
import { FilterForm, SelectField } from "@/components/ui/Filters";
import { Pagination } from "@/components/ui/Pagination";
import { ReviewCard } from "@/components/ui/ReviewCard";
import { ScopeNote } from "@/components/ui/ScopeNote";
import { SegmentedLinks } from "@/components/ui/Segmented";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { RankedBars } from "@/components/charts/RankedBars";
import { TrendChart } from "@/components/charts/TrendChart";

export const metadata: Metadata = { title: "Reviews" };

const PAGE_SIZE = 9;
const HEADER = {
  eyebrow: "Reviews",
  title: "What customers say",
  description: "Search and filter more than a million Skincare reviews, see how they rate and recommend, and read the reviews themselves.",
};

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [options, extra] = await Promise.all([attempt(api.filters()), attempt(api.reviewOptions())]);
  if (!options.ok) {
    return (
      <>
        <PageHeader {...HEADER} />
        <ErrorState message={options.error} />
      </>
    );
  }
  const params = parseReviewParams(await searchParams, options.data, extra.ok ? extra.data : null);
  const filters = reviewFilterQuery(params);
  const [summary, list] = await Promise.all([
    attempt(api.reviewSummary(filters)),
    attempt(api.reviews({ ...filters, sort: params.sort, page: params.page, page_size: PAGE_SIZE })),
  ]);
  const filtered = Object.values(filters).some((v) => v !== undefined);
  const s = summary.ok ? summary.data : null;
  const keep = (changes: Record<string, string | number | undefined>) =>
    hrefWith("/reviews", { ...params, sort: params.sort === "recent" ? undefined : params.sort }, changes);

  return (
    <>
      <PageHeader {...HEADER} />

      <FilterForm action="/reviews">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-muted sm:min-w-64">
          Search review text
          <span className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              key={params.q ?? ""}
              minLength={3}
              maxLength={60}
              placeholder="Words or a phrase, e.g. broke me out"
              className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm text-charcoal placeholder:text-muted hover:border-rose focus:border-burgundy focus:outline-none"
            />
          </span>
        </label>
        <SelectField label="Category" name="subcategory" value={params.subcategory ?? ""}>
          <option value="">All categories</option>
          {options.data.review_subcategories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({formatCompact(c.count)})
            </option>
          ))}
        </SelectField>
        <SelectField label="Brand" name="brand" value={params.brand ?? ""}>
          <option value="">All brands</option>
          {extra.ok && extra.data.brands.map((b) => <option key={b} value={b}>{b}</option>)}
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
        <SelectField label="Recommendation" name="recommended" value={params.recommended ?? ""}>
          <option value="">Any answer</option>
          {Object.entries(RECOMMENDED).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Skin type" name="skin_type" value={params.skin_type ?? ""}>
          <option value="">Any skin type</option>
          {extra.ok && extra.data.skin_types.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
        </SelectField>
        <SelectField label="Text" name="has_text" value={params.has_text ?? ""}>
          <option value="">All reviews</option>
          <option value="true">With written text</option>
        </SelectField>
        {params.product_id && <input type="hidden" name="product_id" value={params.product_id} />}
        <input type="hidden" name="sort" value={params.sort === "recent" ? "" : params.sort} />
        <button type="submit" className="h-10 rounded-xl bg-burgundy px-5 text-sm font-medium text-white hover:bg-burgundy-dark">
          Search
        </button>
        {filtered && (
          <Link href="/reviews" className="h-10 rounded-xl px-3 text-sm leading-10 text-muted hover:text-burgundy">
            Clear all
          </Link>
        )}
      </FilterForm>
      {params.product_id && (
        <p className="mt-3">
          <Link
            href={keep({ product_id: undefined, page: 1 })}
            className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1 text-xs font-medium text-burgundy-dark hover:bg-rose/40"
          >
            Product {params.product_id} <X aria-hidden className="h-3 w-3" />
            <span className="sr-only">Remove the product filter</span>
          </Link>
        </p>
      )}
      <ScopeNote className="mt-4">
        Customer reviews in this dataset cover Skincare products only. &ldquo;Positive&rdquo;, &ldquo;neutral&rdquo; and
        &ldquo;negative&rdquo; on this page group the <strong>star ratings</strong> (4–5, 3, 1–2); text sentiment from a
        lexicon-based model is on the Sentiment page. Search is a literal, case-insensitive match in titles and texts.
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
          {s!.term && (
            <Card className="mt-6 bg-gradient-to-br from-white to-blush/60">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-burgundy">Text exploration</p>
              <p className="mt-2 text-lg text-charcoal">
                <strong>&ldquo;{s!.term.q}&rdquo;</strong> appears in {formatInteger(s!.term.matches)} reviews
                {s!.term.mention_share !== null && <> ({formatPercent(s!.term.mention_share, 2)} of {formatInteger(s!.term.base_reviews)} with the same filters)</>}.
              </p>
              {s!.term.average_rating_with_term !== null && s!.term.average_rating_without_term !== null && (
                <p className="mt-1 text-sm text-muted">
                  Reviews mentioning it average <strong className="text-charcoal">{formatRating(s!.term.average_rating_with_term)} ★</strong>, against{" "}
                  <strong className="text-charcoal">{formatRating(s!.term.average_rating_without_term)} ★</strong> for the others (
                  {s!.term.average_rating_with_term >= s!.term.average_rating_without_term ? "+" : "−"}
                  {formatRating(Math.abs(s!.term.average_rating_with_term - s!.term.average_rating_without_term))}).
                </p>
              )}
            </Card>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Reviews" value={formatInteger(s!.total_reviews)} note={`On ${formatInteger(s!.reviewed_products)} products`} icon={MessageSquareHeart} accent />
            <KpiCard label="Average rating" value={s!.average_rating === null ? "—" : `${formatRating(s!.average_rating)} ★`} note={`${formatPercent(s!.rating_groups[0].share ?? 0)} give 4–5 stars`} icon={Star} />
            <KpiCard
              label="Would recommend"
              value={s!.recommend_rate === null ? "—" : formatPercent(s!.recommend_rate)}
              note={`Among ${formatInteger(s!.recommendation.yes + s!.recommendation.no)} reviewers who answered`}
              icon={ThumbsUp}
            />
            <KpiCard
              label="Helpful votes"
              value={formatCompact(s!.helpfulness.total_helpful_votes)}
              note={`${formatInteger(s!.helpfulness.with_votes)} reviews received votes`}
              icon={ThumbsUp}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <ChartCard title="Star ratings">
              <DonutChart slices={ratingSlices(s!.ratings)} centerLabel="reviews" unit="Reviews" caption="Donut chart of reviews per star rating" />
            </ChartCard>
            <ChartCard title="Positive and negative ratings" insight="Grouped star ratings: 4–5, 3 and 1–2.">
              <ColumnChart
                data={s!.rating_groups.map((g) => ({
                  label: g.label.replace(/ \(.*\)/, ""),
                  value: g.share,
                  color: g.key === "positive" ? starRamp[4] : g.key === "negative" ? starRamp[1] : colors.other,
                  details: [{ label: "Reviews", value: formatInteger(g.count) }, { label: "Stars", value: g.label.match(/\((.*)\)/)?.[1] ?? "" }],
                }))}
                caption="Share of reviews with positive, neutral and negative star ratings"
                unit="Share"
                format="percent"
                domain={[0, 1]}
              />
            </ChartCard>
            <ChartCard title="Recommendation" insight="Answers to “Would you recommend this product?”">
              <DonutChart
                slices={[
                  { label: "Recommends", value: s!.recommendation.yes, color: colors.burgundy },
                  { label: "Does not recommend", value: s!.recommendation.no, color: colors.rose },
                  { label: "Did not answer", value: s!.recommendation.unknown, color: colors.other },
                ].filter((x) => x.value > 0)}
                centerLabel="reviews"
                unit="Reviews"
                caption="Recommendation answers"
              />
            </ChartCard>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
            <ChartCard
              title={s!.granularity === "month" ? `Reviews per month in ${params.year}` : "Review volume over time"}
              insight={trendInsight(s!.trend)}
              className="xl:col-span-3"
            >
              <TrendChart series={[{ key: s!.granularity, label: s!.granularity, points: s!.trend }]} height={250} />
            </ChartCard>
            <ChartCard
              title="Review length"
              insight={s!.text.median_length === null ? undefined : `Median ${formatInteger(s!.text.median_length)} characters; hover a bar for its average rating.`}
              className="xl:col-span-2"
            >
              <ColumnChart
                data={s!.text.length_bands.map((b) => ({
                  label: b.label,
                  value: b.count,
                  details: [{ label: "Average rating", value: b.average_rating === null ? "—" : `★ ${formatRating(b.average_rating)}` }],
                }))}
                caption="Reviews by text length in characters"
                unit="Reviews"
                format="compact"
              />
            </ChartCard>
          </div>

          <ChartCard title="Most reviewed products" insight={topProductInsight(s!.top_products)} className="mt-6">
            <RankedBars
              caption="Most reviewed products for the selected filters"
              items={s!.top_products.map((p) => ({ label: p.product_name, sublabel: p.brand_name, value: p.review_count, rating: p.average_rating }))}
            />
          </ChartCard>

          {s!.most_helpful.length > 0 && (
            <>
              <SectionTitle title="Most helpful reviews" description="The reviews other shoppers voted helpful most often, for these filters." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {s!.most_helpful.map((r, i) => (
                  <ReviewCard key={`h-${i}`} r={r} product={{ id: r.product_id, name: r.product_name, brand: r.brand_name }} maxLength={420} />
                ))}
              </div>
            </>
          )}
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
              href={(p) => keep({ page: p })}
            />
          </>
        )}
      </section>
    </>
  );
}
