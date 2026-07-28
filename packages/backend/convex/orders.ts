import { calculateOrderLine, calculateOrderTotals } from "@repo/domain";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { businessError } from "./lib/errors";
import { requireBuyerOrder, getBuyerContext } from "./lib/orderAuthorization";
import { adjustBuyerCounts } from "./lib/orderCounts";
import { getOrderBlockers, hashOrderTermsV1 } from "./lib/orderTerms";
import { loadDraftRecords, publicLine, publicRevision } from "./orderDrafts";
import {
  draftProjectionValidator,
  orderCommandResultValidator,
  orderListItemValidator,
} from "./orderValidators";
import { resolveSupplierTarget } from "./supplierDirectory";
import { agreementStatusValidator, orderAssetKeyValidator } from "./validators";

import type { Doc, Id } from "./_generated/dataModel";

interface OrderCommandResult {
  orderId: Id<"orders">;
  revisionId: Id<"orderRevisions">;
  agreementStatus: "draft" | "sent" | "accepted" | "rejected" | "cancelled";
  orderVersion: bigint;
  revisionVersion: bigint;
  replay: boolean;
}

function mapListItem(order: Doc<"orders">) {
  return {
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
  };
}

function validIdempotencyKey(value: string) {
  if (value.length < 8 || value.length > 120) {
    throw businessError("ORDER_INVALID");
  }
}

function sendFingerprint(orderId: string, expectedVersion: bigint) {
  return `send:v1:${orderId}:${expectedVersion}`;
}

function cancelFingerprint(input: {
  orderId: string;
  expectedVersion: bigint;
  reasonCode: string;
  reasonDetails?: string;
}) {
  return `cancel:v1:${input.orderId}:${input.expectedVersion}:${input.reasonCode}:${input.reasonDetails ?? ""}`;
}

async function recomputeStoredTotals(
  revision: Doc<"orderRevisions">,
  lines: readonly Doc<"orderLines">[],
) {
  try {
    const calculatedLines = lines.map((line) => {
      const discount =
        line.discountKind === "fixed"
          ? { kind: "fixed" as const, baseUnits: line.discountBaseUnitsInput! }
          : line.discountKind === "rate"
            ? { kind: "rate" as const, bps: line.discountBps! }
            : { kind: "none" as const };
      const calculated = calculateOrderLine({
        quantityCoefficient: line.quantityCoefficient,
        quantityScale: Number(line.quantityScale),
        unitPriceBaseUnits: line.unitPriceBaseUnits,
        discount,
        taxBps: line.taxBps,
      });
      if (
        calculated.grossBaseUnits !== line.grossBaseUnits ||
        calculated.discountBaseUnits !== line.discountBaseUnits ||
        calculated.taxBaseUnits !== line.taxBaseUnits ||
        calculated.lineTotalBaseUnits !== line.lineTotalBaseUnits
      ) {
        throw businessError("TOTAL_MISMATCH");
      }
      return calculated;
    });
    const totals = calculateOrderTotals(calculatedLines, revision.shippingTotalBaseUnits);
    if (
      totals.subtotalBaseUnits !== revision.subtotalBaseUnits ||
      totals.discountTotalBaseUnits !== revision.discountTotalBaseUnits ||
      totals.taxTotalBaseUnits !== revision.taxTotalBaseUnits ||
      totals.grandTotalBaseUnits !== revision.grandTotalBaseUnits
    ) {
      throw businessError("TOTAL_MISMATCH");
    }
    return totals;
  } catch (error) {
    if (error && typeof error === "object" && "data" in error) {
      throw error;
    }
    throw businessError(
      error instanceof Error && error.message === "AMOUNT_OVERFLOW"
        ? "AMOUNT_OVERFLOW"
        : "AMOUNT_INVALID",
    );
  }
}

export const send = mutation({
  args: {
    orderId: v.id("orders"),
    expectedVersion: v.int64(),
    idempotencyKey: v.string(),
  },
  returns: orderCommandResultValidator,
  handler: async (ctx, args): Promise<OrderCommandResult> => {
    validIdempotencyKey(args.idempotencyKey);
    const authorized = await requireBuyerOrder(ctx, args.orderId, "order:send");
    const fingerprint = sendFingerprint(args.orderId, args.expectedVersion);
    const prior = await ctx.db
      .query("orderCommandReceipts")
      .withIndex("by_buyer_command_idempotencyKey", (index) =>
        index
          .eq("buyerOrganizationId", authorized.organization._id)
          .eq("commandType", "send")
          .eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (prior) {
      if (prior.requestFingerprint !== fingerprint || !prior.resultRevisionId) {
        throw businessError("IDEMPOTENCY_CONFLICT");
      }
      const [order, revision] = await Promise.all([
        ctx.db.get("orders", prior.orderId),
        ctx.db.get("orderRevisions", prior.resultRevisionId),
      ]);
      if (!order || !revision) throw businessError("ORDER_NOT_FOUND");
      return {
        orderId: order._id,
        revisionId: revision._id,
        agreementStatus: order.agreementStatus,
        orderVersion: order.version,
        revisionVersion: revision.version,
        replay: true,
      };
    }
    if (authorized.order.agreementStatus !== "draft") {
      throw businessError("ORDER_ALREADY_SENT");
    }
    if (!authorized.order.currentRevisionId) throw businessError("ORDER_NOT_FOUND");
    const revision = await ctx.db.get("orderRevisions", authorized.order.currentRevisionId);
    if (!revision || revision.version !== args.expectedVersion) {
      throw businessError("ORDER_STALE");
    }
    if (revision.frozenAt !== undefined) throw businessError("ORDER_IMMUTABLE");
    const lines = await ctx.db
      .query("orderLines")
      .withIndex("by_revisionId", (index) => index.eq("revisionId", revision._id))
      .take(101);
    const now = Date.now();
    const blockers = getOrderBlockers(revision, lines, now);
    if (blockers.length > 0) {
      throw businessError("ORDER_INVALID", {
        fields: Object.fromEntries(blockers.map((item) => [item.field, item.message])),
      });
    }
    if (!revision.relationshipId) throw businessError("SUPPLIER_NOT_RESOLVED");
    const supplier = await resolveSupplierTarget(ctx, authorized.organization._id, {
      kind: "relationship",
      relationshipId: revision.relationshipId,
    });
    if (supplier.supplier._id !== revision.supplierOrganizationId) {
      throw businessError("SUPPLIER_INELIGIBLE");
    }
    await recomputeStoredTotals(revision, lines);
    const termsHash = await hashOrderTermsV1(revision, lines);
    const nextRevisionVersion = revision.version + 1n;
    const nextOrderVersion = authorized.order.version + 1n;
    await ctx.db.patch("orderRevisions", revision._id, {
      termsHash,
      frozenAt: now,
      updatedAt: now,
      version: nextRevisionVersion,
    });
    await ctx.db.patch("orders", authorized.order._id, {
      agreementStatus: "sent",
      sentAt: now,
      sortTimestamp: now,
      updatedAt: now,
      version: nextOrderVersion,
    });
    await adjustBuyerCounts(ctx, authorized.organization._id, {
      draft: -1n,
      sent: 1n,
    });
    await ctx.db.insert("orderCommandReceipts", {
      buyerOrganizationId: authorized.organization._id,
      orderId: authorized.order._id,
      commandType: "send",
      idempotencyKey: args.idempotencyKey,
      requestFingerprint: fingerprint,
      resultRevisionId: revision._id,
      resultAgreementStatus: "sent",
      createdAt: now,
    });
    await ctx.db.insert("notifications", {
      recipientOrganizationId: supplier.supplier._id,
      eventType: "order.sent",
      entityType: "order",
      entityId: authorized.order._id,
      actionUrl: `/orders/${authorized.order._id}`,
      idempotencyKey: args.idempotencyKey,
      status: "unread",
      createdAt: now,
    });
    await ctx.db.insert("auditEvents", {
      entityType: "order",
      entityId: authorized.order._id,
      organizationId: authorized.organization._id,
      actorUserId: authorized.principal.user._id,
      action: "order.sent",
      correlationId: args.idempotencyKey,
      changedFields: ["agreementStatus", "termsHash", "frozenAt"],
      occurredAt: now,
    });
    return {
      orderId: authorized.order._id,
      revisionId: revision._id,
      agreementStatus: "sent",
      orderVersion: nextOrderVersion,
      revisionVersion: nextRevisionVersion,
      replay: false,
    };
  },
});

export const getById = query({
  args: { orderId: v.id("orders") },
  returns: draftProjectionValidator,
  handler: async (ctx, args) => {
    const records = await loadDraftRecords(ctx, args.orderId);
    return {
      order: {
        id: records.order._id,
        agreementStatus: records.order.agreementStatus,
        fulfillmentStatus: records.order.fulfillmentStatus,
        settlementStatus: records.order.settlementStatus,
        version: records.order.version,
      },
      revision: publicRevision(records.revision),
      lines: records.lines.sort((a, b) => Number(a.lineNumber - b.lineNumber)).map(publicLine),
    };
  },
});

export const listBuyerOrders = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(agreementStatusValidator),
    assetKey: v.optional(orderAssetKeyValidator),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
  },
  returns: paginationResultValidator(orderListItemValidator),
  handler: async (ctx, args) => {
    const buyer = await getBuyerContext(ctx);
    const organizationId = buyer.organization._id;
    const withDate = Boolean(args.dateFrom || args.dateTo);
    let result;
    if (withDate && args.status && args.assetKey) {
      result = await ctx.db
        .query("orders")
        .withIndex("by_buyer_status_asset_issueDate", (index) => {
          const keyed = index
            .eq("buyerOrganizationId", organizationId)
            .eq("agreementStatus", args.status!)
            .eq("assetKey", args.assetKey!);
          if (args.dateFrom && args.dateTo) {
            return keyed.gte("issueDate", args.dateFrom).lte("issueDate", args.dateTo);
          }
          return args.dateFrom
            ? keyed.gte("issueDate", args.dateFrom)
            : keyed.lte("issueDate", args.dateTo!);
        })
        .order("desc")
        .paginate(args.paginationOpts);
    } else if (withDate && args.status) {
      result = await ctx.db
        .query("orders")
        .withIndex("by_buyer_and_agreementStatus_and_issueDate", (index) => {
          const keyed = index
            .eq("buyerOrganizationId", organizationId)
            .eq("agreementStatus", args.status!);
          if (args.dateFrom && args.dateTo) {
            return keyed.gte("issueDate", args.dateFrom).lte("issueDate", args.dateTo);
          }
          return args.dateFrom
            ? keyed.gte("issueDate", args.dateFrom)
            : keyed.lte("issueDate", args.dateTo!);
        })
        .order("desc")
        .paginate(args.paginationOpts);
    } else if (withDate && args.assetKey) {
      result = await ctx.db
        .query("orders")
        .withIndex("by_buyer_and_assetKey_and_issueDate", (index) => {
          const keyed = index
            .eq("buyerOrganizationId", organizationId)
            .eq("assetKey", args.assetKey!);
          if (args.dateFrom && args.dateTo) {
            return keyed.gte("issueDate", args.dateFrom).lte("issueDate", args.dateTo);
          }
          return args.dateFrom
            ? keyed.gte("issueDate", args.dateFrom)
            : keyed.lte("issueDate", args.dateTo!);
        })
        .order("desc")
        .paginate(args.paginationOpts);
    } else if (withDate) {
      result = await ctx.db
        .query("orders")
        .withIndex("by_buyer_and_issueDate", (index) => {
          const keyed = index.eq("buyerOrganizationId", organizationId);
          if (args.dateFrom && args.dateTo) {
            return keyed.gte("issueDate", args.dateFrom).lte("issueDate", args.dateTo);
          }
          return args.dateFrom
            ? keyed.gte("issueDate", args.dateFrom)
            : keyed.lte("issueDate", args.dateTo!);
        })
        .order("desc")
        .paginate(args.paginationOpts);
    } else if (args.status && args.assetKey) {
      result = await ctx.db
        .query("orders")
        .withIndex("by_buyer_status_asset_sortTimestamp", (index) =>
          index
            .eq("buyerOrganizationId", organizationId)
            .eq("agreementStatus", args.status!)
            .eq("assetKey", args.assetKey!),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    } else if (args.status) {
      result = await ctx.db
        .query("orders")
        .withIndex("by_buyer_and_agreementStatus_and_sortTimestamp", (index) =>
          index.eq("buyerOrganizationId", organizationId).eq("agreementStatus", args.status!),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    } else if (args.assetKey) {
      result = await ctx.db
        .query("orders")
        .withIndex("by_buyer_and_assetKey_and_sortTimestamp", (index) =>
          index.eq("buyerOrganizationId", organizationId).eq("assetKey", args.assetKey!),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    } else {
      result = await ctx.db
        .query("orders")
        .withIndex("by_buyer_and_sortTimestamp", (index) =>
          index.eq("buyerOrganizationId", organizationId),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }
    return { ...result, page: result.page.map(mapListItem) };
  },
});

export const cancel = mutation({
  args: {
    orderId: v.id("orders"),
    expectedVersion: v.int64(),
    idempotencyKey: v.string(),
    reasonCode: v.string(),
    reasonDetails: v.optional(v.string()),
  },
  returns: orderCommandResultValidator,
  handler: async (ctx, args): Promise<OrderCommandResult> => {
    validIdempotencyKey(args.idempotencyKey);
    if (
      args.reasonCode.trim().length < 2 ||
      args.reasonCode.length > 80 ||
      (args.reasonDetails?.length ?? 0) > 500
    ) {
      throw businessError("ORDER_INVALID");
    }
    const authorized = await requireBuyerOrder(ctx, args.orderId, "order:draft");
    if (!authorized.order.currentRevisionId) throw businessError("ORDER_NOT_FOUND");
    const fingerprint = cancelFingerprint(args);
    const prior = await ctx.db
      .query("orderCommandReceipts")
      .withIndex("by_buyer_command_idempotencyKey", (index) =>
        index
          .eq("buyerOrganizationId", authorized.organization._id)
          .eq("commandType", "cancel")
          .eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (prior) {
      if (prior.requestFingerprint !== fingerprint || !prior.resultRevisionId) {
        throw businessError("IDEMPOTENCY_CONFLICT");
      }
      const [order, revision] = await Promise.all([
        ctx.db.get("orders", prior.orderId),
        ctx.db.get("orderRevisions", prior.resultRevisionId),
      ]);
      if (!order || !revision) throw businessError("ORDER_NOT_FOUND");
      return {
        orderId: order._id,
        revisionId: revision._id,
        agreementStatus: order.agreementStatus,
        orderVersion: order.version,
        revisionVersion: revision.version,
        replay: true,
      };
    }
    if (authorized.order.version !== args.expectedVersion) {
      throw businessError("ORDER_STALE");
    }
    if (
      !["draft", "sent"].includes(authorized.order.agreementStatus) ||
      authorized.order.settlementStatus !== "unfunded"
    ) {
      throw businessError("ORDER_CANNOT_CANCEL");
    }
    const revision = await ctx.db.get("orderRevisions", authorized.order.currentRevisionId);
    if (!revision) throw businessError("ORDER_NOT_FOUND");
    const previousStatus = authorized.order.agreementStatus;
    const now = Date.now();
    const nextOrderVersion = authorized.order.version + 1n;
    await ctx.db.patch("orders", authorized.order._id, {
      agreementStatus: "cancelled",
      cancellationReasonCode: args.reasonCode.trim(),
      cancellationReasonDetails: args.reasonDetails?.trim(),
      cancelledByUserId: authorized.principal.user._id,
      cancelledAt: now,
      sortTimestamp: now,
      updatedAt: now,
      version: nextOrderVersion,
    });
    await adjustBuyerCounts(ctx, authorized.organization._id, {
      ...(previousStatus === "draft" ? { draft: -1n } : { sent: -1n }),
    });
    await ctx.db.insert("orderCommandReceipts", {
      buyerOrganizationId: authorized.organization._id,
      orderId: authorized.order._id,
      commandType: "cancel",
      idempotencyKey: args.idempotencyKey,
      requestFingerprint: fingerprint,
      resultRevisionId: revision._id,
      resultAgreementStatus: "cancelled",
      createdAt: now,
    });
    await ctx.db.insert("auditEvents", {
      entityType: "order",
      entityId: authorized.order._id,
      organizationId: authorized.organization._id,
      actorUserId: authorized.principal.user._id,
      action: "order.cancelled",
      correlationId: args.idempotencyKey,
      changedFields: ["agreementStatus", "cancellationReasonCode"],
      occurredAt: now,
    });
    return {
      orderId: authorized.order._id,
      revisionId: revision._id,
      agreementStatus: "cancelled",
      orderVersion: nextOrderVersion,
      revisionVersion: revision.version,
      replay: false,
    };
  },
});
