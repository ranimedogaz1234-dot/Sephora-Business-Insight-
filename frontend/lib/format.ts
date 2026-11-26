const integer = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const formatInteger = (n: number) => integer.format(n);
/** 1.1M, 49K — exact below 10,000 so small numbers stay precise. */
export const formatCompact = (n: number) => (Math.abs(n) < 10_000 ? integer.format(n) : compact.format(n));
export const formatPercent = (ratio: number, digits = 1) => `${(ratio * 100).toFixed(digits)}%`;
export const formatRating = (n: number) => n.toFixed(2);
export const formatUsd = (n: number) => usd.format(n);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2021-03" -> "Mar 2021", "2021" -> "2021". */
export function formatPeriod(period: string): string {
  const [y, m] = period.split("-");
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : y;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Named number formats. Server pages pass the name to client charts (functions cannot
 * cross the server/client boundary).
 */
export const VALUE_FORMATS = {
  integer: formatInteger,
  compact: formatCompact,
  percent: (n: number) => formatPercent(n, 0),
  percent1: (n: number) => formatPercent(n, 1),
  rating: formatRating,
  usd: formatUsd,
  usd2: (n: number) => `$${n.toFixed(2)}`,
  decimal2: (n: number) => n.toFixed(2),
} as const;
export type ValueFormat = keyof typeof VALUE_FORMATS;
export const formatValue = (n: number, f: ValueFormat) => VALUE_FORMATS[f](n);
