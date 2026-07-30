import * as React from "react";

export interface FulfillmentStepperProps {
  settlementStatus: "unfunded" | "funded" | "accepted" | "shipped" | "released" | "needs_reconciliation" | string;
  contractId?: string;
  acceptTxHash?: string;
  shipmentTxHash?: string;
  releaseTxHash?: string;
  acceptTimestamp?: number;
  shipmentTimestamp?: number;
  releaseTimestamp?: number;
  carrierName?: string;
  trackingNumber?: string;
  inspectionResult?: string;
  isExporter?: boolean;
  isImporter?: boolean;
  onAcceptClick?: () => void;
  onShipClick?: () => void;
  onConfirmDeliveryClick?: () => void;
}

export const FulfillmentStepper: React.FC<FulfillmentStepperProps> = ({
  settlementStatus,
  acceptTxHash,
  shipmentTxHash,
  releaseTxHash,
  carrierName,
  trackingNumber,
  inspectionResult,
  isExporter,
  isImporter,
  onAcceptClick,
  onShipClick,
  onConfirmDeliveryClick,
}) => {
  const getStepState = (stepIndex: number) => {
    // Step 1: Agreement Accepted (Always done)
    // Step 2: Escrow Funded (funded, accepted, shipped, released)
    // Step 3: Escrow Activated (accepted, shipped, released)
    // Step 4: Shipment Recorded (shipped, released)
    // Step 5: Delivery Confirmed & Released (released)

    const statusMap: Record<string, number> = {
      unfunded: 1,
      funded: 2,
      accepted: 3,
      shipped: 4,
      released: 5,
    };

    const currentLevel = statusMap[settlementStatus] || 1;

    if (currentLevel > stepIndex) return "completed";
    if (currentLevel === stepIndex) return "active";
    return "pending";
  };

  const steps = [
    {
      index: 1,
      title: "Agreement Accepted",
      description: "Both parties signed terms",
    },
    {
      index: 2,
      title: "Escrow Funded",
      description: "Importer locked tokens into Soroban contract",
    },
    {
      index: 3,
      title: "Escrow Activated",
      description: "Exporter signed on-chain fulfillment commitment",
      txHash: acceptTxHash,
      action: isExporter && settlementStatus === "funded" ? (
        <button
          onClick={onAcceptClick}
          className="mt-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-semibold px-4 py-2 text-sm transition-all"
        >
          Accept Escrow & Commit
        </button>
      ) : null,
    },
    {
      index: 4,
      title: "Shipment Recorded",
      description: carrierName && trackingNumber ? `${carrierName} • B/L ${trackingNumber}` : "Exporter recorded agricultural B/L & phytosanitary cert",
      txHash: shipmentTxHash,
      action: isExporter && settlementStatus === "accepted" ? (
        <button
          onClick={onShipClick}
          className="mt-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-semibold px-4 py-2 text-sm transition-all"
        >
          Record Shipment Evidence
        </button>
      ) : null,
    },
    {
      index: 5,
      title: "Delivery Confirmed & Released",
      description: inspectionResult ? `Inspection: ${inspectionResult.replace("_", " ")}` : "Importer verified receiving report & released tokens",
      txHash: releaseTxHash,
      action: isImporter && settlementStatus === "shipped" ? (
        <button
          onClick={onConfirmDeliveryClick}
          className="mt-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-semibold px-4 py-2 text-sm transition-all"
        >
          Confirm Delivery & Release Payout
        </button>
      ) : null,
    },
  ];

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/90 p-6 text-neutral-100 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            Trade Fulfillment & Settlement Stepper
          </h3>
          <p className="text-xs text-neutral-400">On-chain Soroban escrow milestone timeline</p>
        </div>
        <span className="rounded-full bg-neutral-800 border border-neutral-700 px-3 py-1 text-xs font-mono font-medium text-emerald-400 capitalize">
          Status: {settlementStatus}
        </span>
      </div>

      <div className="space-y-6">
        {steps.map((step) => {
          const state = getStepState(step.index);
          return (
            <div key={step.index} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    state === "completed"
                      ? "bg-emerald-500 text-black ring-4 ring-emerald-500/20"
                      : state === "active"
                      ? "bg-amber-400 text-black ring-4 ring-amber-400/20 animate-pulse"
                      : "bg-neutral-800 text-neutral-500 border border-neutral-700"
                  }`}
                >
                  {state === "completed" ? "✓" : step.index}
                </div>
                {step.index < 5 && (
                  <div
                    className={`h-10 w-0.5 mt-1 ${
                      state === "completed" ? "bg-emerald-500/60" : "bg-neutral-800"
                    }`}
                  />
                )}
              </div>

              <div className="flex-1 pt-1">
                <div className="flex items-center justify-between">
                  <h4
                    className={`text-sm font-semibold ${
                      state === "completed"
                        ? "text-emerald-400"
                        : state === "active"
                        ? "text-amber-300 font-bold"
                        : "text-neutral-500"
                    }`}
                  >
                    {step.title}
                  </h4>
                  {step.txHash && (
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${step.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-neutral-400 hover:text-emerald-400 font-mono underline"
                    >
                      Tx: {step.txHash.slice(0, 6)}...{step.txHash.slice(-6)}
                    </a>
                  )}
                </div>

                <p className="text-xs text-neutral-400 mt-0.5">{step.description}</p>
                {step.action}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
