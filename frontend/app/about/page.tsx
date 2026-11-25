import type { Metadata } from "next";
import { Database, GitPullRequest, LayoutDashboard, ShieldCheck } from "lucide-react";
import { api, attempt } from "@/lib/api";
import { formatDate, formatInteger } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui/Card";

export const metadata: Metadata = { title: "About" };

const STACK = [
  { name: "Next.js & React", role: "Pages and server rendering" },
  { name: "TypeScript", role: "Typed frontend code" },
  { name: "Tailwind CSS", role: "Design system and layout" },
  { name: "Recharts", role: "Interactive charts" },
  { name: "FastAPI", role: "Analytics API" },
  { name: "Pandas", role: "Data cleaning and aggregation" },
  { name: "pytest & Vitest", role: "Automated tests" },
  { name: "GitHub Actions", role: "Checks on every pull request" },
];

const CONTRIBUTORS = [
  { name: "Ranime Doggaz", github: "ranimedogaz1234-dot", role: "Development" },
  { name: "Ela", github: "Ellaezayed", role: "Code review and merging of pull requests" },
];

export default async function AboutPage() {
  const overview = await attempt(api.overview());
  const o = overview.ok ? overview.data : null;

  return (
    <>
      <PageHeader
        eyebrow="About"
        title="About this project"
        description="A university Business Intelligence project that turns Sephora's product catalogue and customer reviews into clear, visual insights."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <LayoutDashboard aria-hidden className="h-6 w-6 text-burgundy" strokeWidth={1.5} />
          <h2 className="mt-3 text-lg font-semibold text-charcoal">The goal</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Help a beauty retailer answer simple business questions at a glance: which categories make up the
            catalogue, which products and brands customers talk about most, how satisfied they are, and how review
            activity changes over time.
          </p>
        </Card>

        <Card>
          <Database aria-hidden className="h-6 w-6 text-burgundy" strokeWidth={1.5} />
          <h2 className="mt-3 text-lg font-semibold text-charcoal">The dataset</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The Sephora Products and Skincare Reviews dataset: one product catalogue file and five review files.
          </p>
          {o ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {[
                ["Products", formatInteger(o.total_products)],
                ["Brands", formatInteger(o.total_brands)],
                ["Reviews", formatInteger(o.total_reviews)],
                ["Period", `${formatDate(o.first_review)} – ${formatDate(o.last_review)}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-blush/60 px-3 py-2">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="font-semibold text-charcoal">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-xs text-muted">Dataset figures appear when the analytics service is running.</p>
          )}
          {o && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Reviews cover {o.review_categories.join(", ")} products. {formatInteger(o.duplicates_removed)} duplicate
              review rows were removed. The data files stay on our computers and are never published in the repository.
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold text-charcoal">Technologies</h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STACK.map((t) => (
            <li key={t.name} className="rounded-xl border border-line px-4 py-3">
              <p className="text-sm font-medium text-charcoal">{t.name}</p>
              <p className="text-xs text-muted">{t.role}</p>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <GitPullRequest aria-hidden className="h-6 w-6 text-burgundy" strokeWidth={1.5} />
          <h2 className="mt-3 text-lg font-semibold text-charcoal">Contributors</h2>
          <ul className="mt-4 space-y-3">
            {CONTRIBUTORS.map((c) => (
              <li key={c.github} className="flex items-center gap-3">
                <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-burgundy font-display text-white">
                  {c.name[0]}
                </span>
                <span>
                  <span className="block text-sm font-medium text-charcoal">{c.name}</span>
                  <span className="block text-xs text-muted">
                    {c.role} ·{" "}
                    <a
                      href={`https://github.com/${c.github}`}
                      className="text-burgundy hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      @{c.github}
                    </a>
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            Every change is made on a feature branch and reviewed in a pull request before it reaches main.
          </p>
        </Card>

        <Card>
          <ShieldCheck aria-hidden className="h-6 w-6 text-burgundy" strokeWidth={1.5} />
          <h2 className="mt-3 text-lg font-semibold text-charcoal">How to read the figures</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
            <li>Product counts, categories and prices cover the whole catalogue.</li>
            <li>Review figures are counted from the review files themselves.</li>
            <li>A product&apos;s rating and review count on the Products page are Sephora&apos;s own catalogue figures.</li>
            <li>Reviews show interest and satisfaction, not sales.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
