import * as React from "react";
import { useState } from "react";

export interface ExporterAcceptModalProps {
  isOpen: boolean;
  onClose: () => void;
  grossAmount: string;
  currency: string;
  importerName: string;
  contractId: string;
  acceptByTimestamp?: number;
  onConfirmAccept: () => Promise<void>;
}

export const ExporterAcceptModal: React.FC<ExporterAcceptModalProps> = ({
  isOpen,
  onClose,
  grossAmount,
  currency,
  importerName,
  contractId,
  acceptByTimestamp,
  onConfirmAccept,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAccept = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirmAccept();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDeadline = acceptByTimestamp
    ? new Date(acceptByTimestamp * 1000).toLocaleString()
    : "Standard 7-Day Window";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>⚡</span> Exporter Escrow Activation
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-4 text-sm text-neutral-300 mb-6">
          <p>
            You are activating the funded escrow for trade order with <strong className="text-white">{importerName}</strong>. Signing this transaction commits your organization to trade fulfillment.
          </p>

          <div className="rounded-xl bg-neutral-950 p-4 border border-neutral-800 space-y-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-500">Gross Escrow</span>
              <span className="text-emerald-400 font-bold">{grossAmount} {currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Soroban Contract</span>
              <span className="text-neutral-300">{contractId.slice(0, 8)}...{contractId.slice(-8)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Acceptance Deadline</span>
              <span className="text-neutral-300">{formattedDeadline}</span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-950/60 border border-red-500/40 p-3 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-800 pt-4">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-700"
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={isSubmitting}
            className="rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-5 py-2 text-sm transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Simulating & Prompting Wallet..." : "Sign & Commit Fulfillment"}
          </button>
        </div>
      </div>
    </div>
  );
};

export interface ShipmentPayload {
  carrierName: string;
  trackingOrDocumentNumber: string;
  phytosanitaryCertNumber?: string;
  portOfLoading: string;
  portOfDischarge: string;
  shippedDate: string;
}

export interface ShipmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitShipment: (data: ShipmentPayload) => Promise<void>;
}

export const ShipmentFormModal: React.FC<ShipmentFormModalProps> = ({
  isOpen,
  onClose,
  onSubmitShipment,
}) => {
  const [carrierName, setCarrierName] = useState("");
  const [trackingOrDocumentNumber, setTrackingOrDocumentNumber] = useState("");
  const [phytosanitaryCertNumber, setPhytosanitaryCertNumber] = useState("");
  const [portOfLoading, setPortOfLoading] = useState("");
  const [portOfDischarge, setPortOfDischarge] = useState("");
  const [shippedDate, setShippedDate] = useState(new Date().toISOString().slice(0, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      const payload: ShipmentPayload = {
        carrierName,
        trackingOrDocumentNumber,
        portOfLoading,
        portOfDischarge,
        shippedDate,
      };
      const cleanPhyto = phytosanitaryCertNumber.trim();
      if (cleanPhyto) {
        payload.phytosanitaryCertNumber = cleanPhyto;
      }
      await onSubmitShipment(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🚢</span> Record Agricultural Shipment Evidence
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-neutral-300 mb-1">Carrier / Logistics Line *</label>
            <input
              type="text"
              required
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              placeholder="e.g. ASEAN Shipping Line / Regional Air Cargo"
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-300 mb-1">Bill of Lading (B/L) or Air Waybill (AWB) # *</label>
            <input
              type="text"
              required
              value={trackingOrDocumentNumber}
              onChange={(e) => setTrackingOrDocumentNumber(e.target.value)}
              placeholder="e.g. BL-MY-2026-9901"
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-300 mb-1">ASEAN Phytosanitary Certificate Reference</label>
            <input
              type="text"
              value={phytosanitaryCertNumber}
              onChange={(e) => setPhytosanitaryCertNumber(e.target.value)}
              placeholder="e.g. PHYTO-MY-2026-88"
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-300 mb-1">Port of Loading *</label>
              <input
                type="text"
                required
                value={portOfLoading}
                onChange={(e) => setPortOfLoading(e.target.value)}
                placeholder="e.g. Port Klang"
                className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-neutral-300 mb-1">Port of Discharge *</label>
              <input
                type="text"
                required
                value={portOfDischarge}
                onChange={(e) => setPortOfDischarge(e.target.value)}
                placeholder="e.g. Tanjung Priok"
                className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-neutral-300 mb-1">Actual Shipped Date *</label>
            <input
              type="date"
              required
              value={shippedDate}
              onChange={(e) => setShippedDate(e.target.value)}
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-950/60 border border-red-500/40 p-3 text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-neutral-800 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 font-medium text-neutral-300 hover:bg-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-5 py-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Computing SHA-256 & Signing..." : "Sign mark_shipped"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export interface DeliveryPayload {
  receivedDate: string;
  receivingLocation: string;
  inspectionCertificateNumber?: string;
  inspectionResult: "accepted_full" | "accepted_conditional";
  inspectorName: string;
  notes?: string;
}

export interface DeliveryReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  grossAmount: string;
  currency: string;
  exporterName: string;
  exporterWallet: string;
  onSubmitDelivery: (data: DeliveryPayload) => Promise<void>;
}

export const DeliveryReleaseModal: React.FC<DeliveryReleaseModalProps> = ({
  isOpen,
  onClose,
  grossAmount,
  currency,
  exporterName,
  exporterWallet,
  onSubmitDelivery,
}) => {
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [receivingLocation, setReceivingLocation] = useState("");
  const [inspectionCertificateNumber, setInspectionCertificateNumber] = useState("");
  const [inspectionResult, setInspectionResult] = useState<"accepted_full" | "accepted_conditional">("accepted_full");
  const [inspectorName, setInspectorName] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      const payload: DeliveryPayload = {
        receivedDate,
        receivingLocation,
        inspectionResult,
        inspectorName,
      };
      const cleanCert = inspectionCertificateNumber.trim();
      if (cleanCert) {
        payload.inspectionCertificateNumber = cleanCert;
      }
      const cleanNotes = notes.trim();
      if (cleanNotes) {
        payload.notes = cleanNotes;
      }
      await onSubmitDelivery(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🔓</span> Confirm Delivery & Release Escrow Payout
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="rounded-xl bg-emerald-950/20 border border-emerald-500/20 p-4 font-mono space-y-1 text-xs mb-4">
            <div className="flex justify-between text-neutral-300">
              <span>Payout Recipient:</span>
              <span className="text-white font-bold">{exporterName}</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Wallet Address:</span>
              <span className="text-emerald-400">{exporterWallet.slice(0, 8)}...{exporterWallet.slice(-8)}</span>
            </div>
            <div className="flex justify-between text-neutral-300 text-sm pt-1 border-t border-emerald-500/20 font-bold">
              <span>Atomic Token Release:</span>
              <span className="text-emerald-400">{grossAmount} {currency}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-300 mb-1">Received Date *</label>
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-neutral-300 mb-1">Receiving Warehouse *</label>
              <input
                type="text"
                required
                value={receivingLocation}
                onChange={(e) => setReceivingLocation(e.target.value)}
                placeholder="e.g. Warehouse 4, Jakarta Port"
                className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-300 mb-1">Inspector Name *</label>
              <input
                type="text"
                required
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                placeholder="e.g. Budi Santoso"
                className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-neutral-300 mb-1">Inspection Report #</label>
              <input
                type="text"
                value={inspectionCertificateNumber}
                onChange={(e) => setInspectionCertificateNumber(e.target.value)}
                placeholder="e.g. INSP-2026-90"
                className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-neutral-300 mb-1">Inspection Outcome *</label>
            <select
              value={inspectionResult}
              onChange={(e) => setInspectionResult(e.target.value as "accepted_full" | "accepted_conditional")}
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="accepted_full">Accepted in Full (100% Quality Conformance)</option>
              <option value="accepted_conditional">Accepted Conditional (Minor Variance Note)</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-neutral-300 mb-1">Inspection Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional receiving inspection notes..."
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2 text-white focus:border-emerald-500 focus:outline-none"
              rows={2}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-950/60 border border-red-500/40 p-3 text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-neutral-800 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 font-medium text-neutral-300 hover:bg-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-5 py-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Deriving Hash & Executing Soroban Release..." : "Sign confirm_delivery & Release Funds"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
