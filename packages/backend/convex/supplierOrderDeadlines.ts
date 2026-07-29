import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { transitionSupplierCounts } from "./lib/orderCounts";

export const expire = internalMutation({
  args: {
    orderId: v.id("orders"),
    revisionId: v.id("orderRevisions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [order, revision] = await Promise.all([
      ctx.db.get("orders", args.orderId),
      ctx.db.get("orderRevisions", args.revisionId),
    ]);
    const now = Date.now();
    if (
      !order ||
      !revision ||
      order.currentRevisionId !== revision._id ||
      order.agreementStatus !== "sent" ||
      order.currentDecisionId ||
      order.supplierQueueState !== "requires_decision" ||
      revision.supplierAcceptanceDeadline === undefined ||
      now <= revision.supplierAcceptanceDeadline ||
      !order.supplierOrganizationId
    ) {
      return null;
    }
    await transitionSupplierCounts(
      ctx,
      order.supplierOrganizationId,
      "requires_decision",
      "expired",
    );
    await ctx.db.patch("orders", order._id, {
      supplierQueueState: "expired",
      decisionWindowExpiredAt: now,
      sortTimestamp: now,
      updatedAt: now,
      version: order.version + 1n,
    });
    await ctx.db.insert("auditEvents", {
      entityType: "order",
      entityId: order._id,
      organizationId: order.supplierOrganizationId,
      action: "order.decision_expired",
      correlationId: `deadline:${revision._id}`,
      changedFields: ["supplierQueueState", "decisionWindowExpiredAt"],
      occurredAt: now,
    });
    return null;
  },
});
