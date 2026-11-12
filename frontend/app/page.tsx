async function sourceStatus() {
  try {
    const origin = process.env.SEPHORA_API_URL || "http://127.0.0.1:8011";
    const response = await fetch(new URL("/health", origin), {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return "Backend unavailable";
    const health: { status: string; dataset_ready: boolean } = await response.json();
    if (health.status !== "ok") return "Backend unavailable";
    return health.dataset_ready ? "Six dataset files detected" : "Dataset directory needs setup";
  } catch {
    return "Backend unavailable";
  }
}

export default async function Home() {
  const status = await sourceStatus();
  return (
    <main className="min-h-screen bg-surface px-6 py-16 text-charcoal sm:px-12">
      <section className="mx-auto max-w-4xl rounded-3xl border border-rose/30 bg-white p-8 shadow-sm sm:p-14">
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-6xl">Sephora Business Insight</h1>
        <p className="mt-5 max-w-lg leading-relaxed">Catalog and customer review analytics for Sephora.</p>
        <p className="mt-8 inline-flex rounded-full bg-blush px-4 py-2 text-sm font-semibold text-burgundy">{status}</p>
      </section>
    </main>
  );
}
