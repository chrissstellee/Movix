"use client";

import { api } from "@repo/backend/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { orderAmount, orderStatusLabel } from "./order-format";

type AgreementFilter = "draft" | "sent" | "accepted" | "rejected" | "cancelled";
type AssetFilter = "testnet:XLM" | "testnet:USDC";

const validStatuses = new Set<AgreementFilter>([
  "draft",
  "sent",
  "accepted",
  "rejected",
  "cancelled",
]);
const validAssets = new Set<AssetFilter>(["testnet:XLM", "testnet:USDC"]);

export function OrderList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStatus = searchParams.get("status");
  const rawAsset = searchParams.get("asset");
  const status =
    rawStatus && validStatuses.has(rawStatus as AgreementFilter)
      ? (rawStatus as AgreementFilter)
      : undefined;
  const assetKey =
    rawAsset && validAssets.has(rawAsset as AssetFilter) ? (rawAsset as AssetFilter) : undefined;
  const dateFrom = safeDate(searchParams.get("from"));
  const dateTo = safeDate(searchParams.get("to"));
  const orders = usePaginatedQuery(
    api.orders.listBuyerOrders,
    {
      ...(status ? { status } : {}),
      ...(assetKey ? { assetKey } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    },
    { initialNumItems: 20 },
  );

  function setFilter(name: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    router.replace(`/orders${next.size ? `?${next.toString()}` : ""}`);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Buyer procurement</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-2 text-muted-foreground">
            Browse organization-scoped purchase orders and commercial states.
          </p>
        </div>
        <Button asChild>
          <Link href="/orders/new">Create order</Link>
        </Button>
      </header>

      <section
        aria-label="Order filters"
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-4"
      >
        <label htmlFor="order-status-filter" className="space-y-1 text-sm">
          <span>Order status</span>
          <select
            id="order-status-filter"
            aria-label="Order status"
            className="h-9 w-full rounded-md border bg-background px-3"
            value={status ?? ""}
            onChange={(event) => setFilter("status", event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Awaiting supplier</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label htmlFor="order-asset-filter" className="space-y-1 text-sm">
          <span>Asset</span>
          <select
            id="order-asset-filter"
            aria-label="Order asset"
            className="h-9 w-full rounded-md border bg-background px-3"
            value={assetKey ?? ""}
            onChange={(event) => setFilter("asset", event.target.value)}
          >
            <option value="">All assets</option>
            <option value="testnet:XLM">XLM</option>
            <option value="testnet:USDC">USDC</option>
          </select>
        </label>
        <label htmlFor="issue-date-from" className="space-y-1 text-sm">
          <span>Issue date from</span>
          <Input
            id="issue-date-from"
            type="date"
            value={dateFrom ?? ""}
            onChange={(event) => setFilter("from", event.target.value)}
          />
        </label>
        <label htmlFor="issue-date-to" className="space-y-1 text-sm">
          <span>Issue date to</span>
          <Input
            id="issue-date-to"
            type="date"
            value={dateTo ?? ""}
            onChange={(event) => setFilter("to", event.target.value)}
          />
        </label>
      </section>

      {orders.status === "LoadingFirstPage" ? (
        <p role="status">Loading orders…</p>
      ) : orders.results.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium">No orders match these filters.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clear filters or create a purchase order.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {["PO number", "Supplier", "Title", "Issue date", "Total", "Status"].map(
                    (heading) => (
                      <th key={heading} scope="col" className="px-4 py-3 font-medium">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.results.map((order) => (
                  <tr key={order.orderId}>
                    <td className="px-4 py-3 font-medium">
                      <Link className="hover:underline" href={`/orders/${order.orderId}`}>
                        {order.purchaseOrderNumber ?? "Untitled draft"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{order.supplierName ?? "Not selected"}</td>
                    <td className="px-4 py-3">{order.title ?? "—"}</td>
                    <td className="px-4 py-3">{order.issueDate ?? "—"}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {orderAmount(order.grandTotalBaseUnits, order.assetCode)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{orderStatusLabel(order.agreementStatus)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden" aria-label="Orders">
            {orders.results.map((order) => (
              <li key={order.orderId}>
                <Card>
                  <CardContent className="grid gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        className="font-medium hover:underline"
                        href={`/orders/${order.orderId}`}
                      >
                        {order.purchaseOrderNumber ?? "Untitled draft"}
                      </Link>
                      <Badge variant="outline">{orderStatusLabel(order.agreementStatus)}</Badge>
                    </div>
                    <OrderFact label="Supplier" value={order.supplierName ?? "Not selected"} />
                    <OrderFact label="Title" value={order.title ?? "—"} />
                    <OrderFact label="Issue date" value={order.issueDate ?? "—"} />
                    <OrderFact
                      label="Total"
                      value={orderAmount(order.grandTotalBaseUnits, order.assetCode)}
                      mono
                    />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {orders.status === "CanLoadMore" || orders.status === "LoadingMore" ? (
        <Button
          variant="outline"
          disabled={orders.status === "LoadingMore"}
          onClick={() => orders.loadMore(20)}
        >
          {orders.status === "LoadingMore" ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}

function OrderFact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-sm tabular-nums" : "text-sm"}>{value}</span>
    </div>
  );
}

function safeDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : undefined;
}
