import { CircleAlert, CircleCheck, Info, TrendingDown } from "lucide-react";
import type { Observation, Tone } from "@/lib/api";

const ICONS: Record<Tone, typeof Info> = {
  neutral: Info,
  positive: CircleCheck,
  warning: CircleAlert,
  negative: TrendingDown,
};
const ICON_COLOR: Record<Tone, string> = {
  neutral: "text-burgundy",
  positive: "text-[#1F6B3A]",
  warning: "text-[#7A5300]",
  negative: "text-[#9B1C1C]",
};
const TONE_LABEL: Record<Tone, string> = {
  neutral: "Observation",
  positive: "Strength",
  warning: "Watch",
  negative: "Concern",
};

/** Observations computed by the API; the tone is spelled out, not only coloured. */
export function ObservationList({ items }: { items: Observation[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((o) => {
        const Icon = ICONS[o.tone];
        return (
          <li key={o.id} className="flex gap-3 rounded-xl border border-line px-4 py-3">
            <Icon aria-hidden className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_COLOR[o.tone]}`} strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{TONE_LABEL[o.tone]}</p>
              <p className="text-sm font-semibold text-charcoal">{o.title}</p>
              <p className="mt-0.5 text-sm text-muted">{o.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
