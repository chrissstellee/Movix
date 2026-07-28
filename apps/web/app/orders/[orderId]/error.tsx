"use client";

import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";

export default function OrderAccessError({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-lg border p-8 text-center">
      <h1 className="text-2xl font-semibold">Order unavailable</h1>
      <p className="mt-2 text-muted-foreground">
        This order does not exist or is not available to your active organization.
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <Button variant="outline" onClick={reset}>
          Retry
        </Button>
        <Button asChild>
          <Link href="/orders">Back to orders</Link>
        </Button>
      </div>
    </div>
  );
}
