import { v } from "convex/values";

import { internalMutation } from "./_generated/server";

export const applyResult = internalMutation({
  args: {
    orderId: v.id("orders"),
    escrowId: v.id("escrows"),
    status: v.union(
      v.literal("funded"),
      v.literal("accepted"),
      v.literal("shipped"),
      v.literal("released"),
      v.literal("needs_reconciliation"),
    ),
    confirmedLedger: v.optional(v.int64()),
    mismatchFields: v.optional(v.array(v.string())),
    transactionHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const escrow = await ctx.db.get(args.escrowId);
    const order = await ctx.db.get(args.orderId);
    if (!escrow || !order) {
      throw new Error("Escrow or Order not found for reconciliation result");
    }

    const now = Date.now();
    const isMismatch = args.status === "needs_reconciliation";

    await ctx.db.patch(escrow._id, {
      status: args.status,
      reconciliationStatus: isMismatch ? "mismatch" : "current",
      confirmedLedger: args.confirmedLedger ?? escrow.confirmedLedger,
      confirmedAt: isMismatch ? escrow.confirmedAt : (escrow.confirmedAt ?? now),
      lastReconciledAt: now,
      mismatchFields: args.mismatchFields,
      updatedAt: now,
      version: (escrow.version ?? 1n) + 1n,
    });

    await ctx.db.patch(order._id, {
      settlementStatus: args.status,
      fulfillmentStatus:
        args.status === "shipped"
          ? "shipped"
          : args.status === "released"
          ? "delivery_confirmed"
          : order.fulfillmentStatus,
      updatedAt: now,
      version: (order.version ?? 1n) + 1n,
    });

    const txHash = args.transactionHash ?? escrow.submittedTransactionHash;

    if (txHash) {
      const txRecord = await ctx.db
        .query("transactionRecords")
        .withIndex("by_hash_network", (q) =>
          q.eq("hash", txHash).eq("network", "testnet"),
        )
        .first();

      if (txRecord) {
        await ctx.db.patch(txRecord._id, {
          status: isMismatch ? "needs_reconciliation" : "confirmed",
          ledger: args.confirmedLedger ?? txRecord.ledger,
          confirmedAt: isMismatch ? txRecord.confirmedAt : (txRecord.confirmedAt ?? now),
        });
      }
    }

    if (!isMismatch) {
      // Determine recipient for notification
      const recipientOrgId =
        args.status === "funded" || args.status === "shipped" || args.status === "released"
          ? order.supplierOrganizationId
          : order.buyerOrganizationId;

      if (recipientOrgId) {
        const idempotencyKey = `escrow_${args.status}_${escrow._id}`;
        const existingNotif = await ctx.db
          .query("notifications")
          .withIndex("by_recipientOrganizationId_and_idempotencyKey", (q) =>
            q
              .eq("recipientOrganizationId", recipientOrgId)
              .eq("idempotencyKey", idempotencyKey),
          )
          .first();

        if (!existingNotif) {
          await ctx.db.insert("notifications", {
            recipientOrganizationId: recipientOrgId,
            eventType: `escrow.${args.status}`,
            entityType: "order",
            entityId: order._id,
            actionUrl: `/orders/${order._id}`,
            idempotencyKey,
            status: "unread",
            createdAt: now,
          });
        }
      }

      await ctx.db.insert("auditEvents", {
        entityType: "escrow",
        entityId: escrow._id,
        organizationId: order.buyerOrganizationId,
        action: `escrow.${args.status}_confirmed`,
        correlationId: `escrow_${args.status}_${escrow._id}`,
        occurredAt: now,
      });
    } else {
      await ctx.db.insert("auditEvents", {
        entityType: "escrow",
        entityId: escrow._id,
        organizationId: order.buyerOrganizationId,
        action: "escrow.reconciliation_required",
        correlationId: `escrow_reconcile_${escrow._id}`,
        changedFields: args.mismatchFields,
        occurredAt: now,
      });
    }

    return { success: true };
  },
});
