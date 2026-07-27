import { v } from "convex/values";

import { query } from "./_generated/server";
import { getCurrentPrincipal } from "./lib/authorization";

export const currentUser = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      id: v.string(),
      walletAddress: v.string(),
      network: v.literal("testnet"),
    }),
  ),
  handler: async (ctx) => {
    const principal = await getCurrentPrincipal(ctx);
    if (!principal) {
      return null;
    }

    return {
      id: principal.user._id,
      walletAddress: principal.wallet.address,
      network: "testnet" as const,
    };
  },
});

export const walletSettings = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      walletAddress: v.string(),
      network: v.literal("testnet"),
      verifiedAt: v.number(),
      accountStatus: v.literal("active"),
      sessionExpiresAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const principal = await getCurrentPrincipal(ctx);
    if (!principal) {
      return null;
    }
    return {
      walletAddress: principal.wallet.address,
      network: "testnet" as const,
      verifiedAt: principal.wallet.verifiedAt,
      accountStatus: "active" as const,
      sessionExpiresAt: principal.sessionFamily.absoluteExpiresAt,
    };
  },
});
