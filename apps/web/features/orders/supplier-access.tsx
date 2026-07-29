import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import Link from "next/link";

type SupplierAccessContext =
  | null
  | undefined
  | { kind: "multiple" }
  | {
      kind: "ready";
      allowedViews: Array<"buyer" | "supplier">;
      organization: { verificationStatus: string };
    };

export function hasVerifiedSupplierAccess(context: SupplierAccessContext) {
  return (
    context?.kind === "ready" &&
    context.allowedViews.includes("supplier") &&
    context.organization.verificationStatus === "verified"
  );
}

export function SupplierAccessUnavailable() {
  return (
    <Card className="mx-auto max-w-xl border-amber-500/40">
      <CardHeader>
        <CardTitle>
          <h1>Supplier access unavailable</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Your organization must be verified before supplier orders and decision summaries can be
          viewed.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/settings/business">Review business profile</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
