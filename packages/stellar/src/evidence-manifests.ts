export const EVIDENCE_MANIFEST_DOMAIN = "MOVIX_TRADE_EVIDENCE_V1";

export interface TradeEvidenceManifest {
  kind: "shipment" | "delivery";
  orderId: string;
  revisionId: string;
  escrowId: string;
  contractId: string;
  network: "testnet";
  documentVersionDigests: string[];
}

function normalizedId(value: string) {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || normalized.length > 200 || /[\p{Cc}\p{Cf}\s]/u.test(normalized)) {
    throw new Error("EVIDENCE_MANIFEST_INVALID");
  }
  return normalized;
}

export function canonicalizeEvidenceManifest(manifest: TradeEvidenceManifest): Uint8Array {
  if (!["shipment", "delivery"].includes(manifest.kind) || manifest.network !== "testnet") {
    throw new Error("EVIDENCE_MANIFEST_INVALID");
  }
  const digests = [
    ...new Set(manifest.documentVersionDigests.map((digest) => digest.toLowerCase())),
  ];
  if (
    digests.length !== manifest.documentVersionDigests.length ||
    digests.length > 100 ||
    digests.some((digest) => !/^[a-f0-9]{64}$/u.test(digest))
  ) {
    throw new Error("EVIDENCE_MANIFEST_INVALID");
  }
  const payload = {
    kind: manifest.kind,
    orderId: normalizedId(manifest.orderId),
    revisionId: normalizedId(manifest.revisionId),
    escrowId: normalizedId(manifest.escrowId),
    contractId: normalizedId(manifest.contractId),
    network: manifest.network,
    documentVersionDigests: digests.sort(),
  };
  return new TextEncoder().encode(`${EVIDENCE_MANIFEST_DOMAIN}\u0000${JSON.stringify(payload)}`);
}

export async function hashEvidenceManifest(manifest: TradeEvidenceManifest) {
  const bytes = canonicalizeEvidenceManifest(manifest);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
