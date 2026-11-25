"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Info, LayoutDashboard, Menu, MessageSquareHeart, ShoppingBag, X } from "lucide-react";

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: ShoppingBag },
  { href: "/reviews", label: "Reviews", icon: MessageSquareHeart },
  { href: "/about", label: "About", icon: Info },
] as const;

export const isActive = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

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
    <ul className="space-y-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(href, pathname);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 items-center gap-3 rounded-xl px-4 text-sm transition-colors ${
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
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-screen bg-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white px-5 py-6 lg:flex">
        <Brand />
        <nav aria-label="Main" className="mt-10 flex-1">
          <NavLinks />
        </nav>
        <p className="rounded-xl bg-blush px-4 py-3 text-xs leading-relaxed text-burgundy-dark">
          Real Sephora catalogue and review data.
        </p>
      </aside>

      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
        <Brand />
        <button
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
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 right-0 w-72 max-w-[85vw] bg-white px-5 py-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-lg text-charcoal">Menu</span>
              <button
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
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
