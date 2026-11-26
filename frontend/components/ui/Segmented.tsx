import Link from "next/link";

/**
 * A row of mutually exclusive links (sort orders, views, time scales) that keep the
 * current URL filters. Works without JavaScript; the active option has aria-current.
 */
export function SegmentedLinks({
  label,
  options,
  active,
  href,
}: {
  label: string;
  options: Record<string, string>;
  active: string;
  href: (value: string) => string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {Object.entries(options).map(([value, text]) => {
        const current = value === active;
        return (
          <Link
            key={value}
            href={href(value)}
            aria-current={current ? "true" : undefined}
            scroll={false}
            className={`h-9 rounded-full px-4 text-sm leading-9 transition-colors ${
              current ? "bg-burgundy text-white" : "border border-line text-muted hover:bg-blush hover:text-burgundy"
            }`}
          >
            {text}
          </Link>
        );
      })}
    </nav>
  );
}
