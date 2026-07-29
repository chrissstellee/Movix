"use client";

import { api } from "@repo/backend/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { usePaginatedQuery, useQuery } from "convex/react";
import Link from "next/link";

import { orderAmount, orderStatusLabel } from "./order-format";

export function BuyerDashboard() {
  const summary = useQuery(api.orderDashboard.getBuyerSummary, {});
  const notifications = usePaginatedQuery(
    api.notifications.listCurrentOrganization,
    { status: "unread" },
    { initialNumItems: 5 },
  );

  if (summary === undefined) {
    return <p role="status">Loading buyer dashboard…</p>;
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Buyer</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Buyer workspace</h1>
          <p className="mt-2 text-muted-foreground">
            Draft purchase orders and track supplier responses.
          </p>
        </div>
        {summary.canCreate ? (
          <Button asChild>
            <Link href="/orders/new">Create order</Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href={summary.blockers[0]?.settingsPath ?? "/settings/business"}>
              Complete buyer profile
            </Link>
          </Button>
        )}
      </header>

      <section aria-label="Order attention" className="grid gap-4 sm:grid-cols-2">
        <AttentionCard
          label="Drafts needing completion"
          count={summary.counts.draft}
          href="/orders?status=draft"
        />
        <AttentionCard
          label="Awaiting supplier"
          count={summary.counts.sent}
          href="/orders?status=sent"
        />
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>Supplier decisions</CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link href="/orders?view=buyer">View orders</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {notifications.status === "LoadingFirstPage" ? (
            <p role="status">Loading supplier decisions…</p>
          ) : notifications.results.filter((item) =>
              ["order.accepted", "order.rejected"].includes(item.eventType),
            ).length === 0 ? (
            <p className="text-sm text-muted-foreground">No unread supplier decisions.</p>
          ) : (
            <ul className="divide-y" aria-label="Unread supplier decisions">
              {notifications.results
                .filter((item) => ["order.accepted", "order.rejected"].includes(item.eventType))
                .map((item) => (
                  <li key={item.id}>
                    <Link
                      className="flex flex-wrap items-center justify-between gap-3 py-3 hover:underline"
                      href={`${item.actionUrl}?view=buyer`}
                    >
                      <span>
                        Order {item.eventType === "order.accepted" ? "accepted" : "rejected"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>Recent order activity</CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link href="/orders">View all orders</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {summary.recent.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="font-medium">No purchase orders yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a server-side draft to begin your first order.
              </p>
              {summary.canCreate ? (
                <Button asChild className="mt-4">
                  <Link href="/orders/new">Create first order</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="divide-y">
              {summary.recent.map((order) => (
                <li key={order.orderId}>
                  <Link
                    href={`/orders/${order.orderId}`}
                    className="flex flex-wrap items-center justify-between gap-3 py-4 hover:underline"
                  >
                    <span>
                      <span className="block font-medium">
                        {order.purchaseOrderNumber ?? "Untitled draft"}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {order.supplierName ?? "Supplier not selected"}
                      </span>
                    </span>
                    <span className="text-right">
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

function AttentionCard({ label, count, href }: { label: string; count: bigint; href: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-4">
        <span className="font-mono text-4xl font-semibold tabular-nums">{count.toString()}</span>
        <Button asChild size="sm" variant="outline">
          <Link href={href}>Open</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
