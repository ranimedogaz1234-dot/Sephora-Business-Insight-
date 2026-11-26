import type { ReactNode } from "react";

const TONES = {
  neutral: "bg-surface text-muted",
  brand: "bg-blush text-burgundy-dark",
  positive: "bg-[#E8F3EC] text-[#1F6B3A]",
  negative: "bg-[#FBEAEA] text-[#9B1C1C]",
  warning: "bg-[#FDF3DC] text-[#7A5300]",
} as const;

export type Tone = keyof typeof TONES;

/** Small label. Colour is never the only signal: the text always states the meaning. */
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
