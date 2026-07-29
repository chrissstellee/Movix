import { hashEvidenceManifest } from "@repo/stellar/evidence-manifests";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { businessError } from "./lib/errors";
import { requireTradeOrderParticipant } from "./lib/tradeOrderAuthorization";
import { shipmentStatusValidator } from "./validators";

const transitions = {
  draft: ["booked", "shipped", "cancelled"],
  booked: ["in_transit", "shipped", "cancelled"],
  in_transit: ["shipped", "arrived", "cancelled"],
  shipped: ["in_transit", "arrived"],
  arrived: ["delivery_confirmed"],
  delivery_confirmed: [],
  cancelled: [],
} as const;

function canTransition(current: keyof typeof transitions, next: keyof typeof transitions) {
  return (transitions[current] as readonly string[]).includes(next);
}

function validDigest(value: string | undefined) {
  return value === undefined || /^[a-f0-9]{64}$/u.test(value);
}

function canSeeDocument(
  side: "importer" | "exporter",
  visibility: "participants" | "importer" | "exporter",
) {
  return visibility === "participants" || visibility === side;
}

function bounded(value: string | undefined, maximum = 160) {
  if (!value) return undefined;
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > maximum) throw businessError("SHIPMENT_INVALID");
  return normalized;
}

const shipmentValidator = v.object({
  id: v.id("shipments"),
  orderId: v.id("orders"),
  revisionId: v.optional(v.id("orderRevisions")),
  status: shipmentStatusValidator,
  shipmentHash: v.string(),
  evidenceManifestDigest: v.optional(v.string()),
  carrier: v.optional(v.string()),
  trackingNumber: v.optional(v.string()),
  shippedAt: v.optional(v.number()),
  arrivedAt: v.optional(v.number()),
  deliveryConfirmedAt: v.optional(v.number()),
  version: v.int64(),
});

const eventValidator = v.object({
  id: v.id("shipmentEvents"),
  status: shipmentStatusValidator,
  actorOrganizationId: v.id("organizations"),
  evidenceManifestDigest: v.optional(v.string()),
  note: v.optional(v.string()),
  occurredAt: v.number(),
});

export const create = mutation({
  args: {
    orderId: v.id("orders"),
    expectedOrderVersion: v.int64(),
    shipmentHash: v.string(),
    escrowId: v.optional(v.id("escrows")),
    contractId: v.optional(v.string()),
    originCountry: v.string(),
    destinationCountry: v.string(),
    plannedShipmentFrom: v.string(),
    plannedShipmentTo: v.string(),
    expectedArrivalFrom: v.string(),
    expectedArrivalTo: v.string(),
    carrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
  },
  returns: shipmentValidator,
  handler: async (ctx, args) => {
    const participant = await requireTradeOrderParticipant(ctx, args.orderId, { verified: true });
    if (
      participant.side !== "exporter" ||
      participant.order.version !== args.expectedOrderVersion ||
      !participant.order.currentRevisionId ||
      participant.order.acceptedRevisionId !== participant.order.currentRevisionId ||
      participant.order.agreementStatus !== "accepted" ||
      !validDigest(args.shipmentHash) ||
      args.plannedShipmentFrom > args.plannedShipmentTo ||
      args.expectedArrivalFrom > args.expectedArrivalTo ||
      args.plannedShipmentTo > args.expectedArrivalTo
    ) {
      throw businessError("SHIPMENT_INVALID");
    }
    if (Boolean(args.escrowId) !== Boolean(args.contractId)) {
      throw businessError("SHIPMENT_INVALID");
    }
    const escrow = args.escrowId ? await ctx.db.get("escrows", args.escrowId) : null;
    if (
      args.escrowId &&
      (!escrow ||
        escrow.orderId !== participant.order._id ||
        escrow.buyerOrganizationId !== participant.order.buyerOrganizationId ||
        escrow.supplierOrganizationId !== participant.organization._id ||
        escrow.network !== "testnet" ||
        escrow.contractId !== args.contractId)
    ) {
      throw businessError("SHIPMENT_INVALID");
    }
    const existing = await ctx.db
      .query("shipments")
      .withIndex("by_orderId", (index) => index.eq("orderId", participant.order._id))
      .unique();
    if (existing) throw businessError("SHIPMENT_STALE");
    const revision = await ctx.db.get("orderRevisions", participant.order.currentRevisionId);
    const lines = revision
      ? await ctx.db
          .query("orderLines")
          .withIndex("by_revisionId", (index) => index.eq("revisionId", revision._id))
          .take(101)
      : [];
    if (
      !revision ||
      revision.destinationCountry === undefined ||
      revision.destinationCountry !== args.destinationCountry ||
      lines.length === 0 ||
      lines.some((line) => line.originCountry !== args.originCountry)
    ) {
      throw businessError("SHIPMENT_INVALID");
    }
    const now = Date.now();
    const shipmentId = await ctx.db.insert("shipments", {
      orderId: participant.order._id,
      revisionId: revision._id,
      buyerOrganizationId: participant.order.buyerOrganizationId,
      supplierOrganizationId: participant.organization._id,
      status: "draft",
      shipmentHash: args.shipmentHash,
      ...(escrow
        ? { escrowId: escrow._id, contractId: escrow.contractId, network: "testnet" as const }
        : {}),
      originCountry: args.originCountry,
      destinationCountry: args.destinationCountry,
      plannedShipmentFrom: args.plannedShipmentFrom,
      plannedShipmentTo: args.plannedShipmentTo,
      expectedArrivalFrom: args.expectedArrivalFrom,
      expectedArrivalTo: args.expectedArrivalTo,
      ...(bounded(args.carrier) ? { carrier: bounded(args.carrier) } : {}),
      ...(bounded(args.trackingNumber) ? { trackingNumber: bounded(args.trackingNumber) } : {}),
      createdByUserId: participant.principal.user._id,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    await ctx.db.insert("shipmentEvents", {
      shipmentId,
      orderId: participant.order._id,
      status: "draft",
      actorOrganizationId: participant.organization._id,
      actorUserId: participant.principal.user._id,
      occurredAt: now,
    });
    const shipment = (await ctx.db.get("shipments", shipmentId))!;
    return {
      id: shipment._id,
      orderId: shipment.orderId,
      revisionId: shipment.revisionId,
      status: shipment.status,
      shipmentHash: shipment.shipmentHash,
      ...(shipment.carrier ? { carrier: shipment.carrier } : {}),
      ...(shipment.trackingNumber ? { trackingNumber: shipment.trackingNumber } : {}),
      version: shipment.version,
    };
  },
});

export const recordStatus = mutation({
  args: {
    orderId: v.id("orders"),
    shipmentId: v.id("shipments"),
    expectedVersion: v.int64(),
    status: shipmentStatusValidator,
    evidenceManifestDigest: v.optional(v.string()),
    documentVersionIds: v.optional(v.array(v.id("tradeDocumentVersions"))),
    note: v.optional(v.string()),
  },
  returns: shipmentValidator,
  handler: async (ctx, args) => {
    const participant = await requireTradeOrderParticipant(ctx, args.orderId, { verified: true });
    const shipment = await ctx.db.get("shipments", args.shipmentId);
    if (
      !shipment ||
      shipment.orderId !== participant.order._id ||
      shipment.version !== args.expectedVersion
    ) {
      throw businessError(shipment ? "SHIPMENT_STALE" : "SHIPMENT_INVALID");
    }
    if (!canTransition(shipment.status, args.status)) {
      throw businessError("SHIPMENT_INVALID");
    }
    if (
      (args.status === "delivery_confirmed" && participant.side !== "importer") ||
      (args.status !== "delivery_confirmed" && participant.side !== "exporter")
    ) {
      throw businessError("SHIPMENT_INVALID");
    }
    const evidenceKind =
      args.status === "shipped"
        ? ("shipment" as const)
        : args.status === "delivery_confirmed"
          ? ("delivery" as const)
          : null;
    if (!evidenceKind && (args.evidenceManifestDigest || args.documentVersionIds?.length)) {
      throw businessError("SHIPMENT_INVALID");
    }
    if (
      evidenceKind &&
      (!args.evidenceManifestDigest ||
        !validDigest(args.evidenceManifestDigest) ||
        !args.documentVersionIds ||
        args.documentVersionIds.length === 0 ||
        args.documentVersionIds.length > 100 ||
        new Set(args.documentVersionIds).size !== args.documentVersionIds.length ||
        !shipment.revisionId ||
        !shipment.escrowId ||
        shipment.network !== "testnet" ||
        !shipment.contractId ||
        participant.order.acceptedRevisionId !== shipment.revisionId ||
        participant.order.currentRevisionId !== shipment.revisionId)
    ) {
      throw businessError("SHIPMENT_INVALID");
    }
    if (evidenceKind) {
      const escrow = await ctx.db.get("escrows", shipment.escrowId!);
      const versions = await Promise.all(
        args.documentVersionIds!.map((versionId) => ctx.db.get("tradeDocumentVersions", versionId)),
      );
      if (
        !escrow ||
        escrow.orderId !== participant.order._id ||
        escrow.contractId !== shipment.contractId ||
        escrow.network !== shipment.network ||
        escrow.buyerOrganizationId !== participant.order.buyerOrganizationId ||
        escrow.supplierOrganizationId !== participant.order.supplierOrganizationId ||
        versions.some(
          (version) =>
            !version ||
            version.orderId !== participant.order._id ||
            version.scanState !== "clean" ||
            !canSeeDocument(participant.side, version.visibility),
        ) ||
        new Set(versions.map((version) => version!.digest)).size !== versions.length
      ) {
        throw businessError("SHIPMENT_INVALID");
      }
      const expectedDigest = await hashEvidenceManifest({
        kind: evidenceKind,
        orderId: participant.order._id,
        revisionId: shipment.revisionId!,
        escrowId: shipment.escrowId!,
        contractId: shipment.contractId!,
        network: "testnet",
        documentVersionDigests: versions.map((version) => version!.digest),
      });
      if (expectedDigest !== args.evidenceManifestDigest) {
        throw businessError("SHIPMENT_INVALID");
      }
    }
    const now = Date.now();
    const version = shipment.version + 1n;
    await ctx.db.patch("shipments", shipment._id, {
      status: args.status,
      ...(args.evidenceManifestDigest
        ? { evidenceManifestDigest: args.evidenceManifestDigest }
        : {}),
      ...(args.status === "shipped" ? { shippedAt: now } : {}),
      ...(args.status === "arrived" ? { arrivedAt: now } : {}),
      ...(args.status === "delivery_confirmed" ? { deliveryConfirmedAt: now } : {}),
      updatedAt: now,
      version,
    });
    await ctx.db.insert("shipmentEvents", {
      shipmentId: shipment._id,
      orderId: participant.order._id,
      status: args.status,
      actorOrganizationId: participant.organization._id,
      actorUserId: participant.principal.user._id,
      ...(args.evidenceManifestDigest
        ? { evidenceManifestDigest: args.evidenceManifestDigest }
        : {}),
      ...(bounded(args.note, 500) ? { note: bounded(args.note, 500) } : {}),
      occurredAt: now,
    });
    if (args.status === "shipped" || args.status === "delivery_confirmed") {
      await ctx.db.patch("orders", participant.order._id, {
        fulfillmentStatus: args.status,
        updatedAt: now,
        version: participant.order.version + 1n,
      });
    }
    const updated = (await ctx.db.get("shipments", shipment._id))!;
    return {
      id: updated._id,
      orderId: updated.orderId,
      ...(updated.revisionId ? { revisionId: updated.revisionId } : {}),
      status: updated.status,
      shipmentHash: updated.shipmentHash,
      ...(updated.evidenceManifestDigest
        ? { evidenceManifestDigest: updated.evidenceManifestDigest }
        : {}),
      ...(updated.carrier ? { carrier: updated.carrier } : {}),
      ...(updated.trackingNumber ? { trackingNumber: updated.trackingNumber } : {}),
      ...(updated.shippedAt ? { shippedAt: updated.shippedAt } : {}),
      ...(updated.arrivedAt ? { arrivedAt: updated.arrivedAt } : {}),
      ...(updated.deliveryConfirmedAt ? { deliveryConfirmedAt: updated.deliveryConfirmedAt } : {}),
      version: updated.version,
    };
  },
});

export const get = query({
  args: { orderId: v.id("orders") },
  returns: v.union(
    v.null(),
    v.object({
      shipment: shipmentValidator,
      events: v.array(eventValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const participant = await requireTradeOrderParticipant(ctx, args.orderId);
    const shipment = await ctx.db
      .query("shipments")
      .withIndex("by_orderId", (index) => index.eq("orderId", participant.order._id))
      .unique();
    if (!shipment) return null;
    const events = await ctx.db
      .query("shipmentEvents")
      .withIndex("by_shipmentId_and_occurredAt", (index) => index.eq("shipmentId", shipment._id))
      .take(100);
    return {
      shipment: {
        id: shipment._id,
        orderId: shipment.orderId,
        ...(shipment.revisionId ? { revisionId: shipment.revisionId } : {}),
        status: shipment.status,
        shipmentHash: shipment.shipmentHash,
        ...(shipment.evidenceManifestDigest
          ? { evidenceManifestDigest: shipment.evidenceManifestDigest }
          : {}),
        ...(shipment.carrier ? { carrier: shipment.carrier } : {}),
        ...(shipment.trackingNumber ? { trackingNumber: shipment.trackingNumber } : {}),
        ...(shipment.shippedAt ? { shippedAt: shipment.shippedAt } : {}),
        ...(shipment.arrivedAt ? { arrivedAt: shipment.arrivedAt } : {}),
        ...(shipment.deliveryConfirmedAt
          ? { deliveryConfirmedAt: shipment.deliveryConfirmedAt }
          : {}),
        version: shipment.version,
      },
      events: events.map((event) => ({
        id: event._id,
        status: event.status,
        actorOrganizationId: event.actorOrganizationId,
        ...(event.evidenceManifestDigest
          ? { evidenceManifestDigest: event.evidenceManifestDigest }
          : {}),
        ...(event.note ? { note: event.note } : {}),
        occurredAt: event.occurredAt,
      })),
    };
  },
});
