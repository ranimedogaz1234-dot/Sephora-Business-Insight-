import type { Metadata } from "next";
import Link from "next/link";
import { Fingerprint, MessageSquareHeart, ScanFace, Star } from "lucide-react";
import { api, attempt } from "@/lib/api";
import { formatCompact, formatInteger, formatPercent, formatRating } from "@/lib/format";
import { REVIEWER_ATTRIBUTES, hrefWith, parseCustomerParams, type SearchParams } from "@/lib/params";
import { colors, starRamp } from "@/lib/theme";
import { Card, ChartCard, EmptyState, ErrorState, KpiCard, PageHeader, SectionTitle } from "@/components/ui/Card";
import { FilterForm, SelectField } from "@/components/ui/Filters";
import { ScopeNote } from "@/components/ui/ScopeNote";
import { SegmentedLinks } from "@/components/ui/Segmented";
import { DataTable, Missing, Td, Th } from "@/components/ui/Table";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { RankedBars } from "@/components/charts/RankedBars";
import { StackedShares } from "@/components/charts/StackedShares";

export const metadata: Metadata = { title: "Customer insights" };

const HEADER = {
  eyebrow: "Customers",
  title: "Customer insights",
  description: "Who reviews Sephora's Skincare products, as described by the optional attributes reviewers chose to share.",
};
const STAR_SEGMENTS = [1, 2, 3, 4, 5].map((s) => ({ label: `${s}★`, color: starRamp[s - 1] }));

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const options = await attempt(api.filters());
  if (!options.ok) {
    return (
      <>
        <PageHeader {...HEADER} />
        <ErrorState message={options.error} />
      </>
    );
  }
  const params = parseCustomerParams(await searchParams, options.data);
  const [summary, prefs] = await Promise.all([
    attempt(api.customers({ subcategory: params.subcategory })),
    attempt(api.customerPreferences({ subcategory: params.subcategory, attribute: params.attribute })),
  ]);
  if (!summary.ok) {
    return (
      <>
        <PageHeader {...HEADER} />
        <ErrorState message={summary.error} />
      </>
    );
  }
  const s = summary.data;
  const selected = s.attributes.find((a) => a.attribute === params.attribute)!;
  const skinType = s.attributes.find((a) => a.attribute === "skin_type")!;

  return (
    <>
      <PageHeader {...HEADER} />
      <FilterForm action="/customers">
        <SelectField label="Product subcategory" name="subcategory" value={params.subcategory ?? ""}>
          <option value="">All Skincare</option>
          {options.data.review_subcategories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({formatCompact(c.count)})
            </option>
          ))}
        </SelectField>
        <input type="hidden" name="attribute" value={params.attribute === "skin_type" ? "" : params.attribute} />
        <noscript>
          <button type="submit" className="h-10 rounded-xl bg-burgundy px-5 text-sm font-medium text-white">
            Apply
          </button>
        </noscript>
        {params.subcategory && (
          <Link href={hrefWith("/customers", {}, { attribute: params.attribute === "skin_type" ? undefined : params.attribute })} className="h-10 rounded-xl px-3 text-sm leading-10 text-muted hover:text-burgundy">
            Clear filter
          </Link>
        )}
      </FilterForm>
      <ScopeNote className="mt-4">
        These attributes are optional answers given with each review. Percentages are shares of <strong>reviews that
        answered</strong>, not of people: one reviewer can write many reviews. Missing answers are shown as coverage and
        never guessed. The data contains no age, gender, income or location, so none is shown. Reviews cover Skincare only.
      </ScopeNote>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Reviews in scope" value={formatCompact(s.reviews)} note={params.subcategory ?? "All Skincare reviews"} icon={MessageSquareHeart} accent />
        <KpiCard
          label="Distinct reviewer IDs"
          value={formatCompact(s.activity.distinct_reviewer_ids)}
          note="Whole export · accounts, not verified people"
          icon={Fingerprint}
        />
        <KpiCard
          label="Skin type answered"
          value={skinType.coverage === null ? "—" : formatPercent(skinType.coverage)}
          note={`${formatCompact(skinType.answered)} reviews`}
          icon={ScanFace}
        />
        <KpiCard label="Average rating" value={s.average_rating === null ? "—" : `${formatRating(s.average_rating)} ★`} note={s.recommend_rate === null ? undefined : `${formatPercent(s.recommend_rate)} recommend`} icon={Star} />
      </div>

      {s.reviews === 0 ? (
        <div className="mt-6">
          <EmptyState message="No reviews in this subcategory." />
        </div>
      ) : (
        <>
          <SectionTitle title="Distributions" description="Each chart counts the reviews that answered; the note under the title gives the answer rate." />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {s.attributes.map((a) => (
              <ChartCard
                key={a.attribute}
                title={a.name}
                insight={a.coverage === null ? undefined : `${formatPercent(a.coverage)} of reviews answered (${formatCompact(a.answered)}).`}
                action={
                  <Link href={hrefWith("/customers", {}, { subcategory: params.subcategory, attribute: a.attribute === "skin_type" ? undefined : a.attribute }) + "#detail"} className="text-xs font-medium text-burgundy hover:underline">
                    Analyse
                  </Link>
                }
              >
                {a.groups.length ? (
                  <RankedBars
                    caption={`${a.name} of reviewers who answered`}
                    color={a.attribute === params.attribute ? colors.burgundy : colors.rose}
                    items={a.groups.map((g) => ({ label: g.label, sublabel: formatPercent(g.share), value: g.count, rating: g.average_rating }))}
                  />
                ) : (
                  <EmptyState message="No reviews answered this question." />
                )}
              </ChartCard>
            ))}
          </div>

          <SectionTitle id="detail" title={`Ratings and recommendations by ${selected.name.toLowerCase()}`} />
          <div className="mb-4">
            <SegmentedLinks
              label="Attribute to analyse"
              options={REVIEWER_ATTRIBUTES}
              active={params.attribute}
              href={(v) => hrefWith("/customers", {}, { subcategory: params.subcategory, attribute: v === "skin_type" ? undefined : v }) + "#detail"}
            />
          </div>
          {selected.groups.length ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
              <ChartCard title="Rating mix per group" insight="Share of 1★ to 5★ reviews within each group." className="xl:col-span-2">
                <StackedShares
                  caption={`Rating mix by ${selected.name.toLowerCase()}`}
                  segments={STAR_SEGMENTS}
                  totalLabel="Reviews"
                  rows={selected.groups.map((g) => ({ label: g.label, shares: g.rating_shares, total: g.count }))}
                />
              </ChartCard>
              <div className="xl:col-span-3">
                <DataTable caption={`Ratings and recommendations by ${selected.name.toLowerCase()}`} minWidth={620}>
                  <thead>
                    <tr>
                      <Th>{selected.name}</Th>
                      <Th align="right">Reviews</Th>
                      <Th align="right">Avg rating</Th>
                      <Th align="right">4–5★</Th>
                      <Th align="right">1–2★</Th>
                      <Th align="right">Recommend</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.groups.map((g) => (
                      <tr key={g.key} className="border-t border-line">
                        <Td className="font-medium text-charcoal">{g.label}</Td>
                        <Td align="right">{formatInteger(g.count)}</Td>
                        <Td align="right">{g.average_rating === null ? <Missing /> : `★ ${formatRating(g.average_rating)}`}</Td>
                        <Td align="right">{g.positive_share === null ? <Missing /> : formatPercent(g.positive_share)}</Td>
                        <Td align="right">{g.negative_share === null ? <Missing /> : formatPercent(g.negative_share)}</Td>
                        <Td align="right">{g.recommend_rate === null ? <Missing label="No recommendation answers" /> : formatPercent(g.recommend_rate)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
                <p className="mt-2 text-xs text-muted">Small groups (a few hundred reviews or fewer) can move a lot with a handful of reviews.</p>
              </div>
            </div>
          ) : (
            <EmptyState message="No reviews answered this question in scope." />
          )}

          <SectionTitle
            title="Inferred product preferences"
            description={
              prefs.ok
                ? `${params.subcategory ? "" : `Subcategories where a group's reviews are over-represented (lift above 1×; at least ${formatInteger(prefs.data.min_subcategory_reviews)} reviews), and the `}${params.subcategory ? "The " : ""}products the group rates highest (at least ${formatInteger(prefs.data.min_group_reviews_for_product)} reviews from that group). Reviews show what people chose to review, not what they bought.`
                : undefined
            }
          />
          {!prefs.ok ? (
            <ErrorState message={prefs.error} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {prefs.data.groups.filter((g) => g.subcategories.length || g.top_rated.length).map((g) => (
                <Card key={g.key}>
                  <h3 className="text-base font-semibold text-charcoal">{g.label}</h3>
                  <p className="text-xs text-muted">{formatInteger(g.count)} reviews</p>
                  {g.subcategories.length > 0 && (
                    <>
                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">Reviews more often</p>
                      <ul className="mt-1.5 space-y-1 text-sm">
                        {g.subcategories.map((c) => (
                          <li key={c.name} className="flex justify-between gap-3">
                            <span className="text-charcoal">{c.name}</span>
                            <span className="tabular-nums text-muted">
                              {c.lift.toFixed(2)}× <span className="sr-only">compared with all reviewers</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">Rates highest</p>
                  {g.top_rated.length ? (
                    <ol className="mt-1.5 space-y-1.5 text-sm">
                      {g.top_rated.map((p) => (
                        <li key={p.product_id} className="flex justify-between gap-3">
                          <Link href={`/products/${p.product_id}`} className="min-w-0 truncate text-charcoal hover:text-burgundy" title={`${p.product_name} · ${p.brand_name}`}>
                            {p.product_name}
                          </Link>
                          <span className="shrink-0 tabular-nums text-muted">★ {formatRating(p.average_rating)}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-1.5 text-sm text-muted">Too few reviews per product from this group.</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <SectionTitle title="Reviewer activity" description="How many reviews each reviewer ID wrote, over the whole export. IDs are counted once at load time and never stored or shown." />
      <ChartCard title="Reviewer IDs by number of reviews written">
        <ColumnChart
          data={s.activity.bands.map((b) => ({
            label: b.label,
            value: b.reviewers,
            details: [{ label: "Reviews written", value: formatInteger(b.reviews) }],
          }))}
          caption="Number of reviewer IDs by how many reviews they wrote"
          unit="Reviewer IDs"
          format="compact"
        />
      </ChartCard>
    </>
  );
}
