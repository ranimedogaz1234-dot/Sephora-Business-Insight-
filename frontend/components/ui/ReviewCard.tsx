import Link from "next/link";
import { ThumbsUp } from "lucide-react";
import type { ReviewCardData } from "@/lib/api";
import { formatDate, formatInteger, truncate } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Stars } from "@/components/ui/Stars";

/** One customer review. Reviewer identifiers are never part of the data. */
export function ReviewCard({
  r,
  product,
  maxLength = 280,
}: {
  r: ReviewCardData;
  product?: { id: string; name: string; brand: string };
  maxLength?: number;
}) {
  return (
    <Card className="flex flex-col">
      <article className="flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-3">
          <Stars rating={r.rating} />
          <time dateTime={r.date} className="text-xs text-muted">
            {formatDate(r.date)}
          </time>
        </div>
        {r.title && <h3 className="mt-3 font-semibold text-charcoal">{r.title}</h3>}
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
          {r.text ? truncate(r.text, maxLength) : <em>No review text.</em>}
        </p>
        <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
          {product && (
            <Link href={`/products/${product.id}`} className="font-medium text-charcoal hover:text-burgundy">
              {product.name}
            </Link>
          )}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {product && <span>{product.brand}</span>}
            {r.skin_type && <span>Skin: {r.skin_type}</span>}
            {r.recommended !== null && (
              <span className={r.recommended ? "text-burgundy" : ""}>{r.recommended ? "Recommends" : "Does not recommend"}</span>
            )}
            {r.helpful_votes > 0 && (
              <span className="inline-flex items-center gap-1">
                <ThumbsUp aria-hidden className="h-3 w-3" />
                <span>
                  {formatInteger(r.helpful_votes)}
                  <span className="sr-only"> people found this helpful</span>
                </span>
              </span>
            )}
          </p>
        </div>
      </article>
    </Card>
  );
}
