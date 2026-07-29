import { describe, expect, it } from "vitest";

import { canonicalizeEvidenceManifest, hashEvidenceManifest } from "./evidence-manifests.js";

const manifest = {
  kind: "shipment" as const,
  orderId: "order-1",
  revisionId: "revision-2",
  escrowId: "escrow-1",
  contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  network: "testnet" as const,
  documentVersionDigests: ["b".repeat(64), "a".repeat(64)],
};

describe("agricultural evidence manifests", () => {
  it("binds the order, revision, escrow, contract, network, and exact document versions", async () => {
    const canonical = new TextDecoder().decode(canonicalizeEvidenceManifest(manifest));
    expect(canonical).toContain('"orderId":"order-1"');
    expect(canonical.indexOf(`"a${"a".repeat(63)}"`)).toBeLessThan(
      canonical.indexOf(`"b${"b".repeat(63)}"`),
    );
    await expect(hashEvidenceManifest(manifest)).resolves.toMatch(/^[a-f0-9]{64}$/u);
  });

  it("rejects duplicate, malformed, or replay-ambiguous document digests", () => {
    expect(() =>
      canonicalizeEvidenceManifest({
        ...manifest,
        documentVersionDigests: ["a".repeat(64), "a".repeat(64)],
      }),
    ).toThrow("EVIDENCE_MANIFEST_INVALID");
    expect(() => canonicalizeEvidenceManifest({ ...manifest, orderId: "order 1" })).toThrow(
      "EVIDENCE_MANIFEST_INVALID",
    );
  });
});
