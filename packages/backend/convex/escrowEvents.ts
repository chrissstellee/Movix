import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const applyReceipt = internalMutation({
  args: {
    network: v.literal("testnet"),
    contractId: v.string(),
    transactionHash: v.string(),
    ledger: v.int64(),
    eventIndex: v.int64(),
    eventType: v.string(),
    escrowKey: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contractEventReceipts")
      .withIndex("by_network_contract_tx_event", (q) =>
        q
          .eq("network", args.network)
          .eq("contractId", args.contractId)
          .eq("transactionHash", args.transactionHash)
          .eq("eventIndex", args.eventIndex),
      )
      .first();

    if (existing) {
      return { duplicate: true, id: existing._id };
    }

    const now = Date.now();
    const id = await ctx.db.insert("contractEventReceipts", {
      network: args.network,
      contractId: args.contractId,
      transactionHash: args.transactionHash,
      ledger: args.ledger,
      eventIndex: args.eventIndex,
      eventType: args.eventType,
      escrowKey: args.escrowKey,
      observedAt: now,
      processedAt: now,
      processingStatus: "processed",
    });

    return { duplicate: false, id };
  },
});
