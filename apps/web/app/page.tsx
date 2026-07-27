import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 font-sans">
      <section className="w-full max-w-2xl rounded-2xl border bg-card p-8 shadow-2xl shadow-black/20 sm:p-12">
        <p className="text-sm font-semibold tracking-[0.2em] text-primary uppercase">
          Movix foundation
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
          Procurement that settles with certainty.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
          Sprint 0 establishes the lifecycle, authorization, data, Stellar, testing, and design
          contracts for the testnet MVP.
        </p>
        {process.env.NODE_ENV !== "production" && (
          <Link
            href="/foundation"
            className="bg-brand-gradient mt-8 inline-flex h-10 items-center rounded-md px-5 text-sm font-medium text-white shadow-lg shadow-primary/20 transition hover:brightness-110 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Review foundation components
          </Link>
        )}
      </section>
    </main>
  );
}
