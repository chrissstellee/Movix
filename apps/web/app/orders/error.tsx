"use client";

import { Button } from "@repo/ui/components/ui/button";

export default function OrdersError({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-lg border p-8 text-center">
      <h1 className="text-2xl font-semibold">Orders could not be loaded</h1>
      <p className="mt-2 text-muted-foreground">
        Your data was not changed. Check your session and try again.
      </p>
      <Button className="mt-5" variant="outline" onClick={reset}>
        Retry
      </Button>
    </div>
  );
}
