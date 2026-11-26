import { Star } from "lucide-react";

/** Five stars with the score announced as text (the icons are decorative). */
export function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const filled = Math.round(rating);
  const cls = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span role="img" aria-label={`${Number.isInteger(rating) ? rating : rating.toFixed(1)} out of 5 stars`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={`${cls} ${i <= filled ? "fill-burgundy text-burgundy" : "fill-none text-line"}`}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}
