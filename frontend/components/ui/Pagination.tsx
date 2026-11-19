import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatInteger } from "@/lib/format";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  noun: string;
  /** Builds the link for a page number. */
  href: (page: number) => string;
}

export function Pagination({ page, totalPages, total, pageSize, noun, href }: PaginationProps) {
  if (total === 0) return null;
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);
  const link = "inline-flex h-10 items-center gap-1 rounded-xl px-4 text-sm font-medium transition-colors";
  return (
    <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        {page > totalPages
          ? "This page is past the end of the results."
          : `${formatInteger(from)}–${formatInteger(to)} of ${formatInteger(total)} ${noun}`}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(Math.min(page - 1, totalPages))} className={`${link} border border-line text-charcoal hover:bg-blush`}>
            <ChevronLeft aria-hidden className="h-4 w-4" /> Previous
          </Link>
        ) : (
          <span aria-disabled className={`${link} border border-line text-muted opacity-50`}>
            <ChevronLeft aria-hidden className="h-4 w-4" /> Previous
          </span>
        )}
        <span className="px-2 text-sm tabular-nums text-muted">
          Page {formatInteger(Math.min(page, totalPages))} of {formatInteger(totalPages)}
        </span>
        {page < totalPages ? (
          <Link href={href(page + 1)} className={`${link} bg-burgundy text-white hover:bg-burgundy-dark`}>
            Next <ChevronRight aria-hidden className="h-4 w-4" />
          </Link>
        ) : (
          <span aria-disabled className={`${link} bg-burgundy text-white opacity-40`}>
            Next <ChevronRight aria-hidden className="h-4 w-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
