import { hash } from "@stellar/stellar-sdk";

export interface ShipmentEvidence {
  orderId: string;
  revisionId: string;
  carrierName: string;
  trackingOrDocumentNumber: string; // Bill of Lading (B/L) or Air Waybill (AWB)
  phytosanitaryCertNumber?: string;
  portOfLoading: string;
  portOfDischarge: string;
  shippedDate: string; // ISO 8601 YYYY-MM-DD
  vesselOrFlightId?: string;
}

export interface DeliveryConfirmation {
  orderId: string;
  revisionId: string;
  receivedDate: string; // ISO 8601 YYYY-MM-DD
  receivingLocation: string;
  inspectionCertificateNumber?: string;
  inspectionResult: "accepted_full" | "accepted_conditional";
  inspectorName: string;
  notes?: string;
}

export interface DerivedHashResult {
  hashBytes: Uint8Array;
  hashHex: string;
}

/**
 * Sorts object keys recursively to guarantee deterministic JSON stringification.
 */
function sortObjectKeys<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys) as unknown as T;
  }
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== undefined) {
      result[key] = sortObjectKeys(val);
    }
  }
  return result as T;
}

/**
 * Computes deterministic SHA-256 32-byte hash for agricultural shipment evidence.
 */
export function computeShipmentHash(evidence: ShipmentEvidence): DerivedHashResult {
  if (!evidence.orderId || !evidence.revisionId) {
    throw new Error("orderId and revisionId are required to compute shipment hash");
  }
  if (!evidence.carrierName || !evidence.trackingOrDocumentNumber) {
    throw new Error("carrierName and trackingOrDocumentNumber are required");
  }
  if (!evidence.portOfLoading || !evidence.portOfDischarge || !evidence.shippedDate) {
    throw new Error("portOfLoading, portOfDischarge, and shippedDate are required");
  }

  const canonicalObj = sortObjectKeys(evidence);
  const jsonString = JSON.stringify(canonicalObj);
  const digest = hash(Buffer.from(jsonString, "utf-8"));

  return {
    hashBytes: new Uint8Array(digest),
    hashHex: digest.toString("hex"),
  };
}

/**
 * Computes deterministic SHA-256 32-byte hash for Importer delivery confirmation.
 */
export function computeDeliveryHash(confirmation: DeliveryConfirmation): DerivedHashResult {
  if (!confirmation.orderId || !confirmation.revisionId) {
    throw new Error("orderId and revisionId are required to compute delivery hash");
  }
  if (!confirmation.receivedDate || !confirmation.receivingLocation) {
    throw new Error("receivedDate and receivingLocation are required");
  }
  if (!confirmation.inspectionResult || !confirmation.inspectorName) {
    throw new Error("inspectionResult and inspectorName are required");
  }

  const canonicalObj = sortObjectKeys(confirmation);
  const jsonString = JSON.stringify(canonicalObj);
  const digest = hash(Buffer.from(jsonString, "utf-8"));

  return {
    hashBytes: new Uint8Array(digest),
    hashHex: digest.toString("hex"),
  };
}
