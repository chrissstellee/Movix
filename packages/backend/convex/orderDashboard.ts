import { roleCan } from "@repo/domain";
import { v } from "convex/values";

import { query } from "./_generated/server";
import { getBuyerContext } from "./lib/orderAuthorization";
import { orderListItemValidator } from "./orderValidators";

export const getBuyerSummary = query({
  args: {},
  returns: v.object({
    counts: v.object({ draft: v.int64(), sent: v.int64() }),
    recent: v.array(orderListItemValidator),
    canCreate: v.boolean(),
    blockers: v.array(v.object({ code: v.string(), label: v.string(), settingsPath: v.string() })),
  }),
  handler: async (ctx) => {
    const buyer = await getBuyerContext(ctx);
    const [counts, recent] = await Promise.all([
      ctx.db
        .query("orderDashboardCounts")
        .withIndex("by_organizationId_and_side", (index) =>
          index.eq("organizationId", buyer.organization._id).eq("side", "buyer"),
        )
        .unique(),
      ctx.db
        .query("orders")
        .withIndex("by_buyer_and_sortTimestamp", (index) =>
          index.eq("buyerOrganizationId", buyer.organization._id),
        )
        .order("desc")
        .take(5),
    ]);
    return {
      counts: {
        draft: counts?.draftCount ?? 0n,
        sent: counts?.sentCount ?? 0n,
      },
      recent: recent.map((order) => ({
        orderId: order._id,
        ...(order.purchaseOrderNumber ? { purchaseOrderNumber: order.purchaseOrderNumber } : {}),
        ...(order.supplierNameSnapshot ? { supplierName: order.supplierNameSnapshot } : {}),
        ...(order.title ? { title: order.title } : {}),
        ...(order.issueDate ? { issueDate: order.issueDate } : {}),
        grandTotalBaseUnits: order.grandTotalBaseUnits,
        ...(order.assetCode ? { assetCode: order.assetCode } : {}),
        agreementStatus: order.agreementStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        settlementStatus: order.settlementStatus,
        sortTimestamp: order.sortTimestamp,
      })),
      canCreate: buyer.readiness.buyerReady && roleCan(buyer.membership.role, "order:draft"),
      blockers: buyer.readiness.missing.map((item) => ({
        code: item.code,
        label: item.label,
        settingsPath: item.settingsPath,
      })),
    };
  },
});
