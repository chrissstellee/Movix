"use client";

import { api, type Id } from "@repo/backend/client";
import { requestFreighterSignature } from "@repo/stellar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import { TransactionReview } from "../transactions/transaction-review";

import { orderAmount } from "./order-format";

export interface EscrowFundingPanelProps {
  orderId: Id<"orders">;
  isBuyer: boolean;
  fundingEligible: boolean;
  grandTotalBaseUnits: bigint;
  assetCode?: "XLM" | "USDC";
  poNumber?: string;
  orderTitle?: string;
  revisionNumber: string;
}

export function EscrowFundingPanel({
  orderId,
  isBuyer,
  fundingEligible,
  grandTotalBaseUnits,
  assetCode = "USDC",
  poNumber,
  orderTitle,
  revisionNumber,
}: EscrowFundingPanelProps) {
  const escrowData = useQuery(api.escrowFunding.getForOrder, { orderId });
  const prepareFunding = useMutation(api.escrowFunding.prepare);
  const recordSubmission = useMutation(api.escrowFunding.recordSubmission);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preparedIntent, setPreparedIntent] = useState<Awaited<
    ReturnType<typeof prepareFunding>
  > | null>(null);

  async function handleStartFunding() {
    setErrorMessage(null);
    try {
      const intent = await prepareFunding({ orderId });
      setPreparedIntent(intent);
      setReviewOpen(true);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to prepare escrow funding intent.",
      );
    }
  }

  async function handleConfirmAndSign() {
    if (!preparedIntent) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Wallet signing simulation & submission
      // Request Freighter wallet signature for simulation payload
      const signResult = await requestFreighterSignature({
        contractId: preparedIntent.contractId,
        buyerWallet: preparedIntent.buyerWalletAddress,
        amountBaseUnits: preparedIntent.grandTotalBaseUnits,
      });

      if (!signResult.success || !signResult.transactionHash) {
        throw new Error(signResult.error || "Wallet signing was rejected or failed.");
      }

      await recordSubmission({
        orderId,
        escrowKey: preparedIntent.escrowKey,
        transactionHash: signResult.transactionHash,
      });

      setReviewOpen(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Transaction signing or submission failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const status = escrowData?.status ?? "unfunded";
  const amountFormatted = orderAmount(grandTotalBaseUnits, assetCode);

  return (
    <Card className="mt-6 border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Stellar Escrow Funding</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Soroban smart contract trade settlement
          </p>
        </div>
        <Badge
          variant={
            status === "funded"
              ? "default"
              : status === "funding_submitted"
                ? "secondary"
                : status === "needs_reconciliation"
                  ? "destructive"
                  : "outline"
          }
        >
          {status.replaceAll("_", " ")}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {status === "funded" && escrowData ? (
          <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                ✓ Confirmed On-Chain Escrow Receipt
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Ledger #{escrowData.confirmedLedger?.toString() ?? "Confirmed"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="block text-muted-foreground">Locked Amount</span>
                <span className="font-mono font-medium">
                  {amountFormatted} {assetCode}
                </span>
              </div>
              <div>
                <span className="block text-muted-foreground">Network</span>
                <span className="font-medium capitalize">Testnet</span>
              </div>
              <div className="col-span-2">
                <span className="block text-muted-foreground">Transaction Hash</span>
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${escrowData.submittedTransactionHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate font-mono text-primary underline"
                >
                  {escrowData.submittedTransactionHash}
                </a>
              </div>
              <div className="col-span-2">
                <span className="block text-muted-foreground">Escrow Contract ID</span>
                <span className="block truncate font-mono text-xs">{escrowData.contractId}</span>
              </div>
            </div>
          </div>
        ) : status === "funding_submitted" ? (
          <div className="space-y-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
            <p className="font-medium text-blue-700 dark:text-blue-400">
              ⏳ Transaction Submitted to Stellar Testnet
            </p>
            <p className="text-xs text-muted-foreground">
              Finality reconciliation in progress. Once confirmed by Soroban RPC, status will update
              to Funded.
            </p>
            {escrowData?.submittedTransactionHash ? (
              <p className="font-mono text-xs text-muted-foreground">
                Tx: {escrowData.submittedTransactionHash}
              </p>
            ) : null}
          </div>
        ) : status === "needs_reconciliation" ? (
          <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              ⚠️ Reconciliation Required
            </p>
            <p className="text-xs text-muted-foreground">
              On-chain escrow facts or transaction finality require manual/operations review.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Once an accepted Trade Order revision is reached, the Importer can lock exact trade
              value in escrow.
            </p>
            {isBuyer ? (
              <Button
                disabled={!fundingEligible}
                onClick={handleStartFunding}
                className="w-full sm:w-auto"
              >
                Lock Funds in Escrow ({amountFormatted} {assetCode})
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Awaiting Importer escrow funding action.
              </p>
            )}
          </div>
        )}

        {errorMessage ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {errorMessage}
          </div>
        ) : null}

        {preparedIntent ? (
          <TransactionReview
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            orderTitle={orderTitle}
            poNumber={poNumber}
            revisionNumber={revisionNumber}
            amountFormatted={amountFormatted}
            assetCode={preparedIntent.assetCode}
            importerWallet={preparedIntent.buyerWalletAddress}
            exporterWallet={preparedIntent.supplierWalletAddress}
            contractId={preparedIntent.contractId}
            termsHash={preparedIntent.termsHashHex}
            network="testnet"
            onConfirm={handleConfirmAndSign}
            isSubmitting={isSubmitting}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
