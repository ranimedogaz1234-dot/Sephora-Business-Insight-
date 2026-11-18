export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading…</span>
      <div className="h-3 w-24 rounded bg-blush" />
      <div className="mt-3 h-9 w-80 max-w-full rounded-lg bg-surface" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-surface" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-36 rounded-2xl bg-surface" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="h-80 rounded-2xl bg-surface" />
        <div className="h-80 rounded-2xl bg-surface" />
      </div>
    </div>
  );
}
