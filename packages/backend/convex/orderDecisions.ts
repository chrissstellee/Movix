import { normalizeRejectionNote, type RejectionReasonCode } from "@repo/domain";
import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { businessError } from "./lib/errors";
import { adjustBuyerCounts, transitionSupplierCounts } from "./lib/orderCounts";
import { hashOrderTerms } from "./lib/orderTerms";
import { requireSupplierOrder } from "./lib/supplierOrderAuthorization";
import { orderDecisionResultValidator } from "./orderValidators";
import { orderRejectionReasonValidator } from "./validators";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

type Decision = "accepted" | "rejected";
type Command = "accept" | "reject";

interface DecisionInput {
  orderId: Id<"orders">;
  revisionId: Id<"orderRevisions">;
  expectedOrderVersion: bigint;
  expectedRevisionVersion: bigint;
  expectedTermsHash: string;
  idempotencyKey: string;
  reasonCode?: RejectionReasonCode;
  reasonNote?: string;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const input = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fingerprint(command: Command, input: DecisionInput) {
  return sha256(
    JSON.stringify({
      v: 1,
      command,
      orderId: input.orderId,
      revisionId: input.revisionId,
      expectedOrderVersion: input.expectedOrderVersion.toString(),
      expectedRevisionVersion: input.expectedRevisionVersion.toString(),
      expectedTermsHash: input.expectedTermsHash,
      reasonCode: input.reasonCode ?? null,
      reasonNote: input.reasonNote ?? null,
    }),
  );
}

function validateIdempotencyKey(value: string) {
  if (value.length < 8 || value.length > 120) {
    throw businessError("ORDER_INVALID");
  }
}

async function replayDecision(
  ctx: MutationCtx,
  receipt: Doc<"orderDecisionReceipts">,
  expectedFingerprint: string,
) {
  if (receipt.requestFingerprint !== expectedFingerprint) {
    throw businessError("IDEMPOTENCY_CONFLICT");
  }
  const decision = await ctx.db.get("orderRevisionDecisions", receipt.decisionId);
  if (!decision) throw businessError("ORDER_NOT_FOUND");
  return {
    orderId: receipt.orderId,
    revisionId: receipt.revisionId,
    decisionId: receipt.decisionId,
    decision: decision.decision,
    agreementStatus: decision.decision,
    orderVersion: receipt.resultOrderVersion,
    revisionVersion: receipt.resultRevisionVersion,
    decidedAt: receipt.decidedAt,
    replay: true,
  };
}

async function decide(ctx: MutationCtx, command: Command, rawInput: DecisionInput) {
  validateIdempotencyKey(rawInput.idempotencyKey);
  let reasonNote: string | undefined;
  try {
    reasonNote = normalizeRejectionNote(rawInput.reasonNote);
  } catch {
    throw businessError("ORDER_DECISION_REASON_INVALID");
  }
  if (
    (command === "accept" && (rawInput.reasonCode || reasonNote)) ||
    (command === "reject" && !rawInput.reasonCode)
  ) {
    throw businessError("ORDER_DECISION_REASON_INVALID");
  }
  const input = { ...rawInput, reasonNote };
  const authorized = await requireSupplierOrder(ctx, input.orderId, "order:decide");
  const requestFingerprint = await fingerprint(command, input);
  const prior = await ctx.db
    .query("orderDecisionReceipts")
    .withIndex("by_supplierOrganizationId_and_idempotencyKey", (index) =>
      index
        .eq("supplierOrganizationId", authorized.organization._id)
        .eq("idempotencyKey", input.idempotencyKey),
    )
    .unique();
  if (prior) return replayDecision(ctx, prior, requestFingerprint);

  const order = authorized.order;
  if (order.version !== input.expectedOrderVersion) {
    throw businessError("ORDER_STALE");
  }
  if (order.currentRevisionId !== input.revisionId) {
    throw businessError("ORDER_REVISION_MISMATCH");
  }
  if (order.agreementStatus !== "sent" || order.settlementStatus !== "unfunded") {
    throw businessError(
      order.currentDecisionId ? "ORDER_ALREADY_DECIDED" : "ORDER_NOT_AWAITING_DECISION",
    );
  }
  const revision = await ctx.db.get("orderRevisions", input.revisionId);
  if (
    !revision ||
    revision.orderId !== order._id ||
    revision.supplierOrganizationId !== authorized.organization._id
  ) {
    throw businessError("ORDER_REVISION_MISMATCH");
  }
  if (revision.version !== input.expectedRevisionVersion) {
    throw businessError("ORDER_STALE");
  }
  if (!revision.frozenAt || !revision.termsHash) {
    throw businessError("ORDER_NOT_AWAITING_DECISION");
  }
  if (revision.termsHash !== input.expectedTermsHash) {
    throw businessError("ORDER_TERMS_HASH_MISMATCH");
  }
  const now = Date.now();
  if (
    revision.supplierAcceptanceDeadline === undefined ||
    now > revision.supplierAcceptanceDeadline
  ) {
    throw businessError("ORDER_DECISION_EXPIRED");
  }
  if (order.supplierQueueState !== "requires_decision") {
    throw businessError("ORDER_NOT_AWAITING_DECISION");
  }
  const priorRevisionDecision = await ctx.db
    .query("orderRevisionDecisions")
    .withIndex("by_revisionId", (index) => index.eq("revisionId", revision._id))
    .unique();
  if (priorRevisionDecision) throw businessError("ORDER_ALREADY_DECIDED");
  const lines = await ctx.db
    .query("orderLines")
    .withIndex("by_revisionId", (index) => index.eq("revisionId", revision._id))
    .take(101);
  if (lines.length > 100 || (await hashOrderTerms(revision, lines)) !== revision.termsHash) {
    throw businessError("ORDER_TERMS_HASH_MISMATCH");
  }

  const decision: Decision = command === "accept" ? "accepted" : "rejected";
  const decisionId = await ctx.db.insert("orderRevisionDecisions", {
    orderId: order._id,
    revisionId: revision._id,
    revisionNumber: revision.revisionNumber,
    buyerOrganizationId: order.buyerOrganizationId,
    supplierOrganizationId: authorized.organization._id,
    decision,
    termsHash: revision.termsHash,
    ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
    ...(reasonNote ? { reasonNote } : {}),
    actorUserId: authorized.principal.user._id,
    actorWalletAddress: authorized.principal.wallet.address,
    decidedAt: now,
    createdAt: now,
  });
  const nextOrderVersion = order.version + 1n;
  await ctx.db.patch("orders", order._id, {
    agreementStatus: decision,
    currentDecisionId: decisionId,
    ...(decision === "accepted" ? { acceptedRevisionId: revision._id } : {}),
    decidedAt: now,
    decisionSortTimestamp: now,
    supplierQueueState: decision,
    sortTimestamp: now,
    updatedAt: now,
    version: nextOrderVersion,
  });
  await Promise.all([
    adjustBuyerCounts(ctx, order.buyerOrganizationId, { sent: -1n }),
    transitionSupplierCounts(ctx, authorized.organization._id, "requires_decision", decision),
  ]);
  await ctx.db.insert("orderDecisionReceipts", {
    supplierOrganizationId: authorized.organization._id,
    orderId: order._id,
    revisionId: revision._id,
    commandType: command,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint,
    decisionId,
    resultOrderVersion: nextOrderVersion,
    resultRevisionVersion: revision.version,
    decidedAt: now,
    createdAt: now,
  });
  await ctx.db.insert("notifications", {
    recipientOrganizationId: order.buyerOrganizationId,
    eventType: `order.${decision}`,
    entityType: "order",
    entityId: order._id,
    actionUrl: `/orders/${order._id}`,
    idempotencyKey: input.idempotencyKey,
    status: "unread",
    createdAt: now,
  });
  await ctx.db.insert("auditEvents", {
    entityType: "order",
    entityId: order._id,
    organizationId: authorized.organization._id,
    actorUserId: authorized.principal.user._id,
    actorWalletAddress: authorized.principal.wallet.address,
    action: `order.${decision}`,
    correlationId: input.idempotencyKey,
    changedFields: ["agreementStatus", "currentDecisionId", "supplierQueueState"],
    occurredAt: now,
  });
  return {
    orderId: order._id,
    revisionId: revision._id,
    decisionId,
    decision,
    agreementStatus: decision,
    orderVersion: nextOrderVersion,
    revisionVersion: revision.version,
    decidedAt: now,
    replay: false,
  };
}

const commonArgs = {
  orderId: v.id("orders"),
  revisionId: v.id("orderRevisions"),
  expectedOrderVersion: v.int64(),
  expectedRevisionVersion: v.int64(),
  expectedTermsHash: v.string(),
  idempotencyKey: v.string(),
};

export const accept = mutation({
  args: commonArgs,
  returns: orderDecisionResultValidator,
  handler: async (ctx, args) => decide(ctx, "accept", args),
});

export const reject = mutation({
  args: {
    ...commonArgs,
    reasonCode: orderRejectionReasonValidator,
    reasonNote: v.optional(v.string()),
  },
  returns: orderDecisionResultValidator,
  handler: async (ctx, args) => decide(ctx, "reject", args),
});
