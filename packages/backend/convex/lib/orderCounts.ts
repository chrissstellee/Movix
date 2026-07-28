import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

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
