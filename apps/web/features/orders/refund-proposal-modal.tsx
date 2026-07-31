"use client";

import { api, type Id } from "@repo/backend/client";
import { submitProposeRefund } from "@repo/stellar";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { useMutation } from "convex/react";
import { useState } from "react";

export interface RefundProposalModalProps {
  orderId: Id<"orders">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grandTotalFormatted: string;
}

const REASON_OPTIONS = [
  { value: "DAMAGED_GOODS", label: "Cargo Damaged / Quality Issue" },
  { value: "LOGISTICS_DELAY", label: "Unacceptable Logistics Delay" },
  { value: "SPEC_MISMATCH", label: "Specification Mismatch" },
  { value: "MUTUAL_AGREEMENT", label: "Commercial Mutual Agreement" },
  { value: "OTHER", label: "Other Exception" },
];

export function RefundProposalModal({
  orderId,
  open,
  onOpenChange,
  grandTotalFormatted,
}: RefundProposalModalProps) {
  const prepareProposal = useMutation(api.refunds.prepareRefundProposalIntent);

  const [reasonCode, setReasonCode] = useState("DAMAGED_GOODS");
  const [explanation, setExplanation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function computeTermsHash(payload: object): Promise<string> {
    const jsonStr = JSON.stringify(payload);
    const msgBuffer = new TextEncoder().encode(jsonStr);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer.buffer as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function handleSubmitProposal(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        orderId,
        reasonCode,
        explanation: explanation.trim(),
        requestedAt: new Date().toISOString(),
      };

      const termsHash = await computeTermsHash(payload);

      const res = await prepareProposal({
        orderId,
        reasonCode,
        explanation: explanation.trim() || undefined,
        termsHash,
      });

      // Build, simulate, sign via Freighter, and submit propose_refund to Stellar Testnet
      const proposerWallet =
        res.proposerRole === "BUYER" ? res.buyerWalletAddress : res.supplierWalletAddress;

      if (!proposerWallet) {
        throw new Error("Proposer wallet address missing.");
      }

      onOpenChange(false);

      const submitResult = await submitProposeRefund({
        signerAddress: proposerWallet,
        escrowIdHex: res.escrowKey,
        proposerWallet,
        refundTermsHashHex: termsHash,
        contractId: res.contractId,
      });

      if (!submitResult.success) {
        throw new Error(submitResult.error || "Refund proposal transaction failed.");
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to propose mutual refund. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-red-500">
            Request Mutual Refund
          </DialogTitle>
          <DialogDescription>
            Propose a 100% mutual refund ({grandTotalFormatted}) for this trade escrow. Counterparty
            approval is required before funds are returned.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmitProposal} className="space-y-4 pt-2">
          {errorMessage && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          <div>
            <label htmlFor="refund-reason-category" className="mb-1 block text-sm font-medium">
              Refund Reason Category
            </label>
            <select
              id="refund-reason-category"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="refund-explanation" className="mb-1 block text-sm font-medium">
              Detailed Explanation
            </label>
            <textarea
              id="refund-explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={3}
              placeholder="Provide context or evidence details agreed upon with the counterparty..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              required
            />
          </div>

          <div className="space-y-1 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-semibold">Security & Policy Notice:</p>
            <p>• Post-acceptance refunds cannot be executed unilaterally.</p>
            <p>• Counterparty must explicitly approve identical refund term hashes.</p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? "Simulating & Signing..." : "Submit Refund Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
