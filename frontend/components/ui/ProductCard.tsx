import Link from "next/link";
import { Heart } from "lucide-react";
import type { ProductRow } from "@/lib/api";
import { formatCompact, formatRating, formatUsd } from "@/lib/format";

/** Compact product tile that links to the product details page. */
export function ProductCard({ p }: { p: ProductRow }) {
  return (
    <Link
      href={`/products/${p.product_id}`}
      className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-rose"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{p.brand_name}</span>
      <span className="mt-1 line-clamp-2 text-sm font-medium text-charcoal">{p.product_name}</span>
      <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="font-semibold text-charcoal">{formatUsd(p.sale_price ?? p.price)}</span>
        <span>{p.rating === null ? "Not rated" : `★ ${formatRating(p.rating)}`}</span>
        <span className="inline-flex items-center gap-1">
          <Heart aria-hidden className="h-3 w-3" />
          {formatCompact(p.loves)}
          <span className="sr-only">loves</span>
        </span>
      </span>
    </Link>
  );
}
