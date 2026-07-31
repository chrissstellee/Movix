import { computeDeliveryHash, computeShipmentHash } from "@repo/stellar";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/authorization";

/**
 * S8-FL01: Prepares arguments and performs security authorization checks for Exporter escrow acceptance.
 */
export const prepareAcceptIntent = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (!order.supplierOrganizationId) {
      throw new Error("Order has no assigned supplier organization");
    }

    // Must be Exporter (supplier) with owner, admin, or operations role
    const authContext = await requireRole(ctx, order.supplierOrganizationId, [
      "owner",
      "admin",
      "operations",
    ]);

    const supplierOrg = authContext.organization;
    if (supplierOrg.verificationStatus !== "verified") {
      throw new Error("Exporter organization must be verified to accept escrow");
    }

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    if (!escrow) {
      throw new Error("Escrow record not found for this order");
    }

    if (escrow.status !== "funded" && escrow.status !== "funding_submitted") {
      throw new Error(`Escrow status is ${escrow.status}, expected funded or funding_submitted`);
    }

    return {
      orderId: order._id,
      escrowId: escrow._id,
      escrowKey: escrow.escrowKey,
      supplierWalletAddress: escrow.supplierWalletAddress,
      termsHash: escrow.termsHash,
      contractId: escrow.contractId,
      amountBaseUnits: escrow.amountBaseUnits,
      acceptBy: escrow.acceptBy,
    };
  },
});

/**
 * S8-FL03 & S8-FL04: Records agricultural shipment evidence off-chain and prepares mark_shipped intent.
 */
export const recordShipmentIntent = mutation({
  args: {
    orderId: v.id("orders"),
    carrierName: v.string(),
    trackingOrDocumentNumber: v.string(),
    phytosanitaryCertNumber: v.optional(v.string()),
    portOfLoading: v.string(),
    portOfDischarge: v.string(),
    shippedDate: v.string(),
    vesselOrFlightId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (!order.supplierOrganizationId) {
      throw new Error("Order has no assigned supplier organization");
    }

    const authContext = await requireRole(ctx, order.supplierOrganizationId, [
      "owner",
      "admin",
      "operations",
    ]);

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    if (!escrow) {
      throw new Error("Escrow record not found for this order");
    }

    if (escrow.status !== "accepted") {
      throw new Error(
        `Escrow status is ${escrow.status}, expected accepted before recording shipment`,
      );
    }

    if (!order.acceptedRevisionId) {
      throw new Error("Order missing accepted revision ID");
    }

    const evidencePayload = {
      orderId: order._id,
      revisionId: order.acceptedRevisionId,
      carrierName: args.carrierName,
      trackingOrDocumentNumber: args.trackingOrDocumentNumber,
      phytosanitaryCertNumber: args.phytosanitaryCertNumber,
      portOfLoading: args.portOfLoading,
      portOfDischarge: args.portOfDischarge,
      shippedDate: args.shippedDate,
      vesselOrFlightId: args.vesselOrFlightId,
    };

    const { hashHex: shipmentHash } = computeShipmentHash(evidencePayload);

    const now = Date.now();
    const shipmentId = await ctx.db.insert("shipments", {
      orderId: order._id,
      revisionId: order.acceptedRevisionId,
      buyerOrganizationId: order.buyerOrganizationId,
      supplierOrganizationId: order.supplierOrganizationId,
      status: "in_transit",
      shipmentHash,
      escrowId: escrow._id,
      network: escrow.network,
      contractId: escrow.contractId,
      carrier: args.carrierName,
      trackingNumber: args.trackingOrDocumentNumber,
      createdByUserId: authContext.principal.user._id,
      shippedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });

    return {
      orderId: order._id,
      shipmentId,
      escrowId: escrow._id,
      escrowKey: escrow.escrowKey,
      supplierWalletAddress: escrow.supplierWalletAddress!,
      shipmentHash,
      contractId: escrow.contractId,
    };
  },
});

/**
 * S8-FL05 & S8-FL06: Records Importer receiving inspection report and prepares confirm_delivery intent.
 */
export const confirmDeliveryIntent = mutation({
  args: {
    orderId: v.id("orders"),
    receivedDate: v.string(),
    receivingLocation: v.string(),
    inspectionCertificateNumber: v.optional(v.string()),
    inspectionResult: v.union(v.literal("accepted_full"), v.literal("accepted_conditional")),
    inspectorName: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const authContext = await requireRole(ctx, order.buyerOrganizationId, [
      "owner",
      "admin",
      "finance",
    ]);

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    if (!escrow) {
      throw new Error("Escrow record not found for this order");
    }

    if (escrow.status !== "shipped") {
      throw new Error(
        `Escrow status is ${escrow.status}, expected shipped before confirming delivery`,
      );
    }

    if (!order.acceptedRevisionId) {
      throw new Error("Order missing accepted revision ID");
    }

    const deliveryPayload = {
      orderId: order._id,
      revisionId: order.acceptedRevisionId,
      receivedDate: args.receivedDate,
      receivingLocation: args.receivingLocation,
      inspectionCertificateNumber: args.inspectionCertificateNumber,
      inspectionResult: args.inspectionResult,
      inspectorName: args.inspectorName,
      notes: args.notes,
    };

    const { hashHex: deliveryHash } = computeDeliveryHash(deliveryPayload);

    const now = Date.now();
    const deliveryConfirmationId = await ctx.db.insert("deliveryConfirmations", {
      orderId: order._id,
      revisionId: order.acceptedRevisionId,
      buyerOrganizationId: order.buyerOrganizationId,
      supplierOrganizationId: order.supplierOrganizationId!,
      escrowId: escrow._id,
      receivedDate: args.receivedDate,
      receivingLocation: args.receivingLocation,
      inspectionCertificateNumber: args.inspectionCertificateNumber,
      inspectionResult: args.inspectionResult,
      inspectorName: args.inspectorName,
      deliveryHash,
      notes: args.notes,
      status: "pending_onchain",
      createdByUserId: authContext.principal.user._id,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });

    return {
      orderId: order._id,
      deliveryConfirmationId,
      escrowId: escrow._id,
      escrowKey: escrow.escrowKey,
      buyerWalletAddress: escrow.buyerWalletAddress!,
      supplierWalletAddress: escrow.supplierWalletAddress!,
      deliveryHash,
      contractId: escrow.contractId,
      amountBaseUnits: escrow.amountBaseUnits,
    };
  },
});

/**
 * Records Exporter on-chain accept transaction submission and updates escrow status to accepted.
 */
export const recordAcceptSubmission = mutation({
  args: {
    orderId: v.id("orders"),
    transactionHash: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    if (!escrow) throw new Error("Escrow record not found");

    const now = Date.now();
    await ctx.db.patch(escrow._id, {
      status: "accepted",
      submittedTransactionHash: args.transactionHash,
      updatedAt: now,
    });

    await ctx.db.patch(order._id, {
      settlementStatus: "accepted",
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Records Exporter on-chain mark_shipped submission and updates escrow status to shipped.
 */
export const recordShipmentSubmission = mutation({
  args: {
    orderId: v.id("orders"),
    transactionHash: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    if (!escrow) throw new Error("Escrow record not found");

    const now = Date.now();
    await ctx.db.patch(escrow._id, {
      status: "shipped",
      submittedTransactionHash: args.transactionHash,
      updatedAt: now,
    });

    await ctx.db.patch(order._id, {
      settlementStatus: "shipped",
      fulfillmentStatus: "shipped",
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Records Importer on-chain confirm_delivery submission and updates escrow status to released.
 */
export const recordReleaseSubmission = mutation({
  args: {
    orderId: v.id("orders"),
    transactionHash: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    if (!escrow) throw new Error("Escrow record not found");

    const now = Date.now();
    await ctx.db.patch(escrow._id, {
      status: "released",
      submittedTransactionHash: args.transactionHash,
      updatedAt: now,
    });

    await ctx.db.patch(order._id, {
      settlementStatus: "released",
      fulfillmentStatus: "delivery_confirmed",
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * S8-FL08 & S8-FL09: Queries full trade fulfillment status, timeline, shipment evidence, and release receipt.
 */
export const getFulfillmentDetails = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      return null;
    }

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    const shipment = await ctx.db
      .query("shipments")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    const deliveryConfirmation = await ctx.db
      .query("deliveryConfirmations")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    const buyerOrg = await ctx.db.get(order.buyerOrganizationId);
    const supplierOrg = order.supplierOrganizationId
      ? await ctx.db.get(order.supplierOrganizationId)
      : null;

    return {
      order,
      escrow,
      shipment,
      deliveryConfirmation,
      buyerOrg,
      supplierOrg,
    };
  },
});
