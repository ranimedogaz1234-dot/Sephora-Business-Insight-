import type { ReactNode } from "react";
import { Info } from "lucide-react";

/** States what a section's figures cover (e.g. "Reviews cover Skincare products only"). */
export function ScopeNote({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-start gap-2 rounded-xl bg-surface px-4 py-3 text-xs leading-relaxed text-muted ${className}`}>
      <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-burgundy" strokeWidth={1.75} />
      <span>{children}</span>
    </p>
  );
}
