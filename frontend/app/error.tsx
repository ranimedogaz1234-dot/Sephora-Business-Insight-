"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-burgundy">Something went wrong</p>
      <h1 className="mt-2 font-display text-3xl text-charcoal">This page could not be displayed</h1>
      <p className="mt-2 text-sm text-muted">Check that the analytics service is running, then try again.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-10 rounded-xl bg-burgundy px-5 text-sm font-medium text-white hover:bg-burgundy-dark"
      >
        Try again
      </button>
    </div>
  );
}
