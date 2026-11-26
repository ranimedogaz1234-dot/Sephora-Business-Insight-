import type { Metadata } from "next";
import Link from "next/link";
import { Gem, Scale, TrendingDown, TriangleAlert } from "lucide-react";
import { api, attempt, type InsightProduct, type MomentumRow } from "@/lib/api";
import { formatCompact, formatDate, formatInteger, formatPercent, formatRating } from "@/lib/format";
import { parseDashboardParams, hrefWith, type SearchParams } from "@/lib/params";
import { Card, ChartCard, EmptyState, ErrorState, KpiCard, PageHeader, SectionTitle } from "@/components/ui/Card";
import { FilterForm, SelectField } from "@/components/ui/Filters";
import { ObservationList } from "@/components/ui/Observations";
import { ScopeNote } from "@/components/ui/ScopeNote";
import { DataTable, Missing, Td, Th } from "@/components/ui/Table";
import { ScatterPlot } from "@/components/charts/ScatterPlot";

export const metadata: Metadata = { title: "Business insights" };

const HEADER = {
  eyebrow: "Overview",
  title: "Business insights",
  description: "Opportunities and risks found by explicit rules on the catalogue and the reviews, each with the figures behind it.",
};

const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;

export default async function InsightsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const options = await attempt(api.filters());
  const params = parseDashboardParams(await searchParams, options.ok ? options.data : null);
  const result = await attempt(api.insights(params.category));
  if (!result.ok) {
    return (
      <>
        <PageHeader {...HEADER} />
        <ErrorState message={result.error} />
      </>
    );
  }
  const d = result.data;
  const m = d.momentum;
  const leaders = d.brands.quadrants.find((q) => q.key === "leaders");

  return (
    <>
      <PageHeader {...HEADER} />
      <FilterForm action="/insights">
        <SelectField label="Category" name="category" value={params.category ?? ""}>
          <option value="">All categories</option>
          {options.ok &&
            options.data.categories.map((c) => (
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
        {params.category && (
          <Link href="/insights" className="h-10 rounded-xl px-3 text-sm leading-10 text-muted hover:text-burgundy">
            Clear filter
          </Link>
        )}
      </FilterForm>
      <ScopeNote className="mt-4">
        Loves are saves on Sephora&apos;s site and catalogue reviews are Sephora&apos;s own counts: neither is a sale, so these findings describe
        engagement and satisfaction, not revenue. Each list states its rule. The suggested next steps are prompts for investigation, not
        measured results. Review-based momentum covers Skincare only.
      </ScopeNote>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Hidden gems" value={formatInteger(d.hidden_gems.count)} note="Highly rated, rarely saved" icon={Gem} accent />
        <KpiCard label="Popular, rated lower" value={formatInteger(d.at_risk.count)} note="Top 10% loved, below category rating" icon={TriangleAlert} />
        <KpiCard
          label="Declining Skincare products"
          value={m ? formatInteger(m.declining_count) : "—"}
          note={m ? `of ${formatInteger(m.eligible)} with enough reviews · ${formatInteger(m.improving_count)} improving` : "Reviews cover Skincare only"}
          icon={TrendingDown}
        />
        <KpiCard
          label="Brands compared"
          value={formatInteger(d.brands.brands)}
          note={leaders ? `${formatInteger(leaders.brands)} lead on both rating and saves` : undefined}
          icon={Scale}
        />
      </div>

      <SectionTitle title="Key findings" description="One finding per rule, with the figures it was computed from." />
      {d.findings.length ? <ObservationList items={d.findings} /> : <EmptyState message="No rule produced a finding in this scope." />}

      <SectionTitle title="Product opportunities and risks" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ProductTable
          title={`Hidden gems (${formatInteger(d.hidden_gems.count)})`}
          rule={d.rules.hidden_gems}
          items={d.hidden_gems.items}
          empty="No product matches this rule in scope."
        />
        <ProductTable
          title={`Popular, rated below their category (${formatInteger(d.at_risk.count)})`}
          rule={d.rules.at_risk}
          items={d.at_risk.items}
          empty="No product matches this rule in scope."
        />
      </div>

      {m && (
        <>
          <SectionTitle
            title="Rating momentum"
            description={`${d.rules.momentum} Recent period: ${formatDate(m.cutoff)} to ${formatDate(m.last_review)}.${m.median_change !== null ? ` Median change across ${formatInteger(m.eligible)} products: ${signed(m.median_change)} stars.` : ""}`}
          />
          {m.eligible === 0 ? (
            <EmptyState message="No product has enough reviews in both periods." />
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <MomentumTable title={`Declining (${formatInteger(m.declining_count)})`} rows={m.declining} />
              <MomentumTable title={`Improving (${formatInteger(m.improving_count)})`} rows={m.improving} />
            </div>
          )}
        </>
      )}

      <SectionTitle title="Brand positioning" description={d.rules.brands} />
      {d.brands.brands === 0 ? (
        <EmptyState message="Too few brands with enough rated products in scope." />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <ChartCard
            className="xl:col-span-3"
            title="Catalogue rating against saves per product"
            insight={`Dashed lines: median brand (${formatRating(d.brands.rating_split ?? 0)} rating, ${formatCompact(d.brands.loves_split ?? 0)} loves per product). Log scale for loves.`}
          >
            <ScatterPlot
              points={d.brands.points.filter((b) => b.loves_per_product > 0).map((b) => ({ label: b.brand_name, x: b.loves_per_product, y: b.rating, size: b.products }))}
              caption="Median loves per product against average catalogue rating, one point per brand"
              xLabel="Median loves per product"
              yLabel="Catalogue rating"
              sizeLabel="Products"
              xFormat="compact"
              yFormat="decimal2"
              logX
              xSplit={d.brands.loves_split ?? undefined}
              ySplit={d.brands.rating_split ?? undefined}
              height={340}
            />
          </ChartCard>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-2">
            {d.brands.quadrants.map((q) => (
              <Card key={q.key}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{q.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-charcoal">{formatInteger(q.brands)}</p>
                <p className="mt-2 text-xs text-muted">{q.examples.length ? q.examples.join(", ") : "None"}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!params.category && (
        <>
          <SectionTitle title="Category demand" description={d.rules.categories} />
          <DataTable caption="Share of products against share of loves per primary category" minWidth={620}>
            <thead>
              <tr>
                <Th>Category</Th>
                <Th align="right">Products</Th>
                <Th align="right">Share of products</Th>
                <Th align="right">Share of loves</Th>
                <Th align="right">Demand index</Th>
                <Th align="right">Avg rating</Th>
              </tr>
            </thead>
            <tbody>
              {d.categories.map((c) => (
                <tr key={c.category} className="border-t border-line">
                  <Td>
                    <Link href={hrefWith("/insights", {}, { category: c.category })} className="font-medium text-charcoal hover:text-burgundy">
                      {c.category}
                    </Link>
                  </Td>
                  <Td align="right">{formatInteger(c.products)}</Td>
                  <Td align="right">{formatPercent(c.product_share)}</Td>
                  <Td align="right">{formatPercent(c.loves_share)}</Td>
                  <Td align="right" className={c.demand_index !== null && c.demand_index >= 1 ? "font-semibold text-burgundy" : undefined}>
                    {c.demand_index === null ? <Missing /> : `${c.demand_index.toFixed(2)}×`}
                  </Td>
                  <Td align="right">{c.average_rating === null ? <Missing /> : `★ ${formatRating(c.average_rating)}`}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </>
      )}
    </>
  );
}

function ProductTable({ title, rule, items, empty }: { title: string; rule: string; items: InsightProduct[]; empty: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-charcoal">{title}</h3>
      <p className="mb-3 mt-1 text-xs text-muted">{rule} Showing up to 10.</p>
      {items.length === 0 ? (
        <EmptyState message={empty} />
      ) : (
        <DataTable caption={title} minWidth={520}>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th align="right">Rating</Th>
              <Th align="right">Category avg</Th>
              <Th align="right">Reviews</Th>
              <Th align="right">Loves</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.product_id} className="border-t border-line">
                <Td>
                  <Link href={`/products/${p.product_id}`} className="font-medium text-charcoal hover:text-burgundy">
                    {p.product_name}
                  </Link>
                  <span className="block text-xs text-muted">
                    {p.brand_name} · {p.category}
                  </span>
                </Td>
                <Td align="right">{p.rating === null ? <Missing /> : `★ ${formatRating(p.rating)}`}</Td>
                <Td align="right">{p.category_rating === null ? <Missing /> : formatRating(p.category_rating)}</Td>
                <Td align="right">{formatInteger(p.catalogue_reviews)}</Td>
                <Td align="right">
                  {formatCompact(p.loves)}
                  {p.loves_percentile !== null && <span className="block text-xs text-muted">{formatPercent(p.loves_percentile, 0)} pct.</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}

function MomentumTable({ title, rows }: { title: string; rows: MomentumRow[] }) {
  return (
    <div>
      <h3 className="mb-3 text-base font-semibold text-charcoal">{title}</h3>
      {rows.length === 0 ? (
        <EmptyState message="No product changed this much." />
      ) : (
        <DataTable caption={`${title}: average review rating before and in the last two years`} minWidth={520}>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th align="right">Before</Th>
              <Th align="right">Recent</Th>
              <Th align="right">Change</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product_id} className="border-t border-line">
                <Td>
                  <Link href={`/products/${r.product_id}`} className="font-medium text-charcoal hover:text-burgundy">
                    {r.product_name}
                  </Link>
                  <span className="block text-xs text-muted">{r.brand_name}</span>
                </Td>
                <Td align="right">
                  ★ {formatRating(r.rating_before)}
                  <span className="block text-xs text-muted">{formatInteger(r.reviews_before)} reviews</span>
                </Td>
                <Td align="right">
                  ★ {formatRating(r.rating_recent)}
                  <span className="block text-xs text-muted">{formatInteger(r.reviews_recent)} reviews</span>
                </Td>
                <Td align="right" className={r.change < 0 ? "font-semibold text-[#9B1C1C]" : "font-semibold text-[#1F6B3A]"}>
                  {signed(r.change)}
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
