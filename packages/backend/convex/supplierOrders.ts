import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { query } from "./_generated/server";
import { getSupplierContext } from "./lib/supplierOrderAuthorization";
import { supplierOrderListItemValidator, supplierOrderSummaryValidator } from "./orderValidators";
import { supplierQueueStateValidator } from "./validators";

import type { Doc } from "./_generated/dataModel";

function mapSupplierOrder(order: Doc<"orders">, revision: Doc<"orderRevisions"> | null) {
  const supplierQueueState =
    order.supplierQueueState ??
    (order.agreementStatus === "sent"
      ? revision?.frozenAt && revision.termsHash
        ? revision.supplierAcceptanceDeadline !== undefined &&
          Date.now() > revision.supplierAcceptanceDeadline
          ? "expired"
          : "requires_decision"
        : "not_queued"
      : order.agreementStatus === "accepted" || order.agreementStatus === "rejected"
        ? order.agreementStatus
        : "not_queued");
  return {
    orderId: order._id,
    ...(order.purchaseOrderNumber ? { purchaseOrderNumber: order.purchaseOrderNumber } : {}),
    buyerName: revision?.buyerTradingNameSnapshot ?? revision?.buyerLegalNameSnapshot ?? "Importer",
    ...(order.title ? { title: order.title } : {}),
    revisionNumber: revision?.revisionNumber ?? order.currentRevisionNumber,
    grandTotalBaseUnits: order.grandTotalBaseUnits,
    ...(order.assetCode ? { assetCode: order.assetCode } : {}),
    agreementStatus: order.agreementStatus,
    supplierQueueState,
    ...(order.sentAt !== undefined ? { sentAt: order.sentAt } : {}),
    ...(order.decidedAt !== undefined ? { decidedAt: order.decidedAt } : {}),
    ...(revision?.supplierAcceptanceDeadline !== undefined
      ? { supplierAcceptanceDeadline: revision.supplierAcceptanceDeadline }
      : {}),
    sortTimestamp: order.sortTimestamp,
  };
}

async function hydrateOrders(
  ctx: Parameters<typeof getSupplierContext>[0],
  orders: Doc<"orders">[],
) {
  return Promise.all(
    orders.map(async (order) => {
      const currentRevision = order.currentRevisionId
        ? await ctx.db.get("orderRevisions", order.currentRevisionId)
        : null;
      const visibleRevision =
        currentRevision && !currentRevision.frozenAt && currentRevision.supersedesRevisionId
          ? await ctx.db.get("orderRevisions", currentRevision.supersedesRevisionId)
          : currentRevision;
      return mapSupplierOrder(order, visibleRevision);
    }),
  );
}

export const getSummary = query({
  args: {},
  returns: supplierOrderSummaryValidator,
  handler: async (ctx) => {
    const supplier = await getSupplierContext(ctx);
    const [counts, incoming] = await Promise.all([
      ctx.db
        .query("supplierOrderCounts")
        .withIndex("by_supplierOrganizationId", (index) =>
          index.eq("supplierOrganizationId", supplier.organization._id),
        )
        .unique(),
      ctx.db
        .query("orders")
        .withIndex("by_supplier_queue_sortTimestamp", (index) =>
          index
            .eq("supplierOrganizationId", supplier.organization._id)
            .eq("supplierQueueState", "requires_decision"),
        )
        .order("desc")
        .take(5),
    ]);
    return {
      counts: {
        requiresDecision: counts?.requiresDecisionCount ?? 0n,
        expired: counts?.expiredCount ?? 0n,
        accepted: counts?.acceptedCount ?? 0n,
        rejected: counts?.rejectedCount ?? 0n,
      },
      recentIncoming: await hydrateOrders(ctx, incoming),
      blockers: supplier.readiness.missing.map((item) => ({
        field: item.code,
        message: item.label,
      })),
    };
  },
});

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    queueState: v.optional(supplierQueueStateValidator),
  },
  returns: paginationResultValidator(supplierOrderListItemValidator),
  handler: async (ctx, args) => {
    const supplier = await getSupplierContext(ctx);
    const result = args.queueState
      ? await ctx.db
          .query("orders")
          .withIndex("by_supplier_queue_sortTimestamp", (index) =>
            index
              .eq("supplierOrganizationId", supplier.organization._id)
              .eq("supplierQueueState", args.queueState!),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("orders")
          .withIndex("by_supplier_and_sortTimestamp", (index) =>
            index.eq("supplierOrganizationId", supplier.organization._id),
          )
          .order("desc")
          .paginate(args.paginationOpts);
    return { ...result, page: await hydrateOrders(ctx, result.page) };
  },
});
