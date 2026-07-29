"use client";

import { api } from "@repo/backend/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { useQuery } from "convex/react";
import Link from "next/link";

import { orderAmount, orderStatusLabel } from "./order-format";
import { hasVerifiedSupplierAccess, SupplierAccessUnavailable } from "./supplier-access";

export function SupplierDashboard() {
  const context = useQuery(api.organizations.currentContext, {});
  const verifiedSupplierAccess = hasVerifiedSupplierAccess(context);
  const summary = useQuery(api.supplierOrders.getSummary, verifiedSupplierAccess ? {} : "skip");

  if (context === undefined || (verifiedSupplierAccess && summary === undefined)) {
    return <p role="status">Loading supplier dashboard…</p>;
  }
  if (
    context?.kind === "ready" &&
    context.allowedViews.includes("supplier") &&
    !verifiedSupplierAccess
  ) {
    return <SupplierAccessUnavailable />;
  }
  if (!verifiedSupplierAccess || summary === undefined) return null;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-primary">Supplier</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Supplier workspace</h1>
        <p className="mt-2 text-muted-foreground">
          Review frozen purchase-order revisions and record off-chain decisions.
        </p>
      </header>

      {summary.blockers.length > 0 ? (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base">Profile readiness</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {summary.blockers.map((blocker) => (
                <li key={blocker.field}>{blocker.message}</li>
              ))}
            </ul>
            <Button asChild className="mt-4" size="sm" variant="outline">
              <Link href="/settings/business">Review business profile</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section
        aria-label="Supplier order counts"
        className="grid gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4"
      >
        <CountCard
          label="Requires decision"
          count={summary.counts.requiresDecision}
          href="/orders?view=supplier&queue=requires_decision"
        />
        <CountCard
          label="Expired"
          count={summary.counts.expired}
          href="/orders?view=supplier&queue=expired"
        />
        <CountCard
          label="Accepted"
          count={summary.counts.accepted}
          href="/orders?view=supplier&queue=accepted"
        />
        <CountCard
          label="Rejected"
          count={summary.counts.rejected}
          href="/orders?view=supplier&queue=rejected"
        />
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Recent incoming orders</CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link href="/orders?view=supplier">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {summary.recentIncoming.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="font-medium">No orders require a decision</p>
              <p className="mt-1 text-sm text-muted-foreground">
                New frozen revisions will appear here when a buyer sends them.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {summary.recentIncoming.map((order) => (
                <li key={order.orderId}>
                  <Link
                    href={`/orders/${order.orderId}?view=supplier`}
                    className="grid gap-3 py-4 hover:underline min-[520px]:grid-cols-[1fr_auto]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {order.purchaseOrderNumber ?? "Purchase order"}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {order.buyerName} · Revision {order.revisionNumber.toString()}
                      </span>
                    </span>
                    <span className="text-left min-[520px]:text-right">
                      <Badge variant="outline">{orderStatusLabel(order.agreementStatus)}</Badge>
                      <span className="mt-1 block font-mono text-sm tabular-nums">
                        {orderAmount(order.grandTotalBaseUnits, order.assetCode)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CountCard({ label, count, href }: { label: string; count: bigint; href: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3">
        <span className="font-mono text-3xl font-semibold tabular-nums">{count.toString()}</span>
        <Button asChild size="sm" variant="outline">
          <Link href={href}>Open</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
