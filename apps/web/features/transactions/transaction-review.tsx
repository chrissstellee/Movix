"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";

export interface TransactionReviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderTitle?: string;
  poNumber?: string;
  revisionNumber: string;
  amountFormatted: string;
  assetCode: string;
  importerWallet: string;
  exporterWallet: string;
  contractId: string;
  termsHash: string;
  network: string;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function TransactionReview({
  open,
  onOpenChange,
  orderTitle,
  poNumber,
  revisionNumber,
  amountFormatted,
  assetCode,
  importerWallet,
  exporterWallet,
  contractId,
  termsHash,
  network,
  onConfirm,
  isSubmitting,
}: TransactionReviewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Review and authorize escrow funding</DialogTitle>
          <DialogDescription>
            You are authorizing an immutable Soroban smart contract transaction to lock funds in escrow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm my-2">
          <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground text-xs uppercase font-medium">Trade Amount</span>
              <span className="text-2xl font-bold font-mono">
                {amountFormatted} {assetCode}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Platform Fee</span>
              <span className="font-mono">0.00 {assetCode} (0 BPS)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Order</span>
              <span className="font-medium">{poNumber ?? "Draft"} ({orderTitle ?? "Untitled"})</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Accepted Revision</span>
              <span className="font-medium">Revision {revisionNumber}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Network</span>
              <span className="font-medium capitalize">{network}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Verified Contract</span>
              <span className="font-mono truncate block" title={contractId}>
                {contractId.slice(0, 8)}...{contractId.slice(-8)}
              </span>
            </div>
          </div>

          <div className="border-t pt-3 space-y-2 text-xs">
            <div>
              <span className="text-muted-foreground block">Importer Wallet (Source)</span>
              <span className="font-mono block truncate" title={importerWallet}>
                {importerWallet}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Exporter Wallet (Beneficiary)</span>
              <span className="font-mono block truncate" title={exporterWallet}>
                {exporterWallet}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Terms Hash</span>
              <span className="font-mono block break-all text-[11px] bg-muted p-1.5 rounded">
                {termsHash}
              </span>
            </div>
          </div>

          <div className="rounded bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-800 dark:text-blue-300">
            🔒 On-chain funding confirms trade value is locked in escrow. Delivery confirmation and payment release follow shipment acceptance.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={onConfirm}>
            {isSubmitting ? "Signing & Submitting…" : "Confirm and Sign with Wallet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
