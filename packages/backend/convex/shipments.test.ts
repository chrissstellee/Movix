/// <reference types="vite/client" />

import { hashEvidenceManifest } from "@repo/stellar/evidence-manifests";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const importerWallet = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const exporterWallet = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

async function createParty(
  t: ReturnType<typeof convexTest>,
  suffix: string,
  wallet: string,
  capability: "buyer" | "supplier",
) {
  const now = Date.now();
  const tokenIdentifier = `https://movix.test|shipment-${suffix}`;
  const familyId = `shipment-family-${suffix}`;
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      primaryWallet: wallet,
      tokenIdentifier,
      status: "active",
      timezone: "UTC",
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const walletId = await ctx.db.insert("wallets", {
      userId,
      address: wallet,
      network: "testnet",
      verifiedAt: now,
      createdAt: now,
    });
    await ctx.db.insert("authSessionFamilies", {
      familyId,
      userId,
      walletId,
      network: "testnet",
      currentCredentialHash: `shipment-credential-${suffix}`,
      absoluteExpiresAt: now + 600_000,
      createdAt: now,
      updatedAt: now,
    });
    const organizationId = await ctx.db.insert("organizations", {
      legalName: `${suffix} Shipment Organization`,
      capability,
      status: "active",
      verificationStatus: "verified",
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    await ctx.db.insert("memberships", {
      userId,
      organizationId,
      role: "owner",
      status: "active",
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    return { userId, organizationId };
  });
  return {
    ...ids,
    authenticated: t.withIdentity({
      subject: `shipment-${suffix}`,
      issuer: "https://movix.test",
      tokenIdentifier,
      session_family_id: familyId,
    }),
  };
}

async function createFixture() {
  const t = convexTest(schema, modules);
  const importer = await createParty(t, "importer", importerWallet, "buyer");
  const exporter = await createParty(t, "exporter", exporterWallet, "supplier");
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const orderId = await ctx.db.insert("orders", {
      buyerOrganizationId: importer.organizationId,
      supplierOrganizationId: exporter.organizationId,
      currentRevisionNumber: 1n,
      grandTotalBaseUnits: 10_000n,
      agreementStatus: "accepted",
      fulfillmentStatus: "not_started",
      settlementStatus: "accepted",
      supplierQueueState: "accepted",
      sortTimestamp: now,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const revisionId = await ctx.db.insert("orderRevisions", {
      orderId,
      revisionNumber: 1n,
      buyerOrganizationId: importer.organizationId,
      supplierOrganizationId: exporter.organizationId,
      buyerLegalNameSnapshot: "Importer Shipment Organization",
      supplierLegalNameSnapshot: "Exporter Shipment Organization",
      destinationCountry: "PH",
      subtotalBaseUnits: 10_000n,
      discountTotalBaseUnits: 0n,
      taxTotalBaseUnits: 0n,
      shippingTotalBaseUnits: 0n,
      grandTotalBaseUnits: 10_000n,
      paymentMode: "escrow",
      autoReleasePolicy: "none",
      termsHash: "a".repeat(64),
      termsHashVersion: "order-terms-v2",
      frozenAt: now,
      createdByUserId: importer.userId,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    await ctx.db.patch("orders", orderId, {
      currentRevisionId: revisionId,
      acceptedRevisionId: revisionId,
    });
    await ctx.db.insert("orderLines", {
      revisionId,
      lineNumber: 1n,
      name: "Rice",
      quantityCoefficient: 10n,
      quantityScale: 0n,
      unitOfMeasure: "KG",
      unitPriceBaseUnits: 1_000n,
      discountKind: "none",
      taxBps: 0n,
      originCountry: "VN",
      requiresInspection: false,
      grossBaseUnits: 10_000n,
      discountBaseUnits: 0n,
      taxBaseUnits: 0n,
      lineTotalBaseUnits: 10_000n,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const contractId = `C${"A".repeat(55)}`;
    const escrowId = await ctx.db.insert("escrows", {
      orderId,
      escrowKey: "shipment-escrow",
      buyerOrganizationId: importer.organizationId,
      supplierOrganizationId: exporter.organizationId,
      network: "testnet",
      contractId,
      tokenContractId: `C${"B".repeat(55)}`,
      amountBaseUnits: 10_000n,
      status: "accepted",
      reconciliationStatus: "current",
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const storageId = await ctx.storage.store(
      new Blob(["clean commercial invoice"], { type: "application/pdf" }),
    );
    const documentId = await ctx.db.insert("tradeDocuments", {
      orderId,
      importerOrganizationId: importer.organizationId,
      exporterOrganizationId: exporter.organizationId,
      documentType: "commercial_invoice",
      visibility: "participants",
      currentVersionNumber: 1n,
      createdByUserId: exporter.userId,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const documentVersionId = await ctx.db.insert("tradeDocumentVersions", {
      documentId,
      orderId,
      versionNumber: 1n,
      storageId,
      digest: "d".repeat(64),
      mimeType: "application/pdf",
      sizeBytes: 24n,
      uploaderOrganizationId: exporter.organizationId,
      uploaderUserId: exporter.userId,
      visibility: "participants",
      scanState: "clean",
      reviewState: "accepted",
      createdAt: now,
    });
    await ctx.db.patch("tradeDocuments", documentId, { currentVersionId: documentVersionId });
    return { orderId, revisionId, escrowId, contractId, documentVersionId };
  });
  return { t, importer, exporter, ...ids };
}

describe("Sprint 6 Shipment evidence", () => {
  it("binds clean document versions to exporter shipment and importer delivery milestones", async () => {
    const fixture = await createFixture();
    const shipment = await fixture.exporter.authenticated.mutation(api.shipments.create, {
      orderId: fixture.orderId,
      expectedOrderVersion: 1n,
      shipmentHash: "e".repeat(64),
      escrowId: fixture.escrowId,
      contractId: fixture.contractId,
      originCountry: "VN",
      destinationCountry: "PH",
      plannedShipmentFrom: "2026-08-15",
      plannedShipmentTo: "2026-08-31",
      expectedArrivalFrom: "2026-09-01",
      expectedArrivalTo: "2026-09-30",
    });
    const shipmentDigest = await hashEvidenceManifest({
      kind: "shipment",
      orderId: fixture.orderId,
      revisionId: fixture.revisionId,
      escrowId: fixture.escrowId,
      contractId: fixture.contractId,
      network: "testnet",
      documentVersionDigests: ["d".repeat(64)],
    });

    await expect(
      fixture.exporter.authenticated.mutation(api.shipments.recordStatus, {
        orderId: fixture.orderId,
        shipmentId: shipment.id,
        expectedVersion: shipment.version,
        status: "shipped",
        evidenceManifestDigest: "f".repeat(64),
        documentVersionIds: [fixture.documentVersionId],
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "SHIPMENT_INVALID" }),
    });
    const shipped = await fixture.exporter.authenticated.mutation(api.shipments.recordStatus, {
      orderId: fixture.orderId,
      shipmentId: shipment.id,
      expectedVersion: shipment.version,
      status: "shipped",
      evidenceManifestDigest: shipmentDigest,
      documentVersionIds: [fixture.documentVersionId],
    });
    const arrived = await fixture.exporter.authenticated.mutation(api.shipments.recordStatus, {
      orderId: fixture.orderId,
      shipmentId: shipment.id,
      expectedVersion: shipped.version,
      status: "arrived",
    });
    const deliveryDigest = await hashEvidenceManifest({
      kind: "delivery",
      orderId: fixture.orderId,
      revisionId: fixture.revisionId,
      escrowId: fixture.escrowId,
      contractId: fixture.contractId,
      network: "testnet",
      documentVersionDigests: ["d".repeat(64)],
    });

    await expect(
      fixture.exporter.authenticated.mutation(api.shipments.recordStatus, {
        orderId: fixture.orderId,
        shipmentId: shipment.id,
        expectedVersion: arrived.version,
        status: "delivery_confirmed",
        evidenceManifestDigest: deliveryDigest,
        documentVersionIds: [fixture.documentVersionId],
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "SHIPMENT_INVALID" }),
    });
    await expect(
      fixture.importer.authenticated.mutation(api.shipments.recordStatus, {
        orderId: fixture.orderId,
        shipmentId: shipment.id,
        expectedVersion: arrived.version,
        status: "delivery_confirmed",
        evidenceManifestDigest: deliveryDigest,
        documentVersionIds: [fixture.documentVersionId],
      }),
    ).resolves.toMatchObject({
      status: "delivery_confirmed",
      evidenceManifestDigest: deliveryDigest,
    });
  }, 15_000);

  it("rejects stale concurrent status writes and mismatched escrow identity", async () => {
    const fixture = await createFixture();
    await expect(
      fixture.exporter.authenticated.mutation(api.shipments.create, {
        orderId: fixture.orderId,
        expectedOrderVersion: 1n,
        shipmentHash: "e".repeat(64),
        escrowId: fixture.escrowId,
        contractId: `C${"Z".repeat(55)}`,
        originCountry: "VN",
        destinationCountry: "PH",
        plannedShipmentFrom: "2026-08-15",
        plannedShipmentTo: "2026-08-31",
        expectedArrivalFrom: "2026-09-01",
        expectedArrivalTo: "2026-09-30",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "SHIPMENT_INVALID" }),
    });
    const shipment = await fixture.exporter.authenticated.mutation(api.shipments.create, {
      orderId: fixture.orderId,
      expectedOrderVersion: 1n,
      shipmentHash: "e".repeat(64),
      escrowId: fixture.escrowId,
      contractId: fixture.contractId,
      originCountry: "VN",
      destinationCountry: "PH",
      plannedShipmentFrom: "2026-08-15",
      plannedShipmentTo: "2026-08-31",
      expectedArrivalFrom: "2026-09-01",
      expectedArrivalTo: "2026-09-30",
    });

    const results = await Promise.allSettled([
      fixture.exporter.authenticated.mutation(api.shipments.recordStatus, {
        orderId: fixture.orderId,
        shipmentId: shipment.id,
        expectedVersion: shipment.version,
        status: "booked",
      }),
      fixture.exporter.authenticated.mutation(api.shipments.recordStatus, {
        orderId: fixture.orderId,
        shipmentId: shipment.id,
        expectedVersion: shipment.version,
        status: "cancelled",
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  }, 15_000);
});
