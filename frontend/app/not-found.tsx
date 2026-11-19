import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-burgundy">404</p>
      <h1 className="mt-2 font-display text-3xl text-charcoal">Page not found</h1>
      <p className="mt-2 text-sm text-muted">The page you are looking for does not exist.</p>
      <Link href="/" className="mt-6 h-10 rounded-xl bg-burgundy px-5 text-sm font-medium leading-10 text-white hover:bg-burgundy-dark">
        Back to the dashboard
      </Link>
    </div>
  );
}
