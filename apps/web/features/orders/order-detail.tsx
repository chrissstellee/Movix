"use client";

import { api, type Id } from "@repo/backend/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/ui/alert-dialog";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import Link from "next/link";
import { useRef, useState } from "react";

import { orderAmount, orderStatusLabel } from "./order-format";

type DecisionCommand = "accept" | "reject";
type RejectionReason =
  | "pricing_or_totals"
  | "quantity_or_availability"
  | "delivery_schedule"
  | "commercial_terms"
  | "supplier_capacity"
  | "other";

export function OrderDetail({ orderId: rawOrderId }: { orderId: string }) {
  const orderId = rawOrderId as Id<"orders">;
  const detail = useQuery(api.orderDetails.get, { orderId });
  const timeline = usePaginatedQuery(api.orderTimeline.list, { orderId }, { initialNumItems: 20 });
  const accept = useMutation(api.orderDecisions.accept);
  const reject = useMutation(api.orderDecisions.reject);
  const cancel = useMutation(api.orders.cancel);
  const startRevision = useMutation(api.orderRevisions.startFromCurrent);
  const [pendingDecision, setPendingDecision] = useState<DecisionCommand | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<RejectionReason>("commercial_terms");
  const [rejectionNote, setRejectionNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [message, setMessage] = useState("");
  const [revisionPending, setRevisionPending] = useState(false);
  const decisionAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  if (detail === undefined) return <p role="status">Loading order…</p>;
  const loadedDetail = detail;

  const isSupplier = detail.viewerSide === "supplier";
  const canCancel =
    detail.viewerSide === "buyer" &&
    ["draft", "sent"].includes(detail.order.agreementStatus) &&
    detail.order.settlementStatus === "unfunded";
  const canRevise =
    detail.viewerSide === "buyer" &&
    ["accepted", "rejected"].includes(detail.order.agreementStatus) &&
    detail.order.settlementStatus === "unfunded";

  async function runDecision(command: DecisionCommand) {
    if (loadedDetail.viewerSide !== "supplier" || pendingDecision) return;
    const note = command === "reject" ? rejectionNote.trim() || undefined : undefined;
    const fingerprint = JSON.stringify({
      command,
      orderId,
      revisionId: loadedDetail.revision.id,
      orderVersion: loadedDetail.order.version.toString(),
      revisionVersion: loadedDetail.revision.version.toString(),
      termsHash: loadedDetail.revision.termsHash,
      reasonCode: command === "reject" ? rejectionReason : undefined,
      note,
    });
    if (decisionAttempt.current?.fingerprint !== fingerprint) {
      decisionAttempt.current = { fingerprint, key: crypto.randomUUID() };
    }
    const idempotencyKey = decisionAttempt.current.key;
    setPendingDecision(command);
    setMessage("");
    try {
      if (command === "accept") {
        await accept({
          orderId,
          revisionId: loadedDetail.revision.id,
          expectedOrderVersion: loadedDetail.order.version,
          expectedRevisionVersion: loadedDetail.revision.version,
          expectedTermsHash: loadedDetail.revision.termsHash,
          idempotencyKey,
        });
        setAcceptOpen(false);
        setMessage(`Revision ${loadedDetail.revision.revisionNumber.toString()} accepted.`);
      } else {
        await reject({
          orderId,
          revisionId: loadedDetail.revision.id,
          expectedOrderVersion: loadedDetail.order.version,
          expectedRevisionVersion: loadedDetail.revision.version,
          expectedTermsHash: loadedDetail.revision.termsHash,
          idempotencyKey,
          reasonCode: rejectionReason,
          ...(note ? { reasonNote: note } : {}),
        });
        setRejectOpen(false);
        setMessage(`Revision ${loadedDetail.revision.revisionNumber.toString()} rejected.`);
      }
      decisionAttempt.current = null;
    } catch {
      setMessage(
        "The decision was not recorded. Reload if the revision is stale, or retry the identical request.",
      );
    } finally {
      setPendingDecision(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">
            {isSupplier ? "Supplier review" : "Purchase order"}
          </p>
          <h1 className="mt-1 text-3xl font-semibold break-words">
            {detail.revision.purchaseOrderNumber ?? "Untitled draft"}
          </h1>
          <p className="mt-2 break-words text-muted-foreground">{detail.revision.title}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/orders?view=${detail.viewerSide}`}>Back to orders</Link>
        </Button>
      </header>

      <section aria-label="Order states" className="grid gap-4 min-[480px]:grid-cols-3">
        <StateCard title="Agreement" value={orderStatusLabel(detail.order.agreementStatus)} />
        <StateCard
          title="Fulfillment"
          value={detail.order.fulfillmentStatus.replaceAll("_", " ")}
        />
        <StateCard title="Settlement" value={detail.order.settlementStatus.replaceAll("_", " ")} />
      </section>

      {isSupplier ? (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-sm">
          {detail.offChainNotice}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Frozen commercial snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
          <Fact
            label="Buyer"
            value={detail.revision.buyerTradingName ?? detail.revision.buyerLegalName}
          />
          <Fact
            label="Supplier"
            value={
              detail.revision.supplierTradingName ??
              detail.revision.supplierLegalName ??
              "Not selected"
            }
          />
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
          <Fact label="Funds moved" value="No — Sprint 5 decisions are off-chain" />
          <Fact label="Revision" value={detail.revision.revisionNumber.toString()} />
          <Fact
            label="Decision deadline"
            value={
              detail.revision.supplierAcceptanceDeadline
                ? new Date(detail.revision.supplierAcceptanceDeadline).toLocaleString()
                : "Not set"
            }
          />
          <Fact label="Funding eligible" value={detail.order.fundingEligible ? "Yes" : "No"} />
        </CardContent>
      </Card>

      {isSupplier ? (
        <Card>
          <CardHeader>
            <CardTitle>Identity, delivery, and terms</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 min-[480px]:grid-cols-2">
            <Fact
              label="Buyer contact"
              value={String(
                detail.revision.buyerContact.email ?? detail.revision.buyerContact.name,
              )}
            />
            <Fact
              label="Supplier contact"
              value={String(
                detail.revision.supplierContact.email ?? detail.revision.supplierContact.name,
              )}
            />
            <Fact
              label="Billing address"
              value={`${detail.revision.billingAddress.line1 ?? ""}, ${detail.revision.billingAddress.city ?? ""}`}
            />
            <Fact
              label="Shipping address"
              value={`${detail.revision.shippingAddress.line1 ?? ""}, ${detail.revision.shippingAddress.city ?? ""}`}
            />
            <Fact label="Delivery method" value={detail.revision.deliveryMethod} />
            <Fact label="Shipping responsibility" value={detail.revision.shippingResponsibility} />
            <Fact label="Refund policy" value={detail.revision.refundPolicy} />
            <Fact
              label="Acceptance criteria"
              value={detail.revision.acceptanceCriteria ?? "Not specified"}
            />
            <Fact label="Shared notes" value={detail.revision.sharedNotes ?? "None"} />
            <div className="min-w-0 min-[480px]:col-span-2">
              <span className="block text-xs text-muted-foreground">Terms hash</span>
              <span className="block font-mono text-xs break-all">{detail.revision.termsHash}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3" aria-label="Order lines">
            {detail.lines.map((line) => (
              <li key={line.id} className="rounded-md border p-3">
                <div className="grid gap-3 min-[520px]:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <p className="font-medium break-words">
                      {line.lineNumber.toString()}. {line.name}
                    </p>
                    <p className="mt-1 text-sm break-words text-muted-foreground">
                      {line.description ?? "No description"}
                    </p>
                  </div>
                  <div className="text-left text-sm min-[520px]:text-right">
                    <p>
                      {line.quantityCoefficient.toString()} {line.unitOfMeasure}
                    </p>
                    <p className="font-mono">{line.lineTotalBaseUnits.toString()} base units</p>
                  </div>
                </div>
                {isSupplier && ("category" in line || "manufacturer" in line) ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {[line.category, line.manufacturer, line.brand, line.origin]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {detail.decision ? (
        <Card>
          <CardHeader>
            <CardTitle>Decision for revision {detail.decision.revisionNumber.toString()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="outline">{detail.decision.decision}</Badge>
            <Fact label="Decided at" value={new Date(detail.decision.decidedAt).toLocaleString()} />
            <Fact label="Actor wallet" value={detail.decision.actorWalletAddress} mono />
            {detail.decision.reasonCode ? (
              <Fact label="Reason" value={detail.decision.reasonCode.replaceAll("_", " ")} />
            ) : null}
            {detail.decision.reasonNote ? (
              <Fact label="Decision note" value={detail.decision.reasonNote} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isSupplier && detail.canDecide ? (
        <Card>
          <CardHeader>
            <CardTitle>Record supplier decision</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 min-[420px]:flex-row">
            <AlertDialog open={acceptOpen} onOpenChange={setAcceptOpen}>
              <AlertDialogTrigger asChild>
                <Button disabled={pendingDecision !== null}>Accept revision</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Accept revision {detail.revision.revisionNumber.toString()}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This records an immutable off-chain decision for the displayed terms hash. It
                    does not move funds.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pendingDecision !== null}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={pendingDecision !== null}
                    onClick={(event) => {
                      event.preventDefault();
                      void runDecision("accept");
                    }}
                  >
                    {pendingDecision === "accept"
                      ? "Accepting…"
                      : `Accept revision ${detail.revision.revisionNumber.toString()}`}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" disabled={pendingDecision !== null}>
                  Reject revision
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    Reject revision {detail.revision.revisionNumber.toString()}
                  </DialogTitle>
                  <DialogDescription>
                    Select the canonical reason. The optional note is visible only in authorized
                    decision detail.
                  </DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runDecision("reject");
                  }}
                >
                  <div className="space-y-1">
                    <Label htmlFor="rejectionReason">Reason</Label>
                    <select
                      id="rejectionReason"
                      className="h-9 w-full rounded-md border bg-background px-3"
                      value={rejectionReason}
                      onChange={(event) =>
                        setRejectionReason(event.target.value as RejectionReason)
                      }
                    >
                      <option value="pricing_or_totals">Pricing or totals</option>
                      <option value="quantity_or_availability">Quantity or availability</option>
                      <option value="delivery_schedule">Delivery schedule</option>
                      <option value="commercial_terms">Commercial terms</option>
                      <option value="supplier_capacity">Supplier capacity</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rejectionNote">Optional note</Label>
                    <Textarea
                      id="rejectionNote"
                      maxLength={500}
                      value={rejectionNote}
                      onChange={(event) => setRejectionNote(event.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pendingDecision !== null}
                      onClick={() => setRejectOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="destructive" disabled={pendingDecision !== null}>
                      {pendingDecision === "reject"
                        ? "Rejecting…"
                        : `Reject revision ${detail.revision.revisionNumber.toString()}`}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : null}

      {canRevise ? (
        <Card>
          <CardHeader>
            <CardTitle>Revise commercial terms</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Start revision {Number(detail.revision.revisionNumber) + 1} from the immutable current
              revision. The supplier must accept the next sent revision again.
            </p>
            <Button
              className="mt-4"
              disabled={revisionPending}
              onClick={() => {
                setRevisionPending(true);
                setMessage("");
                void startRevision({
                  orderId,
                  expectedOrderVersion: detail.order.version,
                  expectedRevisionId: detail.revision.id,
                  idempotencyKey: crypto.randomUUID(),
                })
                  .then(() => setMessage("New draft revision started."))
                  .catch(() => setMessage("Could not start a revision. Reload and retry."))
                  .finally(() => setRevisionPending(false));
              }}
            >
              {revisionPending ? "Starting revision…" : "Start new revision"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Canonical history</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.status === "LoadingFirstPage" ? (
            <p role="status">Loading history…</p>
          ) : (
            <ol className="space-y-4 border-l pl-5 text-sm">
              {timeline.results.flatMap((group) =>
                group.events.map((event) => (
                  <li key={event.id}>
                    <strong>
                      Revision {group.revisionNumber.toString()} · {event.type.replaceAll("_", " ")}
                    </strong>
                    <span className="block text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </li>
                )),
              )}
            </ol>
          )}
          {timeline.status === "CanLoadMore" || timeline.status === "LoadingMore" ? (
            <Button
              className="mt-4"
              variant="outline"
              disabled={timeline.status === "LoadingMore"}
              onClick={() => timeline.loadMore(20)}
            >
              {timeline.status === "LoadingMore" ? "Loading…" : "Load older history"}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {canCancel ? (
        <Card>
          <CardHeader>
            <CardTitle>Cancel order</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 min-[520px]:grid-cols-[1fr_auto] min-[520px]:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                setMessage("");
                void cancel({
                  orderId,
                  expectedVersion: detail.order.version,
                  idempotencyKey: crypto.randomUUID(),
                  reasonCode: "buyer_cancelled",
                  reasonDetails: cancelReason || undefined,
                })
                  .then(() => setMessage("Order cancelled."))
                  .catch(() => setMessage("Cancellation failed. Reload and retry."));
              }}
            >
              <div className="min-w-0">
                <Label htmlFor="cancelReason">Reason</Label>
                <Input
                  id="cancelReason"
                  value={cancelReason}
                  maxLength={500}
                  onChange={(event) => setCancelReason(event.target.value)}
                />
              </div>
              <Button type="submit" variant="destructive">
                Cancel order
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
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
    <div className="min-w-0">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className={`block text-sm break-words ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
