/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const wallets = {
  importer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  exporter: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  foreign: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCDLM",
} as const;

async function createParty(
  t: ReturnType<typeof convexTest>,
  suffix: string,
  wallet: string,
  capability: "buyer" | "supplier",
) {
  const now = Date.now();
  const tokenIdentifier = `https://movix.test|documents-${suffix}`;
  const familyId = `documents-family-${suffix}`;
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      primaryWallet: wallet,
      tokenIdentifier,
      status: "active",
      timezone: "Asia/Manila",
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
      currentCredentialHash: `documents-credential-${suffix}`,
      absoluteExpiresAt: now + 600_000,
      createdAt: now,
      updatedAt: now,
    });
    const organizationId = await ctx.db.insert("organizations", {
      legalName: `${suffix} Trade Organization`,
      normalizedLegalName: `${suffix} trade organization`,
      registrationCountry: "PH",
      businessEmail: `${suffix}@example.com`,
      capability,
      defaultTimezone: "Asia/Manila",
      status: "active",
      verificationStatus: "verified",
      createdByUserId: userId,
      profileAttestationVersion: "business-profile-v1",
      profileAttestedByUserId: userId,
      profileAttestedAt: now,
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
      subject: `documents-${suffix}`,
      issuer: "https://movix.test",
      tokenIdentifier,
      session_family_id: familyId,
    }),
  };
}

async function createFixture() {
  const t = convexTest(schema, modules);
  const importer = await createParty(t, "importer", wallets.importer, "buyer");
  const exporter = await createParty(t, "exporter", wallets.exporter, "supplier");
  const foreign = await createParty(t, "foreign", wallets.foreign, "buyer");
  const orderId = await t.run(async (ctx) => {
    const now = Date.now();
    return ctx.db.insert("orders", {
      buyerOrganizationId: importer.organizationId,
      supplierOrganizationId: exporter.organizationId,
      currentRevisionNumber: 1n,
      grandTotalBaseUnits: 1_000n,
      agreementStatus: "accepted",
      fulfillmentStatus: "not_started",
      settlementStatus: "unfunded",
      supplierQueueState: "accepted",
      sortTimestamp: now,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
  });
  return { t, importer, exporter, foreign, orderId };
}

async function storeFixture(
  t: ReturnType<typeof convexTest>,
  body: string,
  mimeType = "text/plain",
) {
  const bytes = new TextEncoder().encode(body);
  const digestBytes = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  const digest = Array.from(new Uint8Array(digestBytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const result = await t.run(async (ctx) => {
    const blobBytes = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const storageId = await ctx.storage.store(new Blob([blobBytes], { type: mimeType }));
    const systemWriter = ctx.db as unknown as {
      patch(table: "_storage", id: typeof storageId, value: { contentType: string }): Promise<void>;
    };
    await systemWriter.patch("_storage", storageId, { contentType: mimeType });
    const metadata = await ctx.db.system.get("_storage", storageId);
    if (!metadata?.contentType) throw new Error("Storage fixture metadata is incomplete.");
    return {
      storageId,
      contentType: metadata.contentType,
      size: metadata.size,
    };
  });
  return {
    storageId: result.storageId,
    digest,
    mimeType: result.contentType,
    sizeBytes: BigInt(result.size),
  };
}

describe("Sprint 6 Trade Document authorization and lifecycle", () => {
  it("denies side-invisible replace, completion, and review without disclosing the record", async () => {
    const fixture = await createFixture();
    const stored = await storeFixture(fixture.t, "importer-only document");
    const uploaded = await fixture.importer.authenticated.mutation(
      api.tradeDocuments.completeUpload,
      {
        orderId: fixture.orderId,
        ...stored,
        documentType: "import_permit",
        visibility: "importer",
      },
    );
    await fixture.t.mutation(internal.tradeDocuments.markScanResult, {
      versionId: uploaded.versionId,
      expectedScanState: "pending",
      scanState: "clean",
    });

    await expect(
      fixture.exporter.authenticated.mutation(api.tradeDocuments.replace, {
        orderId: fixture.orderId,
        documentId: uploaded.documentId,
        expectedVersion: 2n,
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "TRADE_DOCUMENT_FORBIDDEN" }),
    });
    const replacement = await storeFixture(fixture.t, "unauthorized replacement");
    await expect(
      fixture.exporter.authenticated.mutation(api.tradeDocuments.completeUpload, {
        orderId: fixture.orderId,
        documentId: uploaded.documentId,
        expectedDocumentVersion: 2n,
        ...replacement,
        documentType: "import_permit",
        visibility: "importer",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "TRADE_DOCUMENT_FORBIDDEN" }),
    });
    await expect(
      fixture.exporter.authenticated.mutation(api.tradeDocuments.review, {
        orderId: fixture.orderId,
        versionId: uploaded.versionId,
        expectedReviewState: "unreviewed",
        reviewState: "accepted",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "TRADE_DOCUMENT_FORBIDDEN" }),
    });

    const state = await fixture.t.run(async (ctx) => ({
      document: await ctx.db.get("tradeDocuments", uploaded.documentId),
      versions: await ctx.db
        .query("tradeDocumentVersions")
        .withIndex("by_documentId_and_versionNumber", (index) =>
          index.eq("documentId", uploaded.documentId),
        )
        .take(10),
    }));
    expect(state.document).toMatchObject({ currentVersionNumber: 1n, version: 2n });
    expect(state.versions).toHaveLength(1);
  });

  it("fails closed until clean, preserves replacement history, and audits scan and review", async () => {
    const fixture = await createFixture();
    const firstStored = await storeFixture(fixture.t, "commercial invoice v1");
    const first = await fixture.exporter.authenticated.mutation(api.tradeDocuments.completeUpload, {
      orderId: fixture.orderId,
      ...firstStored,
      documentType: "commercial invoice",
      visibility: "participants",
      issuer: "Exporter Trade Organization",
    });

    await expect(
      fixture.importer.authenticated.query(api.tradeDocuments.createDownloadUrl, {
        orderId: fixture.orderId,
        versionId: first.versionId,
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "TRADE_DOCUMENT_FORBIDDEN" }),
    });
    await fixture.t.mutation(internal.tradeDocuments.markScanResult, {
      versionId: first.versionId,
      expectedScanState: "pending",
      scanState: "clean",
    });
    await expect(
      fixture.importer.authenticated.query(api.tradeDocuments.createDownloadUrl, {
        orderId: fixture.orderId,
        versionId: first.versionId,
      }),
    ).resolves.toMatchObject({
      url: expect.any(String),
      digest: firstStored.digest,
    });
    await expect(
      fixture.exporter.authenticated.mutation(api.tradeDocuments.review, {
        orderId: fixture.orderId,
        versionId: first.versionId,
        expectedReviewState: "unreviewed",
        reviewState: "accepted",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "TRADE_DOCUMENT_STALE" }),
    });
    await expect(
      fixture.importer.authenticated.mutation(api.tradeDocuments.review, {
        orderId: fixture.orderId,
        versionId: first.versionId,
        expectedReviewState: "unreviewed",
        reviewState: "accepted",
        note: "Matches the accepted Trade Order.",
      }),
    ).resolves.toEqual({ reviewState: "accepted" });

    await expect(
      fixture.exporter.authenticated.mutation(api.tradeDocuments.replace, {
        orderId: fixture.orderId,
        documentId: first.documentId,
        expectedVersion: 2n,
      }),
    ).resolves.toMatchObject({ uploadUrl: expect.any(String) });
    const secondStored = await storeFixture(fixture.t, "commercial invoice v2");
    const second = await fixture.exporter.authenticated.mutation(
      api.tradeDocuments.completeUpload,
      {
        orderId: fixture.orderId,
        documentId: first.documentId,
        expectedDocumentVersion: 2n,
        ...secondStored,
        documentType: "commercial invoice",
        visibility: "participants",
      },
    );
    expect(second).toMatchObject({ versionNumber: 2n, scanState: "pending" });
    await fixture.t.mutation(internal.tradeDocuments.markScanResult, {
      versionId: second.versionId,
      expectedScanState: "pending",
      scanState: "rejected",
    });
    await expect(
      fixture.importer.authenticated.query(api.tradeDocuments.createDownloadUrl, {
        orderId: fixture.orderId,
        versionId: second.versionId,
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "TRADE_DOCUMENT_FORBIDDEN" }),
    });

    const state = await fixture.t.run(async (ctx) => {
      const versionIds = new Set<string>([first.versionId, second.versionId]);
      const versions = await ctx.db
        .query("tradeDocumentVersions")
        .withIndex("by_documentId_and_versionNumber", (index) =>
          index.eq("documentId", first.documentId),
        )
        .take(10);
      const audits = (await ctx.db.query("auditEvents").take(20)).filter((event) =>
        versionIds.has(event.entityId),
      );
      return { versions, audits };
    });
    expect(state.versions).toHaveLength(2);
    expect(state.versions[0]).toMatchObject({
      _id: first.versionId,
      digest: firstStored.digest,
      storageId: firstStored.storageId,
      scanState: "clean",
      reviewState: "accepted",
    });
    expect(state.versions[1]).toMatchObject({
      _id: second.versionId,
      digest: secondStored.digest,
      storageId: secondStored.storageId,
      supersedesVersionId: first.versionId,
      scanState: "rejected",
      reviewState: "unreviewed",
    });
    expect(state.audits.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "trade_document.version_uploaded",
        "trade_document.scan_clean",
        "trade_document.review_accepted",
        "trade_document.scan_rejected",
      ]),
    );
  });

  it("serializes concurrent replacement completion to one immutable successor", async () => {
    const fixture = await createFixture();
    const originalStored = await storeFixture(fixture.t, "packing list v1");
    const original = await fixture.exporter.authenticated.mutation(
      api.tradeDocuments.completeUpload,
      {
        orderId: fixture.orderId,
        ...originalStored,
        documentType: "packing_list",
        visibility: "participants",
      },
    );
    const left = await storeFixture(fixture.t, "packing list v2-left");
    const right = await storeFixture(fixture.t, "packing list v2-right");
    const common = {
      orderId: fixture.orderId,
      documentId: original.documentId,
      expectedDocumentVersion: 2n,
      documentType: "packing_list",
      visibility: "participants" as const,
    };
    const results = await Promise.allSettled([
      fixture.exporter.authenticated.mutation(api.tradeDocuments.completeUpload, {
        ...common,
        ...left,
      }),
      fixture.exporter.authenticated.mutation(api.tradeDocuments.completeUpload, {
        ...common,
        ...right,
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejection = results.find((result) => result.status === "rejected");
    expect(rejection).toMatchObject({
      status: "rejected",
      reason: { data: expect.objectContaining({ code: "TRADE_DOCUMENT_STALE" }) },
    });

    const state = await fixture.t.run(async (ctx) => ({
      document: await ctx.db.get("tradeDocuments", original.documentId),
      versions: await ctx.db
        .query("tradeDocumentVersions")
        .withIndex("by_documentId_and_versionNumber", (index) =>
          index.eq("documentId", original.documentId),
        )
        .take(10),
    }));
    expect(state.document).toMatchObject({ currentVersionNumber: 2n, version: 3n });
    expect(state.versions).toHaveLength(2);
    expect(state.versions[1]).toMatchObject({
      versionNumber: 2n,
      supersedesVersionId: original.versionId,
    });
  });
});
