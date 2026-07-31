"use client";

import { api, type Id } from "@repo/backend/client";
import { submitAcceptEscrow, submitMarkShipped, submitConfirmDelivery } from "@repo/stellar";
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
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import { orderAmount } from "./order-format";

type FulfillmentPhase =
  | "idle"
  | "preparing"
  | "signing"
  | "submitting"
  | "recording"
  | "success"
  | "error";

export interface EscrowFulfillmentPanelProps {
  orderId: Id<"orders">;
  isBuyer: boolean;
  assetCode?: "XLM" | "USDC";
  grandTotalBaseUnits: bigint;
}

export function EscrowFulfillmentPanel({
  orderId,
  isBuyer,
  assetCode = "USDC",
  grandTotalBaseUnits,
}: EscrowFulfillmentPanelProps) {
  const queryFn = api.escrowFulfillment?.getFulfillmentDetails;
  const fulfillment = useQuery(queryFn ?? ("" as never), queryFn ? { orderId } : "skip");
  const prepareAccept = useMutation(api.escrowFulfillment?.prepareAcceptIntent ?? ("" as never));
  const recordShipment = useMutation(api.escrowFulfillment?.recordShipmentIntent ?? ("" as never));
  const confirmDelivery = useMutation(
    api.escrowFulfillment?.confirmDeliveryIntent ?? ("" as never),
  );
  const recordAcceptSub = useMutation(
    api.escrowFulfillment?.recordAcceptSubmission ?? ("" as never),
  );
  const recordShipmentSub = useMutation(
    api.escrowFulfillment?.recordShipmentSubmission ?? ("" as never),
  );
  const recordReleaseSub = useMutation(
    api.escrowFulfillment?.recordReleaseSubmission ?? ("" as never),
  );

  if (!queryFn) {
    return null;
  }

  const [phase, setPhase] = useState<FulfillmentPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successHash, setSuccessHash] = useState<string | null>(null);

  // Escrow activation confirmation dialog
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);

  // Shipment form state
  const [carrierName, setCarrierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [portOfLoading, setPortOfLoading] = useState("");
  const [portOfDischarge, setPortOfDischarge] = useState("");
  const [shippedDate, setShippedDate] = useState("");
  const [vesselId, setVesselId] = useState("");
  const [phytoCertNumber, setPhytoCertNumber] = useState("");

  // Delivery confirmation form state
  const [receivedDate, setReceivedDate] = useState("");
  const [receivingLocation, setReceivingLocation] = useState("");
  const [inspectionCertNumber, setInspectionCertNumber] = useState("");
  const [inspectionResult, setInspectionResult] = useState<
    "accepted_full" | "accepted_conditional"
  >("accepted_full");
  const [inspectorName, setInspectorName] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // Release confirmation dialog
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);

  const isExporter = !isBuyer;
  const escrowStatus = fulfillment?.escrow?.status ?? "unfunded";
  const amountFormatted = orderAmount(grandTotalBaseUnits, assetCode);

  // Form toggle state (only applicable when status prerequisite is met)
  const [showShipmentFormToggle, setShowShipmentFormToggle] = useState(true);
  const [showDeliveryFormToggle, setShowDeliveryFormToggle] = useState(true);

  // ─── Exporter: Activate Escrow (Funded → Accepted) ───

  async function handleActivateEscrow() {
    setActivateDialogOpen(false);
    setPhase("preparing");
    setErrorMessage(null);
    setSuccessHash(null);

    try {
      const intent = await prepareAccept({ orderId });
      if (!intent || !intent.supplierWalletAddress || !intent.termsHash) {
        throw new Error("Missing supplier wallet or terms hash in activation intent.");
      }
      setPhase("signing");

      const result = await submitAcceptEscrow({
        signerAddress: intent.supplierWalletAddress,
        escrowIdHex: intent.escrowKey,
        supplierWallet: intent.supplierWalletAddress,
        termsHashHex: intent.termsHash,
        contractId: intent.contractId,
      });

      if (!result.success || !result.transactionHash) {
        throw new Error(result.error || "Escrow activation failed.");
      }

      if (recordAcceptSub) {
        await recordAcceptSub({ orderId, transactionHash: result.transactionHash });
      }

      setPhase("success");
      setSuccessHash(result.transactionHash);
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Escrow activation failed.");
    }
  }

  // ─── Exporter: Record Shipment & Mark Shipped ───

  async function handleRecordShipment() {
    if (escrowStatus !== "accepted") {
      setPhase("error");
      setErrorMessage("Escrow must be in accepted status before recording shipment.");
      return;
    }

    setPhase("preparing");
    setErrorMessage(null);
    setSuccessHash(null);

    try {
      const intent = await recordShipment({
        orderId,
        carrierName,
        trackingOrDocumentNumber: trackingNumber,
        phytosanitaryCertNumber: phytoCertNumber || undefined,
        portOfLoading,
        portOfDischarge,
        shippedDate,
        vesselOrFlightId: vesselId || undefined,
      });

      setPhase("signing");

      const result = await submitMarkShipped({
        signerAddress: intent.supplierWalletAddress,
        escrowIdHex: intent.escrowKey,
        supplierWallet: intent.supplierWalletAddress,
        shipmentHashHex: intent.shipmentHash,
        contractId: intent.contractId,
      });

      if (!result.success || !result.transactionHash) {
        throw new Error(result.error || "Mark shipped transaction failed.");
      }

      if (recordShipmentSub) {
        await recordShipmentSub({ orderId, transactionHash: result.transactionHash });
      }

      setPhase("success");
      setSuccessHash(result.transactionHash);
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Shipment recording failed.");
    }
  }

  // ─── Importer: Confirm Delivery & Release ───

  async function handleConfirmDeliveryAndRelease() {
    if (escrowStatus !== "shipped") {
      setPhase("error");
      setErrorMessage(
        "Shipment evidence must be recorded and escrow status must be shipped before confirming delivery & payment release.",
      );
      return;
    }

    setReleaseDialogOpen(false);
    setPhase("preparing");
    setErrorMessage(null);
    setSuccessHash(null);

    try {
      const intent = await confirmDelivery({
        orderId,
        receivedDate,
        receivingLocation,
        inspectionCertificateNumber: inspectionCertNumber || undefined,
        inspectionResult,
        inspectorName,
        notes: deliveryNotes || undefined,
      });

      setPhase("signing");

      const result = await submitConfirmDelivery({
        signerAddress: intent.buyerWalletAddress,
        escrowIdHex: intent.escrowKey,
        buyerWallet: intent.buyerWalletAddress,
        deliveryHashHex: intent.deliveryHash,
        contractId: intent.contractId,
      });

      if (!result.success || !result.transactionHash) {
        throw new Error(result.error || "Delivery confirmation failed.");
      }

      if (recordReleaseSub) {
        await recordReleaseSub({ orderId, transactionHash: result.transactionHash });
      }

      setPhase("success");
      setSuccessHash(result.transactionHash);
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Delivery confirmation failed.");
    }
  }

  const statusBadgeVariant =
    escrowStatus === "released"
      ? "default"
      : escrowStatus === "shipped"
        ? "secondary"
        : escrowStatus === "accepted"
          ? "secondary"
          : "outline";

  const showShipmentForm = isExporter && escrowStatus === "accepted" && showShipmentFormToggle;
  const showDeliveryForm = isBuyer && escrowStatus === "shipped" && showDeliveryFormToggle;

  return (
    <Card className="mt-6 border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Escrow Fulfillment & Settlement</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Escrow activation, shipment recording, delivery confirmation, and payment release
          </p>
        </div>
        <Badge variant={statusBadgeVariant}>
          {(escrowStatus ?? "unfunded").replaceAll("_", " ")}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {/* ── Progress Stepper ── */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div
            className={`rounded border p-2 ${
              ["funded", "funding_submitted", "accepted", "shipped", "released"].includes(
                escrowStatus,
              )
                ? "border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            1. Funded
          </div>
          <div
            className={`rounded border p-2 ${
              ["accepted", "shipped", "released"].includes(escrowStatus)
                ? "border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            2. Activated
          </div>
          <div
            className={`rounded border p-2 ${
              ["shipped", "released"].includes(escrowStatus)
                ? "border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            3. Shipped
          </div>
          <div
            className={`rounded border p-2 ${
              escrowStatus === "released"
                ? "border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            4. Released
          </div>
        </div>

        {/* ── Role-Specific Actions & Toggles ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-y py-2 text-xs">
          <span className="font-medium text-muted-foreground">
            {isExporter ? "Supplier Fulfillment Actions:" : "Buyer Settlement Actions:"}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {isExporter && escrowStatus === "accepted" ? (
              <Button
                type="button"
                size="sm"
                variant={showShipmentFormToggle ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setShowShipmentFormToggle(!showShipmentFormToggle)}
              >
                {showShipmentFormToggle ? "Hide Shipment Form" : "📦 Record Shipment Form"}
              </Button>
            ) : null}
            {isBuyer && escrowStatus === "shipped" ? (
              <Button
                type="button"
                size="sm"
                variant={showDeliveryFormToggle ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setShowDeliveryFormToggle(!showDeliveryFormToggle)}
              >
                {showDeliveryFormToggle
                  ? "Hide Release Form"
                  : "🚢 Confirm Delivery & Release Form"}
              </Button>
            ) : null}
            {isExporter &&
            escrowStatus !== "accepted" &&
            escrowStatus !== "shipped" &&
            escrowStatus !== "released" ? (
              <span className="text-xs text-muted-foreground italic">
                {escrowStatus === "funded" || escrowStatus === "funding_submitted"
                  ? "Escrow funded. Activate escrow below to unlock shipment recording."
                  : "Shipment recording will unlock once escrow is activated."}
              </span>
            ) : null}
            {isBuyer && escrowStatus !== "shipped" && escrowStatus !== "released" ? (
              <span className="text-xs text-muted-foreground italic">
                Delivery confirmation will unlock after supplier records shipment.
              </span>
            ) : null}
          </div>
        </div>

        {/* ── Unfunded State Message ── */}
        {escrowStatus === "unfunded" ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              ⏳ Awaiting Escrow Funding
            </p>
            <p className="mt-1 text-muted-foreground">
              Lock funds in escrow above to activate trade fulfillment. Once funded, the exporter
              activates the escrow and unlocks the Shipment Recording Form.
            </p>
          </div>
        ) : null}
        {/* ── Released / Settlement Receipt ── */}
        {escrowStatus === "released" ? (
          <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                ✓ Settlement Complete — Payment Released
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="block text-muted-foreground">Released Amount</span>
                <span className="font-mono font-medium">
                  {amountFormatted} {assetCode}
                </span>
              </div>
              <div>
                <span className="block text-muted-foreground">Recipient</span>
                <span className="font-medium">Exporter</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Network</span>
                <span className="font-medium capitalize">Testnet</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Contract</span>
                <span className="block truncate font-mono text-[11px]">
                  {fulfillment?.escrow?.contractId}
                </span>
              </div>
              {fulfillment?.escrow?.submittedTransactionHash ? (
                <div className="col-span-2">
                  <span className="block text-muted-foreground">Release Transaction</span>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${fulfillment.escrow.submittedTransactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate font-mono text-primary underline"
                  >
                    {fulfillment.escrow.submittedTransactionHash}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* ── Exporter: Activate Escrow (funded / funding_submitted → accepted) ── */}
        {(escrowStatus === "funded" || escrowStatus === "funding_submitted") && isExporter ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-xs">
              <p className="font-medium text-blue-700 dark:text-blue-400">
                🔒 Escrow Funded — Activate to begin fulfillment
              </p>
              <p className="mt-1 text-muted-foreground">
                The importer has locked {amountFormatted} {assetCode} in escrow. Activate the escrow
                to confirm you accept the trade terms and begin the fulfillment process.
              </p>
            </div>
            <AlertDialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  onClick={() => setActivateDialogOpen(true)}
                  disabled={phase !== "idle" && phase !== "error" && phase !== "success"}
                  className="w-full sm:w-auto"
                >
                  Activate Escrow
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Activate escrow for this trade?</AlertDialogTitle>
                  <AlertDialogDescription asChild className="space-y-2 text-xs">
                    <div>
                      <p>
                        This confirms you accept the trade terms and activates the funded escrow.
                        You will need to sign a Soroban transaction with your wallet. This action
                        transitions the escrow from Funded to Accepted.
                      </p>
                      {fulfillment?.escrow?.supplierWalletAddress ? (
                        <div className="mt-2 rounded bg-muted p-2 font-mono text-[11px]">
                          <span className="block font-sans font-medium text-muted-foreground">
                            Expected Signer (Exporter Wallet):
                          </span>
                          <span className="break-all">
                            {fulfillment.escrow.supplierWalletAddress}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {errorMessage && phase === "error" ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    {errorMessage}
                  </div>
                ) : null}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={phase === "signing" || phase === "submitting"}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={phase === "signing" || phase === "submitting"}
                    onClick={(event) => {
                      event.preventDefault();
                      void handleActivateEscrow();
                    }}
                  >
                    {phase === "signing" || phase === "preparing" ? "Signing…" : "Activate Escrow"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (escrowStatus === "funded" || escrowStatus === "funding_submitted") && isBuyer ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              ⏳ Awaiting Exporter Escrow Activation
            </p>
            <p className="mt-1 text-muted-foreground">
              The exporter must activate the funded escrow before fulfillment can begin.
            </p>
          </div>
        ) : null}

        {/* ── Exporter: Record Shipment (accepted → shipped) ── */}
        {showShipmentForm ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-xs">
              <p className="font-medium text-blue-700 dark:text-blue-400">
                📦 Escrow Accepted — Record Shipment Evidence
              </p>
              <p className="mt-1 text-muted-foreground">
                Record your shipment details and sign the mark_shipped transaction on-chain.
              </p>
            </div>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleRecordShipment();
              }}
            >
              <div>
                <Label htmlFor="carrierName">Carrier / Shipping Line</Label>
                <Input
                  id="carrierName"
                  required
                  maxLength={200}
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="trackingNumber">Bill of Lading / AWB #</Label>
                <Input
                  id="trackingNumber"
                  required
                  maxLength={100}
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="portOfLoading">Port of Loading</Label>
                <Input
                  id="portOfLoading"
                  required
                  maxLength={200}
                  value={portOfLoading}
                  onChange={(e) => setPortOfLoading(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="portOfDischarge">Port of Discharge</Label>
                <Input
                  id="portOfDischarge"
                  required
                  maxLength={200}
                  value={portOfDischarge}
                  onChange={(e) => setPortOfDischarge(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="shippedDate">Shipped Date</Label>
                <Input
                  id="shippedDate"
                  type="date"
                  required
                  value={shippedDate}
                  onChange={(e) => setShippedDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="vesselId">Vessel / Flight ID (optional)</Label>
                <Input
                  id="vesselId"
                  maxLength={100}
                  value={vesselId}
                  onChange={(e) => setVesselId(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="phytoCertNumber">Phytosanitary Certificate # (optional)</Label>
                <Input
                  id="phytoCertNumber"
                  maxLength={100}
                  value={phytoCertNumber}
                  onChange={(e) => setPhytoCertNumber(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={
                    (phase !== "idle" && phase !== "error" && phase !== "success") ||
                    !carrierName ||
                    !trackingNumber ||
                    !portOfLoading ||
                    !portOfDischarge ||
                    !shippedDate
                  }
                  className="w-full sm:w-auto"
                >
                  {phase === "signing" || phase === "preparing"
                    ? "Recording & Signing…"
                    : "Record Shipment & Sign"}
                </Button>
              </div>
            </form>
          </div>
        ) : escrowStatus === "accepted" && isBuyer ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              ⏳ Awaiting Exporter Shipment
            </p>
            <p className="mt-1 text-muted-foreground">
              The exporter must record shipment evidence and sign the mark_shipped transaction.
            </p>
          </div>
        ) : null}

        {/* ── Importer: Confirm Delivery & Release (shipped → released) ── */}
        {showDeliveryForm ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-xs">
              <p className="font-medium text-blue-700 dark:text-blue-400">
                🚢 Goods Shipped — Confirm Delivery to Release Payment
              </p>
              <p className="mt-1 text-muted-foreground">
                Review the shipment, inspect the delivered goods, and confirm delivery. This will
                release {amountFormatted} {assetCode} to the exporter. This action is irreversible.
              </p>
            </div>

            {fulfillment?.shipment ? (
              <div className="rounded-lg border p-3 text-xs">
                <p className="font-semibold">Shipment Evidence</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <span className="block text-muted-foreground">Carrier</span>
                    <span>{fulfillment.shipment.carrier}</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground">Tracking #</span>
                    <span className="font-mono">{fulfillment.shipment.trackingNumber}</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground">Shipped At</span>
                    <span>
                      {fulfillment.shipment.shippedAt
                        ? new Date(fulfillment.shipment.shippedAt).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground">Status</span>
                    <Badge variant="outline" className="capitalize">
                      {fulfillment.shipment.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-muted-foreground">Shipment Hash</span>
                    <span className="block truncate font-mono text-[11px]">
                      {fulfillment.shipment.shipmentHash}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                setReleaseDialogOpen(true);
              }}
            >
              <div>
                <Label htmlFor="receivedDate">Received Date</Label>
                <Input
                  id="receivedDate"
                  type="date"
                  required
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="receivingLocation">Receiving Location</Label>
                <Input
                  id="receivingLocation"
                  required
                  maxLength={200}
                  value={receivingLocation}
                  onChange={(e) => setReceivingLocation(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="inspectorName">Inspector Name</Label>
                <Input
                  id="inspectorName"
                  required
                  maxLength={200}
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="inspectionResult">Inspection Result</Label>
                <select
                  id="inspectionResult"
                  className="h-9 w-full rounded-md border bg-background px-3"
                  value={inspectionResult}
                  onChange={(e) =>
                    setInspectionResult(e.target.value as "accepted_full" | "accepted_conditional")
                  }
                >
                  <option value="accepted_full">Accepted — Full</option>
                  <option value="accepted_conditional">Accepted — Conditional</option>
                </select>
              </div>
              <div>
                <Label htmlFor="inspectionCertNumber">Inspection Certificate # (optional)</Label>
                <Input
                  id="inspectionCertNumber"
                  maxLength={100}
                  value={inspectionCertNumber}
                  onChange={(e) => setInspectionCertNumber(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="deliveryNotes">Notes (optional)</Label>
                <Textarea
                  id="deliveryNotes"
                  maxLength={500}
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={
                    (phase !== "idle" && phase !== "error" && phase !== "success") ||
                    !receivedDate ||
                    !receivingLocation ||
                    !inspectorName
                  }
                  className="w-full sm:w-auto"
                >
                  Confirm Delivery & Release Payment
                </Button>
              </div>
            </form>

            <AlertDialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Release {amountFormatted} {assetCode} to the Exporter?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This action is irreversible. Confirming delivery will release the full escrow
                    amount to the exporter&apos;s wallet via the Soroban smart contract. The escrow
                    status will transition from Shipped to Released.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={phase === "signing" || phase === "submitting"}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={phase === "signing" || phase === "submitting"}
                    onClick={(event) => {
                      event.preventDefault();
                      void handleConfirmDeliveryAndRelease();
                    }}
                  >
                    {phase === "signing" || phase === "preparing"
                      ? "Signing Release…"
                      : `Release ${amountFormatted} ${assetCode}`}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : escrowStatus === "shipped" && isExporter ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              ⏳ Awaiting Importer Delivery Confirmation
            </p>
            <p className="mt-1 text-muted-foreground">
              The importer must confirm delivery and release {amountFormatted} {assetCode} to your
              wallet.
            </p>
          </div>
        ) : null}

        {/* ── Transaction Feedback ── */}
        {phase === "success" && successHash ? (
          <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              ✓ Transaction confirmed on Stellar Testnet
            </p>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${successHash}`}
              target="_blank"
              rel="noreferrer"
              className="block truncate font-mono text-xs text-primary underline"
            >
              {successHash}
            </a>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {errorMessage}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
