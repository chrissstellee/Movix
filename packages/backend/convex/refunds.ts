import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireActiveMembership, requireRole } from "./lib/authorization";

/**
 * S9-RF01: Prepares refund proposal intent and computes SHA-256 terms hash metadata.
 */
export const prepareRefundProposalIntent = mutation({
  args: {
    orderId: v.id("orders"),
    reasonCode: v.string(),
    explanation: v.optional(v.string()),
    termsHash: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    if (!escrow) {
      throw new Error("Escrow record not found for this order");
    }

    if (!["funded", "accepted", "shipped"].includes(escrow.status)) {
      throw new Error(`Escrow status '${escrow.status}' is not eligible for mutual refund proposal`);
    }

    // Proposer must belong to either Buyer or Supplier organization
    let userOrgId = order.buyerOrganizationId;
    let proposerRole: "BUYER" | "SUPPLIER" = "BUYER";
    let counterpartyOrgId = order.supplierOrganizationId;

    try {
      await requireRole(ctx, order.buyerOrganizationId, ["owner", "admin", "procurement", "finance", "operations"]);
    } catch {
      if (order.supplierOrganizationId) {
        await requireRole(ctx, order.supplierOrganizationId, ["owner", "admin", "procurement", "finance", "operations"]);
        userOrgId = order.supplierOrganizationId;
        proposerRole = "SUPPLIER";
        counterpartyOrgId = order.buyerOrganizationId;
      } else {
        throw new Error("Caller does not belong to an authorized party organization");
      }
    }

    // Check for existing pending refund request
    const existingPending = await ctx.db
      .query("refundRequests")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", escrow._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingPending) {
      throw new Error("A mutual refund proposal is already pending for this escrow");
    }

    const now = Date.now();
    const resumeStatus = escrow.status;

    // Create refund request
    const refundRequestId = await ctx.db.insert("refundRequests", {
      escrowId: escrow._id,
      requestedByOrganizationId: userOrgId,
      counterpartyOrganizationId: counterpartyOrgId!,
      status: "pending",
      reasonCode: args.reasonCode,
      termsHash: args.termsHash,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });

    // Update escrow and order projections to refund_pending
    await ctx.db.patch(escrow._id, {
      status: "refund_pending",
      updatedAt: now,
      version: (escrow.version ?? 1n) + 1n,
    });

    await ctx.db.patch(order._id, {
      settlementStatus: "refund_pending",
      updatedAt: now,
      version: (order.version ?? 1n) + 1n,
    });

    // Send transactional notification to counterparty
    if (counterpartyOrgId) {
      const idempotencyKey = `refund_proposed_${refundRequestId}`;
      await ctx.db.insert("notifications", {
        recipientOrganizationId: counterpartyOrgId,
        eventType: "REFUND_PROPOSED",
        entityType: "order",
        entityId: order._id,
        actionUrl: `/orders/${order._id}`,
        idempotencyKey,
        status: "unread",
        createdAt: now,
      });
    }

    await ctx.db.insert("auditEvents", {
      entityType: "escrow",
      entityId: escrow._id,
      organizationId: userOrgId,
      action: "escrow.refund_proposed",
      correlationId: `refund_${refundRequestId}`,
      occurredAt: now,
    });

    return {
      refundRequestId,
      escrowId: escrow._id,
      escrowKey: escrow.escrowKey,
      contractId: escrow.contractId,
      termsHash: args.termsHash,
      resumeStatus,
      proposerRole,
    };
  },
});

/**
 * S9-RF02: Counterparty approval of mutual refund intent.
 */
export const approveRefundIntent = mutation({
  args: {
    orderId: v.id("orders"),
    termsHash: v.string(),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    if (!escrow) {
      throw new Error("Escrow record not found");
    }

    const refundRequest = await ctx.db
      .query("refundRequests")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", escrow._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (!refundRequest) {
      throw new Error("No pending refund request found");
    }

    if (refundRequest.termsHash !== args.termsHash) {
      throw new Error("Refund terms hash mismatch");
    }

    // Must be counterparty
    await requireActiveMembership(ctx, refundRequest.counterpartyOrganizationId);

    const now = Date.now();

    await ctx.db.patch(refundRequest._id, {
      status: "approved",
      updatedAt: now,
      version: (refundRequest.version ?? 1n) + 1n,
    });

    await ctx.db.patch(escrow._id, {
      status: "refunded",
      submittedTransactionHash: args.txHash ?? escrow.submittedTransactionHash,
      updatedAt: now,
      version: (escrow.version ?? 1n) + 1n,
    });

    await ctx.db.patch(order._id, {
      settlementStatus: "refunded",
      updatedAt: now,
      version: (order.version ?? 1n) + 1n,
    });

    // Notify proposer
    const idempotencyKey = `refund_approved_${refundRequest._id}`;
    await ctx.db.insert("notifications", {
      recipientOrganizationId: refundRequest.requestedByOrganizationId,
      eventType: "REFUND_APPROVED",
      entityType: "order",
      entityId: order._id,
      actionUrl: `/orders/${order._id}`,
      idempotencyKey,
      status: "unread",
      createdAt: now,
    });

    await ctx.db.insert("auditEvents", {
      entityType: "escrow",
      entityId: escrow._id,
      organizationId: refundRequest.counterpartyOrganizationId,
      action: "escrow.refund_approved",
      correlationId: `refund_app_${refundRequest._id}`,
      occurredAt: now,
    });

    return { success: true, status: "refunded" };
  },
});

/**
 * S9-RF03: Counterparty rejection of mutual refund intent.
 */
export const rejectRefundIntent = mutation({
  args: {
    orderId: v.id("orders"),
    termsHash: v.string(),
    rejectionReason: v.optional(v.string()),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    if (!escrow) {
      throw new Error("Escrow record not found");
    }

    const refundRequest = await ctx.db
      .query("refundRequests")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", escrow._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (!refundRequest) {
      throw new Error("No pending refund request found");
    }

    // Must be counterparty
    await requireActiveMembership(ctx, refundRequest.counterpartyOrganizationId);

    const now = Date.now();

    await ctx.db.patch(refundRequest._id, {
      status: "rejected",
      updatedAt: now,
      version: (refundRequest.version ?? 1n) + 1n,
    });

    const restoredStatus = "funded";

    await ctx.db.patch(escrow._id, {
      status: restoredStatus,
      updatedAt: now,
      version: (escrow.version ?? 1n) + 1n,
    });

    await ctx.db.patch(order._id, {
      settlementStatus: restoredStatus,
      updatedAt: now,
      version: (order.version ?? 1n) + 1n,
    });

    // Notify proposer
    const idempotencyKey = `refund_rejected_${refundRequest._id}`;
    await ctx.db.insert("notifications", {
      recipientOrganizationId: refundRequest.requestedByOrganizationId,
      eventType: "REFUND_REJECTED",
      entityType: "order",
      entityId: order._id,
      actionUrl: `/orders/${order._id}`,
      idempotencyKey,
      status: "unread",
      createdAt: now,
    });

    await ctx.db.insert("auditEvents", {
      entityType: "escrow",
      entityId: escrow._id,
      organizationId: refundRequest.counterpartyOrganizationId,
      action: "escrow.refund_rejected",
      correlationId: `refund_rej_${refundRequest._id}`,
      occurredAt: now,
    });

    return { success: true, restoredStatus };
  },
});

/**
 * S9-RF04: Proposer withdrawal of pending refund request.
 */
export const withdrawRefundIntent = mutation({
  args: {
    orderId: v.id("orders"),
    termsHash: v.string(),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    if (!escrow) {
      throw new Error("Escrow record not found");
    }

    const refundRequest = await ctx.db
      .query("refundRequests")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", escrow._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (!refundRequest) {
      throw new Error("No pending refund request found");
    }

    // Must be original proposer
    await requireActiveMembership(ctx, refundRequest.requestedByOrganizationId);

    const now = Date.now();

    await ctx.db.patch(refundRequest._id, {
      status: "withdrawn",
      updatedAt: now,
      version: (refundRequest.version ?? 1n) + 1n,
    });

    const restoredStatus = "funded";

    await ctx.db.patch(escrow._id, {
      status: restoredStatus,
      updatedAt: now,
      version: (escrow.version ?? 1n) + 1n,
    });

    await ctx.db.patch(order._id, {
      settlementStatus: restoredStatus,
      updatedAt: now,
      version: (order.version ?? 1n) + 1n,
    });

    // Notify counterparty
    const idempotencyKey = `refund_withdrawn_${refundRequest._id}`;
    await ctx.db.insert("notifications", {
      recipientOrganizationId: refundRequest.counterpartyOrganizationId,
      eventType: "REFUND_WITHDRAWN",
      entityType: "order",
      entityId: order._id,
      actionUrl: `/orders/${order._id}`,
      idempotencyKey,
      status: "unread",
      createdAt: now,
    });

    await ctx.db.insert("auditEvents", {
      entityType: "escrow",
      entityId: escrow._id,
      organizationId: refundRequest.requestedByOrganizationId,
      action: "escrow.refund_withdrawn",
      correlationId: `refund_wdr_${refundRequest._id}`,
      occurredAt: now,
    });

    return { success: true, restoredStatus };
  },
});

/**
 * S9-RF05: Check cancellation eligibility for unaccepted escrows after accept_by.
 */
export const checkCancellationEligibility = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      return { isEligible: false, reason: "Order not found" };
    }

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    if (!escrow) {
      return { isEligible: false, reason: "Escrow not found" };
    }

    if (escrow.status !== "funded") {
      return { isEligible: false, reason: `Status is '${escrow.status}', expected 'funded'` };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const acceptBySeconds = escrow.acceptBy ? Number(escrow.acceptBy) : undefined;

    if (!acceptBySeconds) {
      return { isEligible: false, reason: "No accept_by deadline set" };
    }

    if (nowSeconds < acceptBySeconds) {
      return {
        isEligible: false,
        acceptBy: acceptBySeconds,
        now: nowSeconds,
        reason: `Deadline not reached yet (${acceptBySeconds - nowSeconds}s remaining)`,
      };
    }

    return {
      isEligible: true,
      acceptBy: acceptBySeconds,
      now: nowSeconds,
      escrowKey: escrow.escrowKey,
      contractId: escrow.contractId,
      amountBaseUnits: escrow.amountBaseUnits,
      buyerWalletAddress: escrow.buyerWalletAddress,
    };
  },
});

/**
 * S9-RF05: Executes timeout cancellation intent for expired unaccepted escrow.
 */
export const cancelUnacceptedIntent = mutation({
  args: {
    orderId: v.id("orders"),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    await requireActiveMembership(ctx, order.buyerOrganizationId);

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    if (!escrow) {
      throw new Error("Escrow record not found");
    }

    if (escrow.status !== "funded") {
      throw new Error(`Escrow status is '${escrow.status}', cannot cancel unaccepted`);
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const acceptBySeconds = escrow.acceptBy ? Number(escrow.acceptBy) : undefined;

    if (acceptBySeconds && nowSeconds < acceptBySeconds) {
      throw new Error("Acceptance deadline has not expired yet");
    }

    const now = Date.now();

    await ctx.db.patch(escrow._id, {
      status: "cancelled",
      submittedTransactionHash: args.txHash ?? escrow.submittedTransactionHash,
      updatedAt: now,
      version: (escrow.version ?? 1n) + 1n,
    });

    await ctx.db.patch(order._id, {
      settlementStatus: "cancelled",
      updatedAt: now,
      version: (order.version ?? 1n) + 1n,
    });

    if (order.supplierOrganizationId) {
      const idempotencyKey = `escrow_cancelled_${escrow._id}`;
      await ctx.db.insert("notifications", {
        recipientOrganizationId: order.supplierOrganizationId,
        eventType: "ESCROW_CANCELLED",
        entityType: "order",
        entityId: order._id,
        actionUrl: `/orders/${order._id}`,
        idempotencyKey,
        status: "unread",
        createdAt: now,
      });
    }

    await ctx.db.insert("auditEvents", {
      entityType: "escrow",
      entityId: escrow._id,
      organizationId: order.buyerOrganizationId,
      action: "escrow.cancelled_unaccepted",
      correlationId: `cancel_${escrow._id}`,
      occurredAt: now,
    });

    return { success: true, status: "cancelled" };
  },
});

/**
 * Gets active pending refund request for an order.
 */
export const getActiveRefundRequest = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .first();

    if (!escrow) {
      return null;
    }

    return await ctx.db
      .query("refundRequests")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", escrow._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
  },
});
