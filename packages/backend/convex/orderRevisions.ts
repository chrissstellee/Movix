import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { businessError } from "./lib/errors";
import { requireBuyerOrder } from "./lib/orderAuthorization";
import { adjustBuyerCounts, transitionSupplierCounts } from "./lib/orderCounts";
import { orderCommandResultValidator } from "./orderValidators";

export const startFromCurrent = mutation({
  args: {
    orderId: v.id("orders"),
    expectedOrderVersion: v.int64(),
    expectedRevisionId: v.id("orderRevisions"),
    idempotencyKey: v.string(),
  },
  returns: orderCommandResultValidator,
  handler: async (ctx, args) => {
    if (args.idempotencyKey.length < 8 || args.idempotencyKey.length > 120) {
      throw businessError("ORDER_INVALID");
    }
    const authorized = await requireBuyerOrder(ctx, args.orderId, "order:draft");
    const fingerprint = `start_revision:v1:${args.orderId}:${args.expectedOrderVersion}:${args.expectedRevisionId}`;
    const prior = await ctx.db
      .query("orderCommandReceipts")
      .withIndex("by_buyer_command_idempotencyKey", (index) =>
        index
          .eq("buyerOrganizationId", authorized.organization._id)
          .eq("commandType", "start_revision")
          .eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (prior) {
      if (
        prior.requestFingerprint !== fingerprint ||
        !prior.resultRevisionId ||
        prior.resultOrderVersion === undefined ||
        prior.resultRevisionVersion === undefined
      ) {
        throw businessError("IDEMPOTENCY_CONFLICT");
      }
      return {
        orderId: prior.orderId,
        revisionId: prior.resultRevisionId,
        agreementStatus: "draft" as const,
        orderVersion: prior.resultOrderVersion,
        revisionVersion: prior.resultRevisionVersion,
        replay: true,
      };
    }

    const order = authorized.order;
    if (
      order.version !== args.expectedOrderVersion ||
      order.currentRevisionId !== args.expectedRevisionId
    ) {
      throw businessError("ORDER_STALE");
    }
    if (
      !["accepted", "rejected"].includes(order.agreementStatus) ||
      order.settlementStatus !== "unfunded" ||
      !order.currentDecisionId
    ) {
      throw businessError("ORDER_CANNOT_REVISE");
    }
    const revision = await ctx.db.get("orderRevisions", args.expectedRevisionId);
    if (!revision || revision.orderId !== order._id || !revision.frozenAt) {
      throw businessError("ORDER_CANNOT_REVISE");
    }
    const lines = await ctx.db
      .query("orderLines")
      .withIndex("by_revisionId", (index) => index.eq("revisionId", revision._id))
      .take(101);
    if (lines.length > 100) throw businessError("ORDER_INVALID");

    const now = Date.now();
    const {
      _id: ignoredRevisionId,
      _creationTime: ignoredRevisionCreationTime,
      termsHash: ignoredTermsHash,
      frozenAt: ignoredFrozenAt,
      supersedesRevisionId: ignoredSupersedesRevisionId,
      supersededAt: ignoredSupersededAt,
      revisionNumber: ignoredRevisionNumber,
      createdByUserId: ignoredCreatedBy,
      createdAt: ignoredCreatedAt,
      updatedAt: ignoredUpdatedAt,
      version: ignoredVersion,
      ...commercialSnapshot
    } = revision;
    void ignoredRevisionId;
    void ignoredRevisionCreationTime;
    void ignoredTermsHash;
    void ignoredFrozenAt;
    void ignoredSupersedesRevisionId;
    void ignoredSupersededAt;
    void ignoredRevisionNumber;
    void ignoredCreatedBy;
    void ignoredCreatedAt;
    void ignoredUpdatedAt;
    void ignoredVersion;
    const nextRevisionNumber = revision.revisionNumber + 1n;
    const nextRevisionId = await ctx.db.insert("orderRevisions", {
      ...commercialSnapshot,
      revisionNumber: nextRevisionNumber,
      supersedesRevisionId: revision._id,
      createdByUserId: authorized.principal.user._id,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    for (const line of lines) {
      const {
        _id: ignoredLineId,
        _creationTime: ignoredLineCreationTime,
        revisionId: ignoredLineRevisionId,
        createdAt: ignoredLineCreatedAt,
        updatedAt: ignoredLineUpdatedAt,
        version: ignoredLineVersion,
        ...lineSnapshot
      } = line;
      void ignoredLineId;
      void ignoredLineCreationTime;
      void ignoredLineRevisionId;
      void ignoredLineCreatedAt;
      void ignoredLineUpdatedAt;
      void ignoredLineVersion;
      await ctx.db.insert("orderLines", {
        ...lineSnapshot,
        revisionId: nextRevisionId,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    }
    await ctx.db.patch("orderRevisions", revision._id, {
      supersededAt: now,
      updatedAt: now,
    });
    const nextOrderVersion = order.version + 1n;
    await ctx.db.patch("orders", order._id, {
      currentRevisionId: nextRevisionId,
      currentRevisionNumber: nextRevisionNumber,
      agreementStatus: "draft",
      acceptedRevisionId: undefined,
      currentDecisionId: undefined,
      decidedAt: undefined,
      decisionSortTimestamp: undefined,
      decisionWindowExpiredAt: undefined,
      supplierQueueState: "not_queued",
      sortTimestamp: now,
      updatedAt: now,
      version: nextOrderVersion,
    });
    await adjustBuyerCounts(ctx, order.buyerOrganizationId, { draft: 1n });
    if (order.supplierOrganizationId) {
      await transitionSupplierCounts(
        ctx,
        order.supplierOrganizationId,
        order.supplierQueueState,
        "not_queued",
      );
    }
    await ctx.db.insert("orderCommandReceipts", {
      buyerOrganizationId: order.buyerOrganizationId,
      orderId: order._id,
      commandType: "start_revision",
      idempotencyKey: args.idempotencyKey,
      requestFingerprint: fingerprint,
      resultRevisionId: nextRevisionId,
      resultAgreementStatus: "draft",
      resultOrderVersion: nextOrderVersion,
      resultRevisionVersion: 1n,
      createdAt: now,
    });
    await ctx.db.insert("auditEvents", {
      entityType: "order_revision",
      entityId: revision._id,
      organizationId: order.buyerOrganizationId,
      actorUserId: authorized.principal.user._id,
      action: "order.revision_superseded",
      correlationId: args.idempotencyKey,
      changedFields: ["supersededAt"],
      occurredAt: now,
    });
    await ctx.db.insert("auditEvents", {
      entityType: "order_revision",
      entityId: nextRevisionId,
      organizationId: order.buyerOrganizationId,
      actorUserId: authorized.principal.user._id,
      action: "order.revision_started",
      correlationId: args.idempotencyKey,
      changedFields: ["revisionNumber", "supersedesRevisionId"],
      occurredAt: now,
    });
    return {
      orderId: order._id,
      revisionId: nextRevisionId,
      agreementStatus: "draft" as const,
      orderVersion: nextOrderVersion,
      revisionVersion: 1n,
      replay: false,
    };
  },
});
