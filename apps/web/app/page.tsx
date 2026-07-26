import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center font-sans">
      <h1 className="text-4xl font-bold tracking-tight">Welcome to Movix</h1>
      <p className="mt-2 text-muted-foreground">
        Explore the application routes and components below.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        <Link
          href="/template"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Starter Template (/template)
        </Link>
        <Link
          href="/todo"
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Todo App (/todo)
        </Link>
      </div>
    </main>
  );
}
