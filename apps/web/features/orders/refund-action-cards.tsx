"use client";

import { api, type Id } from "@repo/backend/client";
import { submitApproveRefund, submitRejectRefund } from "@repo/stellar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

export interface RefundActionCardsProps {
  orderId: Id<"orders">;
  isBuyer: boolean;
  grandTotalFormatted: string;
}

export function RefundActionCards({
  orderId,
  isBuyer,
  grandTotalFormatted,
}: RefundActionCardsProps) {
  const activeRequest = useQuery(api.refunds.getActiveRefundRequest, { orderId });
  const approveRefund = useMutation(api.refunds.approveRefundIntent);
  const rejectRefund = useMutation(api.refunds.rejectRefundIntent);
  const withdrawRefund = useMutation(api.refunds.withdrawRefundIntent);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!activeRequest) {
    return null;
  }

  const isCounterparty = isBuyer
    ? activeRequest.counterpartyOrganizationId !== activeRequest.requestedByOrganizationId
    : activeRequest.requestedByOrganizationId !== activeRequest.counterpartyOrganizationId;

  async function handleApprove() {
    if (!activeRequest) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Build, simulate, sign via Freighter, and submit approve_refund to Stellar Testnet
      const approverWallet = isBuyer
        ? activeRequest.buyerWalletAddress
        : activeRequest.supplierWalletAddress;

      if (!approverWallet) {
        throw new Error("Approver wallet address not found.");
      }

      const result = await submitApproveRefund({
        signerAddress: approverWallet,
        escrowIdHex: activeRequest.escrowKey,
        approverWallet,
        refundTermsHashHex: activeRequest.termsHash,
        contractId: activeRequest.contractId,
      });

      if (!result.success || !result.transactionHash) {
        throw new Error(result.error || "Refund approval transaction failed.");
      }

      await approveRefund({
        orderId,
        termsHash: activeRequest.termsHash,
        txHash: result.transactionHash,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    if (!activeRequest) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Build, simulate, sign via Freighter, and submit reject_refund to Stellar Testnet
      const approverWallet = isBuyer
        ? activeRequest.buyerWalletAddress
        : activeRequest.supplierWalletAddress;

      if (!approverWallet) {
        throw new Error("Approver wallet address not found.");
      }

      const result = await submitRejectRefund({
        signerAddress: approverWallet,
        escrowIdHex: activeRequest.escrowKey,
        approverWallet,
        refundTermsHashHex: activeRequest.termsHash,
        contractId: activeRequest.contractId,
      });

      if (!result.success) {
        throw new Error(result.error || "Refund rejection transaction failed.");
      }

      await rejectRefund({
        orderId,
        termsHash: activeRequest.termsHash,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWithdraw() {
    if (!activeRequest) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await withdrawRefund({
        orderId,
        termsHash: activeRequest.termsHash,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mt-6 border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <span>Mutual Refund Pending</span>
            <Badge
              variant="outline"
              className="border-amber-500 text-amber-600 dark:text-amber-400"
            >
              Action Required
            </Badge>
          </CardTitle>
          <CardDescription>
            A full refund of{" "}
            <span className="font-semibold text-foreground">{grandTotalFormatted}</span> has been
            requested.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-2">
        {errorMessage && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="space-y-1 rounded-md border bg-background/60 p-3 text-sm">
          <p>
            <span className="font-medium text-muted-foreground">Reason Code:</span>{" "}
            <span className="font-semibold">{activeRequest.reasonCode}</span>
          </p>
          <p className="font-mono text-xs break-all text-muted-foreground">
            Terms Hash: {activeRequest.termsHash}
          </p>
        </div>

        {isCounterparty ? (
          <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              Review terms carefully. Approving will immediately return 100% of locked tokens to the
              Importer.
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial"
              >
                {isSubmitting ? "Processing..." : "Reject Refund"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleApprove}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial"
              >
                {isSubmitting ? "Approving..." : "Approve Refund"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Waiting for counterparty response. You can withdraw your request before they act.
            </p>
            <Button variant="outline" size="sm" onClick={handleWithdraw} disabled={isSubmitting}>
              {isSubmitting ? "Withdrawing..." : "Withdraw Request"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
