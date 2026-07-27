import Link from "next/link";

export default function AccessUnavailablePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center p-6">
      <h1 className="text-3xl font-semibold">Workspace access needs support</h1>
      <p className="mt-3 text-muted-foreground">
        Movix cannot choose between multiple active organization memberships. No organization was
        selected.
      </p>
      <Link className="mt-6 underline" href="/">
        Return home
      </Link>
    </main>
  );
}
