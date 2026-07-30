import * as React from "react";

export interface SettlementReceiptCardProps {
  orderNumber: string;
  revisionNumber: string | number;
  importerLegalName: string;
  importerWalletAddress: string;
  exporterLegalName: string;
  exporterWalletAddress: string;
  grossAmount: string;
  currency: string;
  feeAmount?: string;
  netPayoutAmount: string;
  transactionHash: string;
  ledgerSequence?: number | string;
  confirmedAtTimestamp?: number;
  termsHash?: string;
  shipmentHash?: string;
  deliveryHash?: string;
  onExportPdfClick?: () => void;
}

export const SettlementReceiptCard: React.FC<SettlementReceiptCardProps> = ({
  orderNumber,
  revisionNumber,
  importerLegalName,
  importerWalletAddress,
  exporterLegalName,
  exporterWalletAddress,
  grossAmount,
  currency,
  feeAmount = "0.00",
  netPayoutAmount,
  transactionHash,
  ledgerSequence,
  confirmedAtTimestamp,
  termsHash,
  shipmentHash,
  deliveryHash,
  onExportPdfClick,
}) => {
  const formattedDate = confirmedAtTimestamp
    ? new Date(confirmedAtTimestamp).toUTCString()
    : "Pending Finality";

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-neutral-950 p-6 text-neutral-100 shadow-2xl backdrop-blur-lg">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="text-xl font-bold">✓</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Official Trade Settlement Receipt</h3>
            <p className="text-xs text-neutral-400 font-mono">Order {orderNumber} • Rev #{revisionNumber}</p>
          </div>
        </div>

        <button
          onClick={onExportPdfClick}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 hover:text-white transition-all"
        >
          <span>📄</span> Export Receipt PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="rounded-lg bg-neutral-900/60 p-4 border border-neutral-850">
          <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider block mb-2">Importer (Buyer)</span>
          <div className="text-sm font-bold text-white">{importerLegalName}</div>
          <div className="text-xs font-mono text-neutral-400 break-all mt-1">{importerWalletAddress}</div>
        </div>

        <div className="rounded-lg bg-neutral-900/60 p-4 border border-neutral-850">
          <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider block mb-2">Exporter (Supplier)</span>
          <div className="text-sm font-bold text-white">{exporterLegalName}</div>
          <div className="text-xs font-mono text-emerald-400 break-all mt-1">{exporterWalletAddress}</div>
        </div>
      </div>

      <div className="rounded-xl bg-emerald-950/20 border border-emerald-500/20 p-5 mb-6">
        <div className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3">Settlement Payout Breakdown</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-neutral-300">
            <span>Gross Escrow Amount</span>
            <span className="font-mono font-medium">{grossAmount} {currency}</span>
          </div>
          <div className="flex justify-between text-neutral-400 text-xs">
            <span>Movix Protocol Fee (0 bps)</span>
            <span className="font-mono">{feeAmount} {currency}</span>
          </div>
          <div className="border-t border-emerald-500/20 pt-2 flex justify-between text-base font-bold text-emerald-400">
            <span>Net Exporter Payout</span>
            <span className="font-mono">{netPayoutAmount} {currency}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-neutral-900/40 p-4 border border-neutral-850 space-y-2 text-xs">
        <div className="flex justify-between items-center text-neutral-400">
          <span>Stellar Transaction Hash</span>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-emerald-400 hover:underline"
          >
            {transactionHash.slice(0, 10)}...{transactionHash.slice(-10)}
          </a>
        </div>
        {ledgerSequence && (
          <div className="flex justify-between text-neutral-400">
            <span>Confirmed Ledger</span>
            <span className="font-mono text-neutral-200">#{ledgerSequence}</span>
          </div>
        )}
        <div className="flex justify-between text-neutral-400">
          <span>Finality Timestamp</span>
          <span className="font-mono text-neutral-200">{formattedDate}</span>
        </div>
        {termsHash && (
          <div className="flex justify-between text-neutral-400">
            <span>Terms Commitment Hash</span>
            <span className="font-mono text-neutral-300">{termsHash.slice(0, 8)}...{termsHash.slice(-8)}</span>
          </div>
        )}
        {shipmentHash && (
          <div className="flex justify-between text-neutral-400">
            <span>Shipment Hash</span>
            <span className="font-mono text-neutral-300">{shipmentHash.slice(0, 8)}...{shipmentHash.slice(-8)}</span>
          </div>
        )}
        {deliveryHash && (
          <div className="flex justify-between text-neutral-400">
            <span>Delivery Hash</span>
            <span className="font-mono text-neutral-300">{deliveryHash.slice(0, 8)}...{deliveryHash.slice(-8)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
