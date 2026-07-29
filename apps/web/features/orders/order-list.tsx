"use client";

import { api } from "@repo/backend/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { usePaginatedQuery, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { orderAmount, orderStatusLabel } from "./order-format";
import { hasExporterAccess, SupplierAccessUnavailable } from "./supplier-access";

type AgreementFilter = "draft" | "sent" | "accepted" | "rejected" | "cancelled";
type AssetFilter = "testnet:XLM" | "testnet:USDC";
type SupplierQueueFilter = "not_queued" | "requires_decision" | "expired" | "accepted" | "rejected";

const validStatuses = new Set<AgreementFilter>([
  "draft",
  "sent",
  "accepted",
  "rejected",
  "cancelled",
]);
const validAssets = new Set<AssetFilter>(["testnet:XLM", "testnet:USDC"]);
const validSupplierQueues = new Set<SupplierQueueFilter>([
  "not_queued",
  "requires_decision",
  "expired",
  "accepted",
  "rejected",
]);

export function OrderList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const context = useQuery(api.organizations.currentContext, {});
  const allowedViews = context?.kind === "ready" ? context.allowedViews : [];
  const exporterAccess = hasExporterAccess(context);
  const requestedView = searchParams.get("view");
  const view: "buyer" | "supplier" | undefined =
    context?.kind !== "ready"
      ? undefined
      : requestedView === "supplier" && allowedViews.includes("supplier")
        ? exporterAccess
          ? "supplier"
          : undefined
        : allowedViews.includes("buyer")
          ? "buyer"
          : exporterAccess
            ? "supplier"
            : undefined;
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
  const rawQueue = searchParams.get("queue");
  const queueState =
    rawQueue && validSupplierQueues.has(rawQueue as SupplierQueueFilter)
      ? (rawQueue as SupplierQueueFilter)
      : undefined;
  const orders = usePaginatedQuery(
    api.orders.listBuyerOrders,
    view === "buyer"
      ? {
          ...(status ? { status } : {}),
          ...(assetKey ? { assetKey } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
        }
      : "skip",
    { initialNumItems: 20 },
  );
  const supplierOrders = usePaginatedQuery(
    api.supplierOrders.list,
    view === "supplier" ? { ...(queueState ? { queueState } : {}) } : "skip",
    { initialNumItems: 20 },
  );

  function setFilter(name: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    router.replace(`/orders${next.size ? `?${next.toString()}` : ""}`);
  }

  if (context === undefined) return <p role="status">Loading Trade Order view…</p>;
  if (
    context?.kind === "ready" &&
    context.allowedViews.includes("supplier") &&
    !exporterAccess &&
    view === undefined
  ) {
    return <SupplierAccessUnavailable />;
  }
  if (context?.kind !== "ready" || view === undefined) return null;

  if (view === "supplier") {
    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Exporter</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Trade Orders</h1>
            <p className="mt-2 text-muted-foreground">
              Review frozen revisions and revisit canonical decisions.
            </p>
          </div>
          {allowedViews.length > 1 ? <ViewSwitch view="supplier" /> : null}
        </header>

        <label htmlFor="supplier-queue-filter" className="block max-w-sm space-y-1 text-sm">
          <span>Decision state</span>
          <select
            id="supplier-queue-filter"
            className="h-9 w-full rounded-md border bg-background px-3"
            value={queueState ?? ""}
            onChange={(event) => setFilter("queue", event.target.value)}
          >
            <option value="">All Exporter Trade Orders</option>
            <option value="requires_decision">Requires decision</option>
            <option value="expired">Expired</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>

        {supplierOrders.status === "LoadingFirstPage" ? (
          <p role="status">Loading Exporter Trade Orders…</p>
        ) : supplierOrders.results.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="font-medium">No Exporter Trade Orders match this view.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                New revisions appear after an Importer sends and freezes them.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3" aria-label="Exporter Trade Orders">
            {supplierOrders.results.map((order) => (
              <li key={order.orderId}>
                <Card>
                  <CardContent className="grid gap-4 p-4 min-[560px]:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <Link
                        className="font-medium hover:underline"
                        href={`/orders/${order.orderId}?view=supplier`}
                      >
                        {order.purchaseOrderNumber ?? "Trade Order"}
                      </Link>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {order.buyerName} · Revision {order.revisionNumber.toString()}
                      </p>
                      <p className="mt-1 text-sm">{order.title ?? "No title"}</p>
                    </div>
                    <div className="text-left min-[560px]:text-right">
                      <Badge variant="outline">
                        {order.supplierQueueState.replaceAll("_", " ")}
                      </Badge>
                      <p className="mt-2 font-mono text-sm tabular-nums">
                        {orderAmount(order.grandTotalBaseUnits, order.assetCode)}
                      </p>
                      <Button asChild className="mt-3" size="sm" variant="outline">
                        <Link href={`/orders/${order.orderId}?view=supplier`}>
                          {order.supplierQueueState === "requires_decision"
                            ? "Review Trade Order"
                            : "View decision"}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {supplierOrders.status === "CanLoadMore" || supplierOrders.status === "LoadingMore" ? (
          <Button
            variant="outline"
            disabled={supplierOrders.status === "LoadingMore"}
            onClick={() => supplierOrders.loadMore(20)}
          >
            {supplierOrders.status === "LoadingMore" ? "Loading…" : "Load more"}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Importer trade operations</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Trade Orders</h1>
          <p className="mt-2 text-muted-foreground">
            Browse organization-scoped agricultural trades and independent lifecycle states.
          </p>
        </div>
        <Button asChild>
          <Link href="/orders/new">Create Trade Order</Link>
        </Button>
        {allowedViews.length > 1 ? <ViewSwitch view="buyer" /> : null}
      </header>

      <section
        aria-label="Trade Order filters"
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-4"
      >
        <label htmlFor="order-status-filter" className="space-y-1 text-sm">
          <span>Trade Agreement status</span>
          <select
            id="order-status-filter"
            aria-label="Trade Agreement status"
            className="h-9 w-full rounded-md border bg-background px-3"
            value={status ?? ""}
            onChange={(event) => setFilter("status", event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Awaiting Exporter</option>
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
        <p role="status">Loading Trade Orders…</p>
      ) : orders.results.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium">No Trade Orders match these filters.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clear filters or create a Trade Order.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {["Trade Order", "Exporter", "Title", "Issue date", "Total", "Status"].map(
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
          <ul className="space-y-3 md:hidden" aria-label="Trade Orders">
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
                    <OrderFact label="Exporter" value={order.supplierName ?? "Not selected"} />
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

function ViewSwitch({ view }: { view: "buyer" | "supplier" }) {
  return (
    <div className="flex rounded-md border p-1" aria-label="Trade Order view">
      <Button asChild size="sm" variant={view === "buyer" ? "default" : "ghost"}>
        <Link href="/orders?view=buyer">Importer</Link>
      </Button>
      <Button asChild size="sm" variant={view === "supplier" ? "default" : "ghost"}>
        <Link href="/orders?view=supplier">Exporter</Link>
      </Button>
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
