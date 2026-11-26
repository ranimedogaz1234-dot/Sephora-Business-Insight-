"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronRight, Database, Menu, X } from "lucide-react";
import { NAV_SECTIONS, breadcrumbs, isActive } from "@/lib/nav";

export { NAV, isActive } from "@/lib/nav";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-lg" aria-label="Sephora Business Insight home">
      <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-burgundy font-display text-xl text-white">
        S
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg text-charcoal">Sephora</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-muted">Business Insight</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="space-y-6">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{section.title}</p>
          <ul className="space-y-1">
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href, pathname);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-10 items-center gap-3 rounded-xl px-4 text-sm transition-colors ${
                      active ? "bg-burgundy font-medium text-white shadow-card" : "text-muted hover:bg-blush hover:text-burgundy"
                    }`}
                  >
                    <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Section › Page (› Details) trail, shown in the desktop header. */
export function Breadcrumbs() {
  const trail = breadcrumbs(usePathname());
  if (!trail.length) return null;
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        {trail.map((step, i) => (
          <li key={`${step.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight aria-hidden className="h-3 w-3" />}
            {step.href ? (
              <Link href={step.href} className="hover:text-burgundy">
                {step.label}
              </Link>
            ) : (
              <span aria-current={i === trail.length - 1 ? "page" : undefined} className={i === trail.length - 1 ? "font-medium text-charcoal" : ""}>
                {step.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const DATA_SCOPE = "Catalogue: all categories · Reviews: Skincare";

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = menuButton.current;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      // Keep Tab inside the open dialog.
      if (e.key === "Tab" && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([tabindex='-1'])");
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-white">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-burgundy px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto border-r border-line bg-white px-5 py-6 lg:flex">
        <Brand />
        <nav aria-label="Main" className="mt-8 flex-1">
          <NavLinks />
        </nav>
        <p className="mt-6 rounded-xl bg-blush px-4 py-3 text-xs leading-relaxed text-burgundy-dark">
          Real Sephora catalogue and review data. Review figures cover Skincare products only.
        </p>
      </aside>

      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
        <Brand />
        <button
          ref={menuButton}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="grid h-10 w-10 place-items-center rounded-xl text-charcoal hover:bg-blush"
        >
          <Menu aria-hidden className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-charcoal/30"
          />
          <div
            ref={panel}
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 right-0 w-72 max-w-[85vw] overflow-y-auto bg-white px-5 py-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-lg text-charcoal">Menu</span>
              <button
                ref={closeButton}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-10 w-10 place-items-center rounded-xl hover:bg-blush"
              >
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Mobile" className="mt-6">
              <NavLinks onNavigate={() => setOpen(false)} />
            </nav>
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 hidden h-14 items-center justify-between gap-4 border-b border-line bg-white/90 px-10 backdrop-blur lg:flex">
          <Breadcrumbs />
          <p className="flex items-center gap-2 text-xs text-muted">
            <Database aria-hidden className="h-3.5 w-3.5 text-burgundy" strokeWidth={1.75} />
            {DATA_SCOPE}
          </p>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-8 outline-none sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
