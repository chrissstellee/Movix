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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EscrowFulfillmentPanel } from "./escrow-fulfillment-panel";
import { EscrowFundingPanel } from "./escrow-funding-panel";
import { orderAmount, orderStatusLabel } from "./order-format";
import { RefundActionCards } from "./refund-action-cards";
import { RefundProposalModal } from "./refund-proposal-modal";
import { TimeoutCancellationCard } from "./timeout-cancellation-card";

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
  const router = useRouter();
  const detail = useQuery(api.orderDetails.get, { orderId });
  const timeline = usePaginatedQuery(api.orderTimeline.list, { orderId }, { initialNumItems: 20 });
  const shipment = useQuery(api.shipments.get, { orderId });
  const documents = useQuery(api.tradeDocuments.list, { orderId });
  const organizationVerification = useQuery(api.organizationVerification.current);
  const accept = useMutation(api.orderDecisions.accept);
  const reject = useMutation(api.orderDecisions.reject);
  const cancel = useMutation(api.orders.cancel);
  const startRevision = useMutation(api.orderRevisions.startFromCurrent);
  const createDocumentUpload = useMutation(api.tradeDocuments.createUpload);
  const completeDocumentUpload = useMutation(api.tradeDocuments.completeUpload);
  const [pendingDecision, setPendingDecision] = useState<DecisionCommand | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<RejectionReason>("commercial_terms");
  const [rejectionNote, setRejectionNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [message, setMessage] = useState("");
  const [revisionPending, setRevisionPending] = useState(false);
  const [documentType, setDocumentType] = useState("commercial_invoice");
  const [documentVisibility, setDocumentVisibility] = useState<
    "participants" | "importer" | "exporter"
  >("participants");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPending, setDocumentPending] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [decisionNow, setDecisionNow] = useState(() => Date.now());
  const decisionAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  const supplierAcceptanceDeadline = detail?.revision.supplierAcceptanceDeadline;
  useEffect(() => {
    if (supplierAcceptanceDeadline === undefined) return;
    const remaining = supplierAcceptanceDeadline - Date.now();
    if (remaining < 0) {
      if (decisionNow <= supplierAcceptanceDeadline) setDecisionNow(Date.now());
      return;
    }
    const timer = window.setTimeout(
      () => setDecisionNow(Date.now()),
      Math.min(remaining + 1, 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [decisionNow, supplierAcceptanceDeadline]);

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
  const canUploadDocuments = organizationVerification?.status === "verified";
  const decisionExpired =
    supplierAcceptanceDeadline !== undefined && decisionNow > supplierAcceptanceDeadline;

  async function runDecision(command: DecisionCommand) {
    if (loadedDetail.viewerSide !== "supplier" || pendingDecision || decisionExpired) return;
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
    } catch (error) {
      if (convexErrorCode(error) === "ORDER_DECISION_EXPIRED") {
        setDecisionNow(Date.now());
        setAcceptOpen(false);
        setRejectOpen(false);
        setMessage(
          "The decision deadline has passed. Ask the importer to issue a new Trade Order with a future deadline.",
        );
      } else {
        setMessage(
          "The decision was not recorded. Reload if the revision is stale, or retry the identical request.",
        );
      }
    } finally {
      setPendingDecision(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">
            {isSupplier ? "Exporter review" : "Trade order"}
          </p>
          <h1 className="mt-1 text-3xl font-semibold break-words">
            {detail.revision.purchaseOrderNumber ?? "Untitled draft"}
          </h1>
          <p className="mt-2 break-words text-muted-foreground">{detail.revision.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {detail.viewerSide === "buyer" && detail.order.agreementStatus === "draft" ? (
            <Button asChild>
              <Link href={`/orders/new?orderId=${orderId}`}>Edit draft</Link>
            </Button>
          ) : null}
          {["funded", "accepted", "shipped"].includes(detail.order.settlementStatus) ? (
            <Button
              variant="outline"
              className="border-red-500/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => setRefundModalOpen(true)}
            >
              Request Mutual Refund
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href={`/orders?view=${detail.viewerSide}`}>Back to trade orders</Link>
          </Button>
        </div>
      </header>

      <section
        aria-label="Independent trade states"
        className="grid gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4"
      >
        <StateCard title="Trade Agreement" value={orderStatusLabel(detail.order.agreementStatus)} />
        <StateCard title="Escrow" value={detail.order.settlementStatus.replaceAll("_", " ")} />
        <StateCard
          title="Shipment Status"
          value={shipment?.shipment.status.replaceAll("_", " ") ?? "not started"}
        />
        <StateCard
          title="Trade Documents"
          value={
            documents === undefined
              ? "loading"
              : `${documents.length.toString()} document${documents.length === 1 ? "" : "s"}`
          }
        />
      </section>

      <Tabs defaultValue="overview" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">📋 Overview & Terms</TabsTrigger>
          <TabsTrigger value="settlement">💳 Escrow & Settlement</TabsTrigger>
          <TabsTrigger value="documents">📁 Trade Documents</TabsTrigger>
          <TabsTrigger value="history">📜 Audit History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {isSupplier ? (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-sm">
              {detail.offChainNotice}
            </div>
          ) : null}

          {detail.decision ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Decision for revision {detail.decision.revisionNumber.toString()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant="outline">{detail.decision.decision}</Badge>
                <Fact
                  label="Decided at"
                  value={new Date(detail.decision.decidedAt).toLocaleString()}
                />
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

          {isSupplier && detail.canDecide && decisionExpired ? (
            <div
              role="alert"
              className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
            >
              <p className="font-medium">Decision deadline passed</p>
              <p className="mt-1 text-muted-foreground">
                This revision can no longer be accepted or rejected. Ask the importer to cancel the
                expired Trade Order and issue a new one with a future decision deadline.
              </p>
            </div>
          ) : null}

          {isSupplier && detail.canDecide && !decisionExpired ? (
            <Card>
              <CardHeader>
                <CardTitle>Record exporter decision</CardTitle>
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
                        This records an immutable off-chain decision for the displayed terms hash.
                        It does not move funds.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={pendingDecision !== null}>
                        Cancel
                      </AlertDialogCancel>
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
                          <option value="supplier_capacity">Exporter capacity</option>
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
                        <Button
                          type="submit"
                          variant="destructive"
                          disabled={pendingDecision !== null}
                        >
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

          <Card>
            <CardHeader>
              <CardTitle>Frozen agricultural trade agreement</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
              <Fact
                label="Importer"
                value={detail.revision.buyerTradingName ?? detail.revision.buyerLegalName}
              />
              <Fact
                label="Exporter"
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
              <Fact label="Funds moved" value="No — agreement decisions are off-chain" />
              <Fact label="Revision" value={detail.revision.revisionNumber.toString()} />
              <Fact
                label="Terms hash version"
                value={detail.revision.termsHashVersion ?? "order-terms-v1"}
              />
              <Fact
                label="Migration state"
                value={detail.revision.migrationState?.replaceAll("_", " ") ?? "legacy"}
              />
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
                          {formatExactQuantity(line.quantityCoefficient, line.quantityScale)}{" "}
                          {line.unitOfMeasure}
                        </p>
                        <p className="font-mono">{line.lineTotalBaseUnits.toString()} base units</p>
                      </div>
                    </div>
                    {"category" in line ||
                    "varietyOrGrade" in line ||
                    "originCountry" in line ||
                    "packaging" in line ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {[
                          line.category,
                          line.varietyOrGrade,
                          line.specification,
                          line.originCountry,
                          line.packaging,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Route, delivery windows, and Incoterm</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 min-[480px]:grid-cols-2">
              <Fact
                label="Destination country"
                value={detail.revision.destinationCountry ?? "Not set"}
              />
              <Fact
                label="Shipment window"
                value={
                  detail.revision.shipmentWindowFrom && detail.revision.shipmentWindowTo
                    ? `${detail.revision.shipmentWindowFrom} to ${detail.revision.shipmentWindowTo}`
                    : "Not set"
                }
              />
              <Fact
                label="Expected arrival window"
                value={
                  detail.revision.arrivalWindowFrom && detail.revision.arrivalWindowTo
                    ? `${detail.revision.arrivalWindowFrom} to ${detail.revision.arrivalWindowTo}`
                    : "Not set"
                }
              />
              <Fact
                label="Incoterm"
                value={
                  detail.revision.incotermRule
                    ? `${detail.revision.incotermRule} ${detail.revision.incotermNamedPlace ?? ""} (${detail.revision.incotermEdition ?? "Incoterms 2020"})`
                    : "Not set"
                }
              />
              <Fact
                label="Required documents"
                value={detail.revision.requiredDocumentTypes?.join(", ") || "None specified"}
              />
            </CardContent>
          </Card>

          {isSupplier ? (
            <Card>
              <CardHeader>
                <CardTitle>Participant identity and commercial terms</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 min-[480px]:grid-cols-2">
                <Fact
                  label="Importer contact"
                  value={String(
                    detail.revision.buyerContact.email ?? detail.revision.buyerContact.name,
                  )}
                />
                <Fact
                  label="Exporter contact"
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
                <Fact
                  label="Shipping responsibility"
                  value={detail.revision.shippingResponsibility}
                />
                <Fact label="Refund policy" value={detail.revision.refundPolicy} />
                <Fact
                  label="Acceptance criteria"
                  value={detail.revision.acceptanceCriteria ?? "Not specified"}
                />
                <Fact label="Shared notes" value={detail.revision.sharedNotes ?? "None"} />
                <div className="min-w-0 min-[480px]:col-span-2">
                  <span className="block text-xs text-muted-foreground">Terms hash</span>
                  <span className="block font-mono text-xs break-all">
                    {detail.revision.termsHash}
                  </span>
                </div>
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
                  Start revision {Number(detail.revision.revisionNumber) + 1} from the immutable
                  current revision. The exporter must accept the next sent revision again.
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
                      .then((result) => {
                        setMessage(
                          "New draft revision started. Material terms require re-acceptance.",
                        );
                        router.push(`/orders/new?orderId=${result.orderId}`);
                      })
                      .catch(() => setMessage("Could not start a revision. Reload and retry."))
                      .finally(() => setRevisionPending(false));
                  }}
                >
                  {revisionPending ? "Starting revision…" : "Start new revision"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

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
        </TabsContent>

        <TabsContent value="settlement" className="space-y-6">
          <EscrowFundingPanel
            orderId={orderId}
            isBuyer={!isSupplier}
            fundingEligible={detail.order.fundingEligible}
            grandTotalBaseUnits={detail.revision.totals.grandTotalBaseUnits}
            assetCode={detail.revision.asset?.code}
            poNumber={detail.revision.purchaseOrderNumber}
            orderTitle={detail.revision.title}
            revisionNumber={detail.revision.revisionNumber.toString()}
          />

          <EscrowFulfillmentPanel
            orderId={orderId}
            isBuyer={!isSupplier}
            assetCode={detail.revision.asset?.code}
            grandTotalBaseUnits={detail.revision.totals.grandTotalBaseUnits}
          />

          <TimeoutCancellationCard
            orderId={orderId}
            isBuyer={!isSupplier}
            grandTotalFormatted={orderAmount(
              detail.revision.totals.grandTotalBaseUnits,
              detail.revision.asset?.code,
            )}
          />

          <RefundActionCards
            orderId={orderId}
            isBuyer={!isSupplier}
            grandTotalFormatted={orderAmount(
              detail.revision.totals.grandTotalBaseUnits,
              detail.revision.asset?.code,
            )}
          />

          <RefundProposalModal
            orderId={orderId}
            open={refundModalOpen}
            onOpenChange={setRefundModalOpen}
            grandTotalFormatted={orderAmount(
              detail.revision.totals.grandTotalBaseUnits,
              detail.revision.asset?.code,
            )}
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Trade Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Each upload is immutable, digest-bound, access-controlled, and unavailable for
                download until malware scanning marks it clean.
              </p>
              {organizationVerification !== undefined && !canUploadDocuments ? (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
                >
                  <span>Complete organization verification before uploading trade documents.</span>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/settings/business#verification">Complete verification</Link>
                  </Button>
                </div>
              ) : null}
              <form
                className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!documentFile || documentPending || !canUploadDocuments) return;
                  setDocumentPending(true);
                  setMessage("");
                  void (async () => {
                    const digest = await sha256Hex(await documentFile.arrayBuffer());
                    const { uploadUrl } = await createDocumentUpload({ orderId });
                    const response = await fetch(uploadUrl, {
                      method: "POST",
                      headers: { "Content-Type": documentFile.type || "application/octet-stream" },
                      body: documentFile,
                    });
                    if (!response.ok) throw new Error("Storage upload failed");
                    const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
                    await completeDocumentUpload({
                      orderId,
                      storageId,
                      documentType,
                      digest,
                      mimeType: documentFile.type || "application/octet-stream",
                      sizeBytes: BigInt(documentFile.size),
                      visibility: documentVisibility,
                    });
                  })()
                    .then(() => {
                      setDocumentFile(null);
                      setMessage(
                        "Document uploaded. Download remains blocked until scanning is clean.",
                      );
                    })
                    .catch(() =>
                      setMessage(
                        "Document upload failed. Confirm verification, file metadata, and participant access.",
                      ),
                    )
                    .finally(() => setDocumentPending(false));
                }}
              >
                <div>
                  <Label htmlFor="documentType">Document type</Label>
                  <Input
                    id="documentType"
                    value={documentType}
                    maxLength={64}
                    disabled={!canUploadDocuments}
                    onChange={(event) => setDocumentType(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="documentVisibility">Visibility</Label>
                  <select
                    id="documentVisibility"
                    className="h-9 w-full rounded-md border bg-background px-3"
                    value={documentVisibility}
                    disabled={!canUploadDocuments}
                    onChange={(event) =>
                      setDocumentVisibility(
                        event.target.value as "participants" | "importer" | "exporter",
                      )
                    }
                  >
                    <option value="participants">Both participants</option>
                    <option value="importer">Importer only</option>
                    <option value="exporter">Exporter only</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="documentFile">File (maximum 25 MB)</Label>
                  <Input
                    id="documentFile"
                    type="file"
                    disabled={!canUploadDocuments}
                    onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!documentFile || documentPending || !canUploadDocuments}
                >
                  {documentPending ? "Uploading…" : "Upload version"}
                </Button>
              </form>
              {documents === undefined ? (
                <p role="status">Loading documents…</p>
              ) : documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No trade documents uploaded.</p>
              ) : (
                <ul className="space-y-3" aria-label="Trade documents">
                  {documents.map((document) => {
                    const latest = document.versions.at(-1);
                    return (
                      <li key={document.id} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong>{document.documentType.replaceAll("_", " ")}</strong>
                          <Badge variant="outline">{latest?.scanState ?? "pending"}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Version {document.currentVersionNumber.toString()} · {document.visibility}{" "}
                          · {latest ? `${latest.sizeBytes.toString()} bytes` : "metadata pending"}
                        </p>
                        {latest ? (
                          <p className="mt-1 font-mono text-xs break-all">
                            SHA-256 {latest.digest}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
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
                          Revision {group.revisionNumber.toString()} ·{" "}
                          {event.type.replaceAll("_", " ")}
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
        </TabsContent>
      </Tabs>

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

function formatExactQuantity(coefficient: bigint, scale: bigint) {
  if (scale === 0n) return coefficient.toString();
  const digits = coefficient.toString().padStart(Number(scale) + 1, "0");
  const split = digits.length - Number(scale);
  return `${digits.slice(0, split)}.${digits.slice(split)}`;
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function convexErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("data" in error)) return "";
  const data = (error as { data?: unknown }).data;
  if (typeof data !== "object" || data === null || !("code" in data)) return "";
  return String((data as { code?: unknown }).code ?? "");
}
