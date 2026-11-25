import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { api, attempt } from "@/lib/api";
import { formatInteger, formatRating, formatUsd } from "@/lib/format";
import { PRODUCT_SORTS, hrefWith, parseProductParams, type SearchParams } from "@/lib/params";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/Card";
import { FilterForm, SelectField } from "@/components/ui/Filters";
import { Pagination } from "@/components/ui/Pagination";

export const metadata: Metadata = { title: "Products" };

const PAGE_SIZE = 20;
const HEADER = {
  eyebrow: "Products",
  title: "Product catalogue",
  description: "Search every Sephora product by name or brand, filter by category and sort.",
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const options = await attempt(api.filters());
  if (!options.ok) {
    return (
      <>
        <PageHeader {...HEADER} />
        <ErrorState message={options.error} />
      </>
    );
  }

  const params = parseProductParams(await searchParams, options.data);
  const result = await attempt(api.products({ ...params, page_size: PAGE_SIZE }));
  const filtered = params.q || params.category;

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
          Search
        </button>
        {filtered && (
          <Link href="/products" className="h-10 rounded-xl px-3 text-sm leading-10 text-muted hover:text-burgundy">
            Clear
          </Link>
        )}
      </FilterForm>

      <section aria-labelledby="results" className="mt-6">
        <h2 id="results" className="mb-3 text-sm text-muted">
          {result.ok ? (
            <>
              <span className="font-semibold text-charcoal">{formatInteger(result.data.total)}</span>{" "}
              {result.data.total === 1 ? "product" : "products"}
              {filtered ? " found" : ""}
            </>
          ) : (
            "Products"
          )}
        </h2>

        {!result.ok ? (
          <ErrorState message={result.error} />
        ) : result.data.total === 0 ? (
          <EmptyState message="No products match your search. Try another name or category." />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">Products</caption>
                <thead className="bg-blush/60 text-left text-xs font-semibold uppercase tracking-wider text-burgundy">
                  <tr>
                    <th scope="col" className="px-5 py-3">Product</th>
                    <th scope="col" className="px-5 py-3">Category</th>
                    <th scope="col" className="px-5 py-3 text-right">Price</th>
                    <th scope="col" className="px-5 py-3 text-right">Rating</th>
                    <th scope="col" className="px-5 py-3 text-right">Reviews</th>
                    <th scope="col" className="px-5 py-3 text-right">Loves</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((p) => (
                    <tr key={p.product_id} className="border-t border-line transition-colors hover:bg-blush/40">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-charcoal">{p.product_name}</p>
                        <p className="text-xs text-muted">{p.brand_name}</p>
                      </td>
                      <td className="px-5 py-3.5 text-muted">
                        {p.category}
                        <span className="block text-xs">{p.subcategory}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-charcoal">{formatUsd(p.price)}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-charcoal">
                        {p.rating === null ? <span className="text-muted">—</span> : `★ ${formatRating(p.rating)}`}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-charcoal">
                        {p.catalogue_reviews === null ? <span className="text-muted">—</span> : formatInteger(p.catalogue_reviews)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-charcoal">{formatInteger(p.loves)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">Rating and reviews are Sephora&apos;s catalogue figures for each product.</p>
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
