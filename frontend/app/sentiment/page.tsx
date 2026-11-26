import type { Metadata } from "next";
import Link from "next/link";
import { Frown, Meh, Scale, Smile } from "lucide-react";
import { api, attempt, type SentimentExample, type SentimentLabel, type SentimentMetrics, type SentimentRankRow, type SentimentTerm } from "@/lib/api";
import { formatCompact, formatInteger, formatPercent, formatRating } from "@/lib/format";
import { formatCompound, mostNegativeTopic, sentimentTrendInsight } from "@/lib/insights";
import { SENTIMENT_LEVELS, hrefWith, parseSentimentParams, type SearchParams } from "@/lib/params";
import { categorical, colors } from "@/lib/theme";
import { Card, ChartCard, EmptyState, ErrorState, KpiCard, PageHeader, SectionTitle } from "@/components/ui/Card";
import { FilterForm, SelectField } from "@/components/ui/Filters";
import { ReviewCard } from "@/components/ui/ReviewCard";
import { ScopeNote } from "@/components/ui/ScopeNote";
import { SegmentedLinks } from "@/components/ui/Segmented";
import { DataTable, Td, Th } from "@/components/ui/Table";
import { StackedShares } from "@/components/charts/StackedShares";

export const metadata: Metadata = { title: "Sentiment" };

const HEADER = {
  eyebrow: "Analytics",
  title: "Sentiment analysis",
  description: "What the review texts say, classified as positive, neutral or negative by a lexicon-based model adapted to skincare.",
};
const LABEL_ORDER: SentimentLabel[] = ["negative", "neutral", "positive"];
const SEGMENTS = [
  { label: "Negative", color: categorical[3] },
  { label: "Neutral", color: colors.other },
  { label: "Positive", color: colors.burgundy },
];
const sharesOf = (s: Record<SentimentLabel, number | null>) => LABEL_ORDER.map((l) => s[l]);

export default async function SentimentPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const options = await attempt(api.filters());
  if (!options.ok) {
    return (
      <>
        <PageHeader {...HEADER} />
        <ErrorState message={options.error} />
      </>
    );
  }
  const params = parseSentimentParams(await searchParams, options.data);
  const scope = { subcategory: params.subcategory };
  const [summary, rankings, examples, topics, method] = await Promise.all([
    attempt(api.sentiment(scope)),
    attempt(api.sentimentRankings({ ...scope, level: params.level })),
    attempt(api.sentimentExamples(scope)),
    attempt(api.sentimentTopics()),
    attempt(api.sentimentMethodology()),
  ]);
  if (!summary.ok) {
    return (
      <>
        <PageHeader {...HEADER} />
        <ErrorState message={summary.error} />
        <p className="mt-3 text-sm text-muted">
          Sentiment is computed once per dataset. Run <code className="rounded bg-surface px-1.5 py-0.5">python -m sephora.sentiment</code> in{" "}
          <code className="rounded bg-surface px-1.5 py-0.5">backend</code> (about a minute), then reload.
        </p>
      </>
    );
  }
  const s = summary.data;
  const levelHref = (level: string) => hrefWith("/sentiment", {}, { subcategory: params.subcategory, level: level === "product" ? undefined : level }) + "#rankings";
  const negativeTopic = topics.ok ? mostNegativeTopic(topics.data.aspects) : undefined;

  return (
    <>
      <PageHeader {...HEADER} />
      <FilterForm action="/sentiment">
        <SelectField label="Product subcategory" name="subcategory" value={params.subcategory ?? ""}>
          <option value="">All Skincare</option>
          {options.data.review_subcategories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({formatCompact(c.count)})
            </option>
          ))}
        </SelectField>
        <input type="hidden" name="level" value={params.level === "product" ? "" : params.level} />
        <noscript>
          <button type="submit" className="h-10 rounded-xl bg-burgundy px-5 text-sm font-medium text-white">
            Apply
          </button>
        </noscript>
        {params.subcategory && (
          <Link href={hrefWith("/sentiment", {}, { level: params.level === "product" ? undefined : params.level })} className="h-10 rounded-xl px-3 text-sm leading-10 text-muted hover:text-burgundy">
            Clear filter
          </Link>
        )}
      </FilterForm>
      <ScopeNote className="mt-4">
        Each review&apos;s <strong>title and text</strong> are scored by VADER with a small skincare lexicon and phrase rules (see{" "}
        <a href="#method" className="text-burgundy hover:underline">method and validation</a>). Star ratings are <strong>not</strong> used to
        classify; they are used only afterwards to check the model. Reviews cover Skincare only.
      </ScopeNote>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Positive texts" value={s.shares.positive === null ? "—" : formatPercent(s.shares.positive)} note={`${formatCompact(s.counts.positive)} of ${formatCompact(s.reviews)} reviews`} icon={Smile} accent />
        <KpiCard label="Neutral texts" value={s.shares.neutral === null ? "—" : formatPercent(s.shares.neutral)} note={`${formatCompact(s.counts.neutral)} reviews`} icon={Meh} />
        <KpiCard label="Negative texts" value={s.shares.negative === null ? "—" : formatPercent(s.shares.negative)} note={`${formatCompact(s.counts.negative)} reviews`} icon={Frown} />
        <KpiCard
          label="Agrees with the stars"
          value={s.agreement_with_stars === null ? "—" : formatPercent(s.agreement_with_stars)}
          note={`Average score ${formatCompound(s.average_compound)} (−1 to +1)`}
          icon={Scale}
        />
      </div>

      {s.reviews === 0 ? (
        <div className="mt-6">
          <EmptyState message="No reviews in this subcategory." />
        </div>
      ) : (
        <>
          <SectionTitle title="Text sentiment against stars and time" />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard
              title="Text sentiment by star rating"
              insight={`Mixed texts are common at 3★; ${formatPercent(s.by_stars[0].negative ?? 0)} of 1★ texts read negative.`}
            >
              <StackedShares
                caption="Share of negative, neutral and positive texts per star rating"
                segments={SEGMENTS}
                totalLabel="Reviews"
                rows={[...s.by_stars].reverse().map((b) => ({ label: `${b.rating}★`, shares: sharesOf(b), total: b.reviews }))}
              />
              <div className="mt-6">
                <DataTable caption="Text sentiment per star rating" minWidth={360}>
                  <thead>
                    <tr>
                      <Th>Stars</Th>
                      <Th align="right">Reviews</Th>
                      <Th align="right">Positive</Th>
                      <Th align="right">Neutral</Th>
                      <Th align="right">Negative</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...s.by_stars].reverse().map((b) => (
                      <tr key={b.rating} className="border-t border-line">
                        <Td className="font-medium text-charcoal">{b.rating}★</Td>
                        <Td align="right">{formatInteger(b.reviews)}</Td>
                        {(["positive", "neutral", "negative"] as const).map((l) => (
                          <Td key={l} align="right">
                            {b[l] === null ? "—" : formatPercent(b[l])}
                          </Td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </div>
            </ChartCard>
            <ChartCard title="Text sentiment by year" insight={sentimentTrendInsight(s.trend)}>
              <StackedShares
                caption="Share of negative, neutral and positive texts per year"
                segments={SEGMENTS}
                totalLabel="Reviews"
                rows={s.trend.map((t) => ({ label: t.period, shares: sharesOf(t), total: t.reviews }))}
              />
            </ChartCard>
          </div>

          {!params.subcategory && s.by_subcategory.length > 1 && (
            <>
              <SectionTitle title="By subcategory" description="Select a subcategory to focus the page on it." />
              <DataTable caption="Text sentiment by Skincare subcategory" minWidth={620}>
                <thead>
                  <tr>
                    <Th>Subcategory</Th>
                    <Th align="right">Reviews</Th>
                    <Th align="right">Positive</Th>
                    <Th align="right">Negative</Th>
                    <Th align="right">Average score</Th>
                  </tr>
                </thead>
                <tbody>
                  {s.by_subcategory.map((c) => (
                    <tr key={c.name} className="border-t border-line">
                      <Td>
                        <Link href={hrefWith("/sentiment", {}, { subcategory: c.name, level: params.level === "product" ? undefined : params.level })} className="font-medium text-charcoal hover:text-burgundy">
                          {c.name}
                        </Link>
                      </Td>
                      <Td align="right">{formatInteger(c.reviews)}</Td>
                      <Td align="right">{formatPercent(c.positive)}</Td>
                      <Td align="right">{formatPercent(c.negative)}</Td>
                      <Td align="right">{formatCompound(c.average_compound)}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </>
          )}
        </>
      )}

      <SectionTitle
        title="Topics and words"
        description="Computed over all Skincare reviews. A topic is a documented keyword group; a review can mention several topics."
      />
      {!topics.ok ? (
        <ErrorState message={topics.error} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <ChartCard
              className="xl:col-span-3"
              title="Sentiment of reviews that mention each topic"
              insight={negativeTopic ? `${negativeTopic.aspect} has the largest negative share: ${formatPercent(negativeTopic.negative ?? 0)} of ${formatCompact(negativeTopic.mentions)} mentions.` : undefined}
            >
              <StackedShares
                caption="Share of negative, neutral and positive texts among reviews that mention each topic"
                segments={SEGMENTS}
                totalLabel="Mentions"
                rows={topics.data.aspects.map((a) => ({ label: a.aspect, shares: sharesOf(a), total: a.mentions }))}
              />
            </ChartCard>
            <div className="xl:col-span-2">
              <DataTable caption="How often each topic is mentioned and its average star rating" minWidth={320}>
                <thead>
                  <tr>
                    <Th>Topic</Th>
                    <Th align="right">Share of reviews</Th>
                    <Th align="right">Avg rating</Th>
                  </tr>
                </thead>
                <tbody>
                  {topics.data.aspects.map((a) => (
                    <tr key={a.aspect} className="border-t border-line">
                      <Td className="font-medium text-charcoal">{a.aspect}</Td>
                      <Td align="right">{a.share === null ? "—" : formatPercent(a.share)}</Td>
                      <Td align="right">{a.average_rating === null ? "—" : `★ ${formatRating(a.average_rating)}`}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {(["positive", "negative"] as const).map((cls) => {
              const c = topics.data.words.classes[cls];
              if (!c) return null;
              return (
                <Card key={cls}>
                  <h3 className="text-base font-semibold text-charcoal">What sets {cls} reviews apart</h3>
                  <p className="mt-1 text-xs text-muted">
                    In a random sample of {formatInteger(topics.data.words.sample_size)} reviews: the words used most distinctively in {cls} texts,
                    and the most common two-word phrases (after removing filler words) that are at least 1.6× as frequent in {cls} texts as in the
                    others. The share is of {cls} reviews that use the term.
                  </p>
                  <TermList title="Words" terms={c.distinctive_words.slice(0, 12)} tone={cls} />
                  <TermList title="Common phrases" terms={leaningPhrases(c.frequent_phrases)} tone={cls} />
                </Card>
              );
            })}
          </div>
        </>
      )}

      <SectionTitle
        id="rankings"
        title="Most positive and most negative"
        description={rankings.ok ? `${SENTIMENT_LEVELS[params.level]} with at least ${formatInteger(rankings.data.min_reviews)} reviews in scope (${formatInteger(rankings.data.eligible)} qualify), ranked by the share of positive or negative texts.` : undefined}
      />
      <div className="mb-4">
        <SegmentedLinks label="Rank" options={SENTIMENT_LEVELS} active={params.level} href={levelHref} />
      </div>
      {!rankings.ok ? (
        <ErrorState message={rankings.error} />
      ) : rankings.data.eligible === 0 ? (
        <EmptyState message={`No ${params.level === "brand" ? "brand" : "product"} has enough reviews in scope.`} />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <RankTable title="Most positive texts" rows={rankings.data.most_positive} level={params.level} measure="positive" />
          <RankTable title="Most negative texts" rows={rankings.data.most_negative} level={params.level} measure="negative" />
        </div>
      )}

      <SectionTitle title="Example reviews" description="Clear examples of each class (most helpful first, 120–600 characters), and reviews where the model and the stars disagree." />
      {!examples.ok ? (
        <ErrorState message={examples.error} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(["positive", "neutral", "negative"] as const).map((cls) => {
              const e = examples.data[cls][0];
              return e ? <Example key={cls} e={e} note={`Text reads ${cls}`} /> : <EmptyState key={cls} message={`No clear ${cls} example in scope.`} />;
            })}
          </div>
          {examples.data.disagreements.length > 0 && (
            <>
              <h3 className="mt-8 text-base font-semibold text-charcoal">Text reads positive, stars say 1–2★</h3>
              <p className="mt-1 text-sm text-muted">Causes include sarcasm, a positive start before a complaint, and praise for something other than the product. These show the model&apos;s limits.</p>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                {examples.data.disagreements.map((e, i) => (
                  <Example key={i} e={e} note="Model and stars disagree" />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <SectionTitle id="method" title="Method and validation" />
      {!method.ok ? (
        <ErrorState message={method.error} />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <h3 className="text-base font-semibold text-charcoal">Model</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {method.data.model}. VADER scores words from a human-rated lexicon and handles negation, intensifiers, &ldquo;but&rdquo;, capitals and
              punctuation. Each sentence is scored and averaged, then averaged with the title. A score of {method.data.threshold} or more is positive,{" "}
              &minus;{method.data.threshold} or less negative. It runs locally; {formatInteger(method.data.reviews)} reviews were scored in{" "}
              {Math.round(method.data.seconds_scoring)} s on {method.data.workers} processes.
            </p>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">Skincare words added</p>
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {Object.entries(method.data.domain_lexicon).map(([word, weight]) => (
                <span key={word} className="rounded-full bg-surface px-2 py-0.5 text-xs text-charcoal" title={`Weight ${weight}`}>
                  {word}
                </span>
              ))}
            </p>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">Limitations</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>Sarcasm, comparisons and mixed reviews are hard for any lexicon model.</li>
              <li>3★ reviews are usually mixed, so agreement on &ldquo;neutral&rdquo; is low.</li>
              <li>Topics are keyword matches, not a trained topic model.</li>
            </ul>
          </Card>
          <Card>
            <h3 className="text-base font-semibold text-charcoal">Validation against star groups</h3>
            <p className="mt-1 text-xs text-muted">
              {method.data.validation.reference}. Held-out random sample of {formatInteger(method.data.validation.sample_size)} reviews, separate from the sample used
              to choose the adaptations.
            </p>
            {method.data.validation.adapted && method.data.validation.base_vader ? (
              <>
                <MetricsTable base={method.data.validation.base_vader} adapted={method.data.validation.adapted} />
                <Confusion m={method.data.validation.adapted} />
              </>
            ) : (
              <EmptyState message="Too few reviews to hold out a test sample." />
            )}
          </Card>
        </div>
      )}
    </>
  );
}

/** Common phrases that lean towards the class: log ratio ≥ 0.5, i.e. at least ~1.6× as frequent as elsewhere. */
const leaningPhrases = (terms: SentimentTerm[]) => terms.filter((t) => t.log_ratio >= 0.5).slice(0, 10);

function TermList({ title, terms, tone }: { title: string; terms: SentimentTerm[]; tone: "positive" | "negative" }) {
  if (!terms.length) return null;
  return (
    <>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {terms.map((t) => (
          <li
            key={t.term}
            className={`rounded-full px-2.5 py-1 text-xs ${tone === "positive" ? "bg-blush text-burgundy" : "bg-surface text-charcoal"}`}
            title={`${formatInteger(t.reviews)} reviews in the sample`}
          >
            {t.term} <span className="tabular-nums text-muted">{formatPercent(t.share)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function RankTable({ title, rows, level, measure }: { title: string; rows: SentimentRankRow[]; level: "product" | "brand"; measure: "positive" | "negative" }) {
  return (
    <div>
      <h3 className="mb-3 text-base font-semibold text-charcoal">{title}</h3>
      <DataTable caption={title} minWidth={480}>
        <thead>
          <tr>
            <Th>{level === "product" ? "Product" : "Brand"}</Th>
            <Th align="right">Reviews</Th>
            <Th align="right">{measure === "positive" ? "Positive" : "Negative"}</Th>
            <Th align="right">Avg rating</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.product_id ?? r.brand_name} className="border-t border-line">
              <Td>
                {level === "product" ? (
                  <>
                    <Link href={`/products/${r.product_id}`} className="font-medium text-charcoal hover:text-burgundy">
                      {r.product_name}
                    </Link>
                    <span className="block text-xs text-muted">{r.brand_name}</span>
                  </>
                ) : (
                  <span className="font-medium text-charcoal">{r.brand_name}</span>
                )}
              </Td>
              <Td align="right">{formatInteger(r.reviews)}</Td>
              <Td align="right">{formatPercent(measure === "positive" ? r.positive : r.negative)}</Td>
              <Td align="right">★ {formatRating(r.average_rating)}</Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

function Example({ e, note }: { e: SentimentExample; note: string }) {
  return (
    <div className="flex flex-col">
      <p className="mb-2 text-xs font-medium text-muted">
        {note} · score <span className="tabular-nums text-charcoal">{formatCompound(e.compound)}</span>
      </p>
      <ReviewCard r={e} product={{ id: e.product_id, name: e.product_name, brand: e.brand_name }} maxLength={360} />
    </div>
  );
}

function MetricsTable({ base, adapted }: { base: SentimentMetrics; adapted: SentimentMetrics }) {
  const rows: [string, (m: SentimentMetrics) => string][] = [
    ["Accuracy", (m) => formatPercent(m.accuracy)],
    ["Macro F1", (m) => m.macro_f1.toFixed(3)],
    ["Cohen's kappa", (m) => (m.cohen_kappa === null ? "—" : m.cohen_kappa.toFixed(3))],
  ];
  return (
    <div className="mt-4">
      <DataTable caption="Agreement with star groups, base VADER against the adapted model" minWidth={320}>
        <thead>
          <tr>
            <Th>Measure</Th>
            <Th align="right">Base VADER</Th>
            <Th align="right">Adapted</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-t border-line">
              <Td className="font-medium text-charcoal">{label}</Td>
              <Td align="right">{value(base)}</Td>
              <Td align="right">{value(adapted)}</Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <p className="mt-2 text-xs text-muted">
        Accuracy is dominated by the many positive reviews; macro F1 and kappa weigh the three classes more fairly.
      </p>
    </div>
  );
}

function Confusion({ m }: { m: SentimentMetrics }) {
  const names = ["Negative", "Neutral", "Positive"];
  return (
    <div className="mt-6">
      <DataTable caption="Adapted model: star group (rows) against text label (columns)" minWidth={360}>
        <thead>
          <tr>
            <Th>Stars \ text</Th>
            {names.map((n) => (
              <Th key={n} align="right">
                {n}
              </Th>
            ))}
            <Th align="right">Recall</Th>
          </tr>
        </thead>
        <tbody>
          {m.confusion.map((row, i) => (
            <tr key={names[i]} className="border-t border-line">
              <Td className="font-medium text-charcoal">{names[i]}</Td>
              {row.map((n, j) => (
                <Td key={j} align="right" className={i === j ? "font-semibold text-burgundy" : undefined}>
                  {formatInteger(n)}
                </Td>
              ))}
              <Td align="right">{formatPercent(m.per_class[i].recall)}</Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
