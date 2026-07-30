import { v } from "convex/values";

import { internalMutation } from "./_generated/server";

export const applyResult = internalMutation({
  args: {
    orderId: v.id("orders"),
    escrowId: v.id("escrows"),
    status: v.union(v.literal("funded"), v.literal("needs_reconciliation")),
    confirmedLedger: v.optional(v.int64()),
    mismatchFields: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const escrow = await ctx.db.get(args.escrowId);
    const order = await ctx.db.get(args.orderId);
    if (!escrow || !order) {
      throw new Error("Escrow or Order not found for reconciliation result");
    }

    const now = Date.now();
    const isFunded = args.status === "funded";

    await ctx.db.patch(escrow._id, {
      status: isFunded ? "funded" : "needs_reconciliation",
      reconciliationStatus: isFunded ? "current" : "mismatch",
      confirmedLedger: args.confirmedLedger ?? escrow.confirmedLedger,
      confirmedAt: isFunded ? now : escrow.confirmedAt,
      lastReconciledAt: now,
      mismatchFields: args.mismatchFields,
      updatedAt: now,
      version: (escrow.version ?? 1n) + 1n,
    });

    await ctx.db.patch(order._id, {
      settlementStatus: isFunded ? "funded" : "needs_reconciliation",
      updatedAt: now,
      version: (order.version ?? 1n) + 1n,
    });

    if (escrow.submittedTransactionHash) {
      const txRecord = await ctx.db
        .query("transactionRecords")
        .withIndex("by_hash_network", (q) =>
          q.eq("hash", escrow.submittedTransactionHash!).eq("network", "testnet"),
        )
        .first();

      if (txRecord) {
        await ctx.db.patch(txRecord._id, {
          status: isFunded ? "confirmed" : "needs_reconciliation",
          ledger: args.confirmedLedger ?? txRecord.ledger,
          confirmedAt: isFunded ? now : txRecord.confirmedAt,
        });
      }
    }

    if (isFunded) {
      // Notify Exporter organization idempotently
      const idempotencyKey = `escrow_funded_${escrow._id}`;
      const existingNotif = await ctx.db
        .query("notifications")
        .withIndex("by_recipientOrganizationId_and_idempotencyKey", (q) =>
          q
            .eq("recipientOrganizationId", order.supplierOrganizationId!)
            .eq("idempotencyKey", idempotencyKey),
        )
        .first();

      if (!existingNotif) {
        await ctx.db.insert("notifications", {
          recipientOrganizationId: order.supplierOrganizationId!,
          eventType: "escrow.funded",
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
        action: "escrow.funding_confirmed",
        correlationId: `escrow_confirm_${escrow._id}`,
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
