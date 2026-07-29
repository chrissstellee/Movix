import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { query } from "./_generated/server";
import { getSingleActiveOrganizationContext } from "./lib/authorization";
import { businessError } from "./lib/errors";
import { orderDecisionTypeValidator, orderRejectionReasonValidator } from "./validators";

const timelineEventTypeValidator = v.union(
  v.literal("revision_started"),
  v.literal("revision_sent"),
  v.literal("revision_accepted"),
  v.literal("revision_rejected"),
  v.literal("revision_superseded"),
  v.literal("order_cancelled"),
);

const timelineGroupValidator = v.object({
  revisionId: v.id("orderRevisions"),
  revisionNumber: v.int64(),
  termsHash: v.optional(v.string()),
  frozenAt: v.optional(v.number()),
  supersededAt: v.optional(v.number()),
  decision: v.optional(
    v.object({
      id: v.id("orderRevisionDecisions"),
      decision: orderDecisionTypeValidator,
      revisionId: v.id("orderRevisions"),
      revisionNumber: v.int64(),
      termsHash: v.string(),
      reasonCode: v.optional(orderRejectionReasonValidator),
      actorWalletAddress: v.string(),
      decidedAt: v.number(),
    }),
  ),
  events: v.array(
    v.object({
      id: v.string(),
      type: timelineEventTypeValidator,
      timestamp: v.number(),
    }),
  ),
});

const precedence = {
  revision_started: 0,
  revision_sent: 1,
  revision_accepted: 2,
  revision_rejected: 2,
  revision_superseded: 3,
  order_cancelled: 4,
} as const;

export const list = query({
  args: {
    orderId: v.id("orders"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(timelineGroupValidator),
  handler: async (ctx, args) => {
    const context = await getSingleActiveOrganizationContext(ctx);
    if (context.kind !== "single") {
      throw businessError(
        context.kind === "multiple"
          ? "MULTIPLE_ORGANIZATIONS_UNSUPPORTED"
          : "ORGANIZATION_FORBIDDEN",
      );
    }
    const order = await ctx.db.get("orders", args.orderId);
    const visible =
      order &&
      (order.buyerOrganizationId === context.organization._id ||
        (order.supplierOrganizationId === context.organization._id &&
          context.organization.verificationStatus === "verified"));
    if (!order || !visible) throw businessError("ORDER_NOT_FOUND");
    const result = await ctx.db
      .query("orderRevisions")
      .withIndex("by_orderId_revisionNumber", (index) => index.eq("orderId", order._id))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map(async (revision) => {
        const decision = await ctx.db
          .query("orderRevisionDecisions")
          .withIndex("by_revisionId", (index) => index.eq("revisionId", revision._id))
          .unique();
        const mappedDecision = decision
          ? {
              id: decision._id,
              decision: decision.decision,
              revisionId: decision.revisionId,
              revisionNumber: decision.revisionNumber,
              termsHash: decision.termsHash,
              ...(decision.reasonCode ? { reasonCode: decision.reasonCode } : {}),
              actorWalletAddress: decision.actorWalletAddress,
              decidedAt: decision.decidedAt,
            }
          : undefined;
        const events: Array<{
          id: string;
          type:
            | "revision_started"
            | "revision_sent"
            | "revision_accepted"
            | "revision_rejected"
            | "revision_superseded"
            | "order_cancelled";
          timestamp: number;
        }> = [
          {
            id: `started:${revision._id}`,
            type: "revision_started",
            timestamp: revision.createdAt,
          },
        ];
        if (revision.frozenAt !== undefined) {
          events.push({
            id: `sent:${revision._id}`,
            type: "revision_sent",
            timestamp: revision.frozenAt,
          });
        }
        if (decision) {
          events.push({
            id: `decision:${decision._id}`,
            type: decision.decision === "accepted" ? "revision_accepted" : "revision_rejected",
            timestamp: decision.decidedAt,
          });
        }
        if (revision.supersededAt !== undefined) {
          events.push({
            id: `superseded:${revision._id}`,
            type: "revision_superseded",
            timestamp: revision.supersededAt,
          });
        }
        if (
          order.agreementStatus === "cancelled" &&
          order.cancelledAt !== undefined &&
          order.currentRevisionId === revision._id
        ) {
          events.push({
            id: `cancelled:${order._id}`,
            type: "order_cancelled",
            timestamp: order.cancelledAt,
          });
        }
        events.sort(
          (left, right) =>
            left.timestamp - right.timestamp ||
            precedence[left.type] - precedence[right.type] ||
            left.id.localeCompare(right.id),
        );
        return {
          revisionId: revision._id,
          revisionNumber: revision.revisionNumber,
          ...(revision.termsHash ? { termsHash: revision.termsHash } : {}),
          ...(revision.frozenAt !== undefined ? { frozenAt: revision.frozenAt } : {}),
          ...(revision.supersededAt !== undefined ? { supersededAt: revision.supersededAt } : {}),
          ...(mappedDecision ? { decision: mappedDecision } : {}),
          events,
        };
      }),
    );
    return { ...result, page };
  },
});
