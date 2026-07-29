"use client";

import { Button } from "@repo/ui/components/ui/button";

export default function SupplierError({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-lg border p-6" role="alert">
      <h1 className="text-xl font-semibold">Supplier workspace unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your session may have expired, or the supplier data could not be loaded.
      </p>
      <Button className="mt-4" onClick={reset}>
        Reload
      </Button>
    </div>
  );
}
