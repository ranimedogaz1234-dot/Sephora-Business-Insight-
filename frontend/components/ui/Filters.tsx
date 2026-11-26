"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { FormEvent, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Filter bar as a plain GET form: it works without JavaScript, and with JavaScript
 * every select applies immediately (a new filter always returns to page 1).
 */
export function FilterForm({ action, children }: { action: string; children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const go = (form: HTMLFormElement) => {
    const qs = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === "string" && v.trim()) qs.set(k, v.trim());
    const s = qs.toString();
    start(() => router.push(s ? `${action}?${s}` : action, { scroll: false }));
  };

  return (
    <form
      action={action}
      method="get"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        go(e.currentTarget);
      }}
      onChange={(e) => {
        if ((e.target as HTMLElement).tagName === "SELECT") go(e.currentTarget);
      }}
      aria-busy={pending}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-card sm:flex-row sm:flex-wrap sm:items-end"
    >
      {children}
      <span aria-live="polite" className="text-xs text-muted sm:self-center">
        {pending ? "Updating…" : ""}
      </span>
    </form>
  );
}

export function SelectField({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted sm:w-48">
      {label}
      <span className="relative">
        <select
          name={name}
          defaultValue={value}
          key={value}
          className="h-10 w-full appearance-none rounded-xl border border-line bg-white pl-3 pr-9 text-sm text-charcoal hover:border-rose focus:border-burgundy focus:outline-none"
        >
          {children}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </span>
    </label>
  );
}

/** Numeric input (e.g. a price bound); applied with the form's submit button. */
export function NumberField({
  label,
  name,
  value,
  placeholder,
  min = 0,
  max,
  step = 1,
  prefix,
}: {
  label: string;
  name: string;
  value?: number;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted sm:w-28">
      {label}
      <span className="relative">
        {prefix && <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          name={name}
          defaultValue={value ?? ""}
          key={value ?? ""}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className={`h-10 w-full rounded-xl border border-line bg-white ${prefix ? "pl-7" : "pl-3"} pr-2 text-sm text-charcoal placeholder:text-muted hover:border-rose focus:border-burgundy focus:outline-none`}
        />
      </span>
    </label>
  );
}
