"use client";

import { api, type Id } from "@repo/backend/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

import { orderAmount, orderStatusLabel } from "./order-format";

export function OrderDetail({ orderId: rawOrderId }: { orderId: string }) {
  const orderId = rawOrderId as Id<"orders">;
  const detail = useQuery(api.orders.getById, { orderId });
  const cancel = useMutation(api.orders.cancel);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  if (detail === undefined) return <p role="status">Loading order…</p>;

  const canCancel =
    ["draft", "sent"].includes(detail.order.agreementStatus) &&
    detail.order.settlementStatus === "unfunded";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Purchase order</p>
          <h1 className="mt-1 text-3xl font-semibold">
            {detail.revision.purchaseOrderNumber ?? "Untitled draft"}
          </h1>
          <p className="mt-2 text-muted-foreground">{detail.revision.title}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/orders">Back to orders</Link>
        </Button>
      </header>

      <section aria-label="Order states" className="grid gap-4 sm:grid-cols-3">
        <StateCard title="Agreement" value={orderStatusLabel(detail.order.agreementStatus)} />
        <StateCard
          title="Fulfillment"
          value={detail.order.fulfillmentStatus.replaceAll("_", " ")}
        />
        <StateCard title="Settlement" value={detail.order.settlementStatus.replaceAll("_", " ")} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Frozen commercial snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Fact label="Supplier" value={detail.revision.supplierLegalName ?? "Not selected"} />
          <Fact label="Issue date" value={detail.revision.issueDate ?? "Not set"} />
          <Fact
            label="Requested delivery"
            value={detail.revision.requestedDeliveryDate ?? "Not set"}
          />
          <Fact label="Timezone" value={detail.revision.timezone ?? "Not set"} />
          <Fact label="Asset" value={detail.revision.asset?.code ?? "Not selected"} />
          <Fact
            label="Total"
            value={orderAmount(
              detail.revision.totals.grandTotalBaseUnits,
              detail.revision.asset?.code,
            )}
            mono
          />
          <Fact label="Network" value="Stellar Testnet" />
          <Fact label="Funds moved" value="No — Sprint 4 is off-chain" />
          <Fact label="Revision" value={detail.revision.version.toString()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2">Line</th>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th className="text-right">Total (base units)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {detail.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-3">{line.lineNumber.toString()}</td>
                    <td>{line.name}</td>
                    <td>
                      {line.quantityCoefficient.toString()} {line.unitOfMeasure}
                    </td>
                    <td className="text-right font-mono">{line.lineTotalBaseUnits.toString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 sm:hidden">
            {detail.lines.map((line) => (
              <li key={line.id} className="rounded-md border p-3">
                <Fact label={`Line ${line.lineNumber.toString()}`} value={line.name} />
                <div className="mt-2">
                  <Fact
                    label="Quantity"
                    value={`${line.quantityCoefficient.toString()} ${line.unitOfMeasure}`}
                  />
                </div>
                <div className="mt-2">
                  <Fact
                    label="Total (base units)"
                    value={line.lineTotalBaseUnits.toString()}
                    mono
                  />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 border-l pl-5 text-sm">
            <li>
              <strong>Draft created</strong>
              <span className="block text-muted-foreground">
                Commercial terms began as an organization-owned server draft.
              </span>
            </li>
            {detail.revision.frozenAt ? (
              <li>
                <strong>Sent and frozen</strong>
                <span className="block text-muted-foreground">
                  {new Date(detail.revision.frozenAt).toLocaleString()}
                </span>
              </li>
            ) : null}
            {detail.order.agreementStatus === "cancelled" ? (
              <li>
                <strong>Cancelled</strong>
              </li>
            ) : null}
          </ol>
        </CardContent>
      </Card>

      {canCancel ? (
        <Card>
          <CardHeader>
            <CardTitle>Cancel order</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                setMessage("");
                void cancel({
                  orderId,
                  expectedVersion: detail.order.version,
                  idempotencyKey: crypto.randomUUID(),
                  reasonCode: "buyer_cancelled",
                  reasonDetails: reason || undefined,
                })
                  .then(() => setMessage("Order cancelled."))
                  .catch(() => setMessage("Cancellation failed. Reload and retry."));
              }}
            >
              <div className="min-w-64 flex-1">
                <Label htmlFor="cancelReason">Reason</Label>
                <Input
                  id="cancelReason"
                  value={reason}
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
              <Button type="submit" variant="destructive">
                Cancel order
              </Button>
            </form>
            {message ? (
              <p role="status" className="mt-3 text-sm">
                {message}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StateCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Badge variant="outline" className="capitalize">
          {value}
        </Badge>
      </CardContent>
    </Card>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-sm" : "text-sm"}>{value}</span>
    </div>
  );
}
