import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { businessError } from "./lib/errors";
import { requireTradeOrderParticipant } from "./lib/tradeOrderAuthorization";
import {
  tradeDocumentReviewStateValidator,
  tradeDocumentScanStateValidator,
  tradeDocumentVisibilityValidator,
} from "./validators";

const versionValidator = v.object({
  id: v.id("tradeDocumentVersions"),
  versionNumber: v.int64(),
  digest: v.string(),
  mimeType: v.string(),
  sizeBytes: v.int64(),
  uploaderOrganizationId: v.id("organizations"),
  issuer: v.optional(v.string()),
  issuedAt: v.optional(v.string()),
  expiresAt: v.optional(v.string()),
  visibility: tradeDocumentVisibilityValidator,
  scanState: tradeDocumentScanStateValidator,
  reviewState: tradeDocumentReviewStateValidator,
  createdAt: v.number(),
});

const documentValidator = v.object({
  id: v.id("tradeDocuments"),
  orderId: v.id("orders"),
  documentType: v.string(),
  visibility: tradeDocumentVisibilityValidator,
  currentVersionNumber: v.int64(),
  version: v.int64(),
  versions: v.array(versionValidator),
});

function validateDocumentType(value: string) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, "_").toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/u.test(normalized)) {
    throw businessError("TRADE_DOCUMENT_INVALID");
  }
  return normalized;
}

function validateDigest(value: string) {
  const normalized = value.toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(normalized)) {
    throw businessError("TRADE_DOCUMENT_INVALID");
  }
  return normalized;
}

function storageDigestHex(value: string) {
  if (/^[a-f0-9]{64}$/iu.test(value)) return value.toLowerCase();
  try {
    const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
    if (bytes.length !== 32) throw new Error("Invalid SHA-256 length.");
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    throw businessError("TRADE_DOCUMENT_INVALID");
  }
}

function canSee(
  side: "importer" | "exporter",
  visibility: "participants" | "importer" | "exporter",
) {
  return visibility === "participants" || visibility === side;
}

export const createUpload = mutation({
  args: { orderId: v.id("orders") },
  returns: v.object({ uploadUrl: v.string() }),
  handler: async (ctx, args) => {
    await requireTradeOrderParticipant(ctx, args.orderId, { verified: true });
    return { uploadUrl: await ctx.storage.generateUploadUrl() };
  },
});

export const replace = mutation({
  args: {
    orderId: v.id("orders"),
    documentId: v.id("tradeDocuments"),
    expectedVersion: v.int64(),
  },
  returns: v.object({ uploadUrl: v.string() }),
  handler: async (ctx, args) => {
    const participant = await requireTradeOrderParticipant(ctx, args.orderId, { verified: true });
    const document = await ctx.db.get("tradeDocuments", args.documentId);
    if (
      !document ||
      document.orderId !== participant.order._id ||
      !canSee(participant.side, document.visibility)
    ) {
      throw businessError("TRADE_DOCUMENT_FORBIDDEN");
    }
    if (document.version !== args.expectedVersion) {
      throw businessError("TRADE_DOCUMENT_STALE");
    }
    return { uploadUrl: await ctx.storage.generateUploadUrl() };
  },
});

export const completeUpload = mutation({
  args: {
    orderId: v.id("orders"),
    documentId: v.optional(v.id("tradeDocuments")),
    expectedDocumentVersion: v.optional(v.int64()),
    storageId: v.id("_storage"),
    documentType: v.string(),
    digest: v.string(),
    mimeType: v.string(),
    sizeBytes: v.int64(),
    visibility: tradeDocumentVisibilityValidator,
    issuer: v.optional(v.string()),
    issuedAt: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
  },
  returns: v.object({
    documentId: v.id("tradeDocuments"),
    versionId: v.id("tradeDocumentVersions"),
    versionNumber: v.int64(),
    scanState: v.literal("pending"),
  }),
  handler: async (ctx, args) => {
    const participant = await requireTradeOrderParticipant(ctx, args.orderId, { verified: true });
    if (!participant.order.supplierOrganizationId) {
      throw businessError("TRADE_DOCUMENT_INVALID");
    }
    const digest = validateDigest(args.digest);
    const documentType = validateDocumentType(args.documentType);
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (
      !metadata ||
      storageDigestHex(metadata.sha256) !== digest ||
      BigInt(metadata.size) !== args.sizeBytes ||
      metadata.contentType !== args.mimeType ||
      args.sizeBytes <= 0n ||
      args.sizeBytes > 25_000_000n ||
      args.mimeType.length > 120
    ) {
      throw businessError("TRADE_DOCUMENT_INVALID");
    }
    let document = args.documentId ? await ctx.db.get("tradeDocuments", args.documentId) : null;
    if (args.documentId) {
      if (
        !document ||
        document.orderId !== participant.order._id ||
        !canSee(participant.side, document.visibility)
      ) {
        throw businessError("TRADE_DOCUMENT_FORBIDDEN");
      }
      if (
        args.expectedDocumentVersion === undefined ||
        document.version !== args.expectedDocumentVersion
      ) {
        throw businessError("TRADE_DOCUMENT_STALE");
      }
    }
    const now = Date.now();
    let documentId = document?._id;
    if (!documentId) {
      documentId = await ctx.db.insert("tradeDocuments", {
        orderId: participant.order._id,
        importerOrganizationId: participant.order.buyerOrganizationId,
        exporterOrganizationId: participant.order.supplierOrganizationId,
        documentType,
        visibility: args.visibility,
        currentVersionNumber: 0n,
        createdByUserId: participant.principal.user._id,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      document = await ctx.db.get("tradeDocuments", documentId);
    }
    const previousVersionId = document?.currentVersionId;
    const versionNumber = (document?.currentVersionNumber ?? 0n) + 1n;
    const versionId = await ctx.db.insert("tradeDocumentVersions", {
      documentId,
      orderId: participant.order._id,
      versionNumber,
      storageId: args.storageId,
      digest,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      uploaderOrganizationId: participant.organization._id,
      uploaderUserId: participant.principal.user._id,
      ...(args.issuer ? { issuer: args.issuer.trim().slice(0, 160) } : {}),
      ...(args.issuedAt ? { issuedAt: args.issuedAt } : {}),
      ...(args.expiresAt ? { expiresAt: args.expiresAt } : {}),
      visibility: args.visibility,
      scanState: "pending",
      reviewState: "unreviewed",
      ...(previousVersionId ? { supersedesVersionId: previousVersionId } : {}),
      createdAt: now,
    });
    await ctx.db.patch("tradeDocuments", documentId, {
      documentType,
      visibility: args.visibility,
      currentVersionId: versionId,
      currentVersionNumber: versionNumber,
      updatedAt: now,
      version: (document?.version ?? 0n) + 1n,
    });
    await ctx.db.insert("auditEvents", {
      entityType: "trade_document_version",
      entityId: versionId,
      organizationId: participant.organization._id,
      actorUserId: participant.principal.user._id,
      actorWalletAddress: participant.principal.wallet.address,
      action: "trade_document.version_uploaded",
      correlationId: crypto.randomUUID(),
      changedFields: ["digest", "scanState", "versionNumber"],
      occurredAt: now,
    });
    return { documentId, versionId, versionNumber, scanState: "pending" as const };
  },
});

export const markScanResult = internalMutation({
  args: {
    versionId: v.id("tradeDocumentVersions"),
    expectedScanState: v.literal("pending"),
    scanState: v.union(v.literal("clean"), v.literal("rejected")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const version = await ctx.db.get("tradeDocumentVersions", args.versionId);
    if (!version || version.scanState !== args.expectedScanState) {
      throw businessError("TRADE_DOCUMENT_STALE");
    }
    const now = Date.now();
    await ctx.db.patch("tradeDocumentVersions", version._id, { scanState: args.scanState });
    await ctx.db.insert("auditEvents", {
      entityType: "trade_document_version",
      entityId: version._id,
      organizationId: version.uploaderOrganizationId,
      action: `trade_document.scan_${args.scanState}`,
      correlationId: crypto.randomUUID(),
      changedFields: ["scanState"],
      occurredAt: now,
    });
    return null;
  },
});

export const list = query({
  args: { orderId: v.id("orders") },
  returns: v.array(documentValidator),
  handler: async (ctx, args) => {
    const participant = await requireTradeOrderParticipant(ctx, args.orderId);
    const documents = await ctx.db
      .query("tradeDocuments")
      .withIndex("by_orderId", (index) => index.eq("orderId", participant.order._id))
      .take(100);
    const visible = documents.filter((document) => canSee(participant.side, document.visibility));
    return Promise.all(
      visible.map(async (document) => {
        const versions = await ctx.db
          .query("tradeDocumentVersions")
          .withIndex("by_documentId_and_versionNumber", (index) =>
            index.eq("documentId", document._id),
          )
          .take(100);
        return {
          id: document._id,
          orderId: document.orderId,
          documentType: document.documentType,
          visibility: document.visibility,
          currentVersionNumber: document.currentVersionNumber,
          version: document.version,
          versions: versions
            .filter((version) => canSee(participant.side, version.visibility))
            .map((version) => ({
              id: version._id,
              versionNumber: version.versionNumber,
              digest: version.digest,
              mimeType: version.mimeType,
              sizeBytes: version.sizeBytes,
              uploaderOrganizationId: version.uploaderOrganizationId,
              ...(version.issuer ? { issuer: version.issuer } : {}),
              ...(version.issuedAt ? { issuedAt: version.issuedAt } : {}),
              ...(version.expiresAt ? { expiresAt: version.expiresAt } : {}),
              visibility: version.visibility,
              scanState: version.scanState,
              reviewState: version.reviewState,
              createdAt: version.createdAt,
            })),
        };
      }),
    );
  },
});

export const createDownloadUrl = query({
  args: {
    orderId: v.id("orders"),
    versionId: v.id("tradeDocumentVersions"),
  },
  returns: v.object({ url: v.string(), digest: v.string() }),
  handler: async (ctx, args) => {
    const participant = await requireTradeOrderParticipant(ctx, args.orderId);
    const version = await ctx.db.get("tradeDocumentVersions", args.versionId);
    if (
      !version ||
      version.orderId !== participant.order._id ||
      !canSee(participant.side, version.visibility) ||
      version.scanState !== "clean"
    ) {
      throw businessError("TRADE_DOCUMENT_FORBIDDEN");
    }
    const url = await ctx.storage.getUrl(version.storageId);
    if (!url) throw businessError("TRADE_DOCUMENT_FORBIDDEN");
    return { url, digest: version.digest };
  },
});

export const review = mutation({
  args: {
    orderId: v.id("orders"),
    versionId: v.id("tradeDocumentVersions"),
    expectedReviewState: v.literal("unreviewed"),
    reviewState: v.union(v.literal("accepted"), v.literal("rejected")),
    note: v.optional(v.string()),
  },
  returns: v.object({ reviewState: tradeDocumentReviewStateValidator }),
  handler: async (ctx, args) => {
    const participant = await requireTradeOrderParticipant(ctx, args.orderId, { verified: true });
    const version = await ctx.db.get("tradeDocumentVersions", args.versionId);
    if (
      !version ||
      version.orderId !== participant.order._id ||
      !canSee(participant.side, version.visibility)
    ) {
      throw businessError("TRADE_DOCUMENT_FORBIDDEN");
    }
    if (
      version.reviewState !== args.expectedReviewState ||
      version.scanState !== "clean" ||
      version.uploaderOrganizationId === participant.organization._id
    ) {
      throw businessError("TRADE_DOCUMENT_STALE");
    }
    const now = Date.now();
    await ctx.db.patch("tradeDocumentVersions", version._id, {
      reviewState: args.reviewState,
      reviewedByUserId: participant.principal.user._id,
      reviewedAt: now,
      ...(args.note ? { reviewNote: args.note.trim().slice(0, 500) } : {}),
    });
    await ctx.db.insert("auditEvents", {
      entityType: "trade_document_version",
      entityId: version._id,
      organizationId: participant.organization._id,
      actorUserId: participant.principal.user._id,
      actorWalletAddress: participant.principal.wallet.address,
      action: `trade_document.review_${args.reviewState}`,
      correlationId: crypto.randomUUID(),
      changedFields: ["reviewState", "reviewedByUserId", "reviewedAt"],
      occurredAt: now,
    });
    return { reviewState: args.reviewState };
  },
});
