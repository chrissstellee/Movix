import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { SupplierQueueState } from "@repo/domain";

export async function adjustBuyerCounts(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  delta: { draft?: bigint; sent?: bigint },
) {
  const now = Date.now();
  const current = await ctx.db
    .query("orderDashboardCounts")
    .withIndex("by_organizationId_and_side", (query) =>
      query.eq("organizationId", organizationId).eq("side", "buyer"),
    )
    .unique();
  if (!current) {
    await ctx.db.insert("orderDashboardCounts", {
      organizationId,
      side: "buyer",
      draftCount: delta.draft ?? 0n,
      sentCount: delta.sent ?? 0n,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    return;
  }
  const draftCount = current.draftCount + (delta.draft ?? 0n);
  const sentCount = current.sentCount + (delta.sent ?? 0n);
  if (draftCount < 0n || sentCount < 0n) {
    throw new Error("ORDER_COUNT_INVARIANT");
  }
  await ctx.db.patch("orderDashboardCounts", current._id, {
    draftCount,
    sentCount,
    updatedAt: now,
    version: current.version + 1n,
  });
}

const countFieldByState = {
  requires_decision: "requiresDecisionCount",
  expired: "expiredCount",
  accepted: "acceptedCount",
  rejected: "rejectedCount",
} as const;

export async function transitionSupplierCounts(
  ctx: MutationCtx,
  supplierOrganizationId: Id<"organizations">,
  from: SupplierQueueState | undefined,
  to: SupplierQueueState,
) {
  if (from === to) return;
  const now = Date.now();
  const current = await ctx.db
    .query("supplierOrderCounts")
    .withIndex("by_supplierOrganizationId", (query) =>
      query.eq("supplierOrganizationId", supplierOrganizationId),
    )
    .unique();
  const counts = {
    requiresDecisionCount: current?.requiresDecisionCount ?? 0n,
    expiredCount: current?.expiredCount ?? 0n,
    acceptedCount: current?.acceptedCount ?? 0n,
    rejectedCount: current?.rejectedCount ?? 0n,
  };
  if (from && from !== "not_queued") {
    counts[countFieldByState[from]] -= 1n;
  }
  if (to !== "not_queued") {
    counts[countFieldByState[to]] += 1n;
  }
  if (Object.values(counts).some((count) => count < 0n)) {
    throw new Error("ORDER_COUNT_INVARIANT");
  }
  if (!current) {
    await ctx.db.insert("supplierOrderCounts", {
      supplierOrganizationId,
      ...counts,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    return;
  }
  await ctx.db.patch("supplierOrderCounts", current._id, {
    ...counts,
    updatedAt: now,
    version: current.version + 1n,
  });
}
