"use client";

import { api, type Id } from "@repo/backend/client";
import { requestFreighterSignature } from "@repo/stellar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

export interface TimeoutCancellationCardProps {
  orderId: Id<"orders">;
  isBuyer: boolean;
  grandTotalFormatted: string;
}

export function TimeoutCancellationCard({
  orderId,
  isBuyer,
  grandTotalFormatted,
}: TimeoutCancellationCardProps) {
  const eligibility = useQuery(api.refunds.checkCancellationEligibility, { orderId });
  const cancelUnaccepted = useMutation(api.refunds.cancelUnacceptedIntent);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isBuyer || !eligibility?.isEligible) {
    return null;
  }

  async function handleCancelUnaccepted() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const signRes = await requestFreighterSignature({
        contractId: eligibility.contractId ?? "CANCEL_UNACCEPTED",
        buyerWallet: eligibility.buyerWalletAddress ?? "",
        amountBaseUnits: 0n,
      });

      await cancelUnaccepted({
        orderId,
        txHash: signRes.transactionHash ?? undefined,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to cancel expired escrow.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mt-6 border-red-500/50 bg-red-500/5 dark:bg-red-500/10">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
            <span>Exporter Acceptance Deadline Expired</span>
            <Badge variant="destructive">Expired</Badge>
          </CardTitle>
          <CardDescription>
            The Exporter failed to activate this escrow before the deadline. As the Importer, you can cancel and recover 100% of your funds ({grandTotalFormatted}).
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-2">
        {errorMessage && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Invoking cancel_unaccepted will return 100% of the locked tokens to your wallet and mark the order cancelled.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancelUnaccepted}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Cancelling..." : "Cancel & Reclaim Escrow"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
