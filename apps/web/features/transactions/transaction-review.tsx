"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";

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
            You are authorizing an immutable Soroban smart contract transaction to lock funds in
            escrow.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 space-y-4 text-sm">
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Trade Amount
              </span>
              <span className="font-mono text-2xl font-bold">
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
              <span className="block text-muted-foreground">Order</span>
              <span className="font-medium">
                {poNumber ?? "Draft"} ({orderTitle ?? "Untitled"})
              </span>
            </div>
            <div>
              <span className="block text-muted-foreground">Accepted Revision</span>
              <span className="font-medium">Revision {revisionNumber}</span>
            </div>
            <div>
              <span className="block text-muted-foreground">Network</span>
              <span className="font-medium capitalize">{network}</span>
            </div>
            <div>
              <span className="block text-muted-foreground">Verified Contract</span>
              <span className="block truncate font-mono" title={contractId}>
                {contractId.slice(0, 8)}...{contractId.slice(-8)}
              </span>
            </div>
          </div>

          <div className="space-y-2 border-t pt-3 text-xs">
            <div>
              <span className="block text-muted-foreground">Importer Wallet (Source)</span>
              <span className="block truncate font-mono" title={importerWallet}>
                {importerWallet}
              </span>
            </div>
            <div>
              <span className="block text-muted-foreground">Exporter Wallet (Beneficiary)</span>
              <span className="block truncate font-mono" title={exporterWallet}>
                {exporterWallet}
              </span>
            </div>
            <div>
              <span className="block text-muted-foreground">Terms Hash</span>
              <span className="block rounded bg-muted p-1.5 font-mono text-[11px] break-all">
                {termsHash}
              </span>
            </div>
          </div>

          <div className="rounded border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-800 dark:text-blue-300">
            🔒 On-chain funding confirms trade value is locked in escrow. Delivery confirmation and
            payment release follow shipment acceptance.
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
