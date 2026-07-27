import { v } from "convex/values";

import { query } from "./_generated/server";

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const familyPublicId = identity.session_family_id;
    if (typeof familyPublicId !== "string") {
      return null;
    }
    const [user, family] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (queryBuilder) =>
          queryBuilder.eq("tokenIdentifier", identity.tokenIdentifier),
        )
        .unique(),
      ctx.db
        .query("authSessionFamilies")
        .withIndex("by_familyId", (queryBuilder) => queryBuilder.eq("familyId", familyPublicId))
        .unique(),
    ]);
    if (
      !user ||
      user.status !== "active" ||
      !family ||
      family.revokedAt ||
      family.userId !== user._id
    ) {
      return null;
    }

    const wallet = await ctx.db.get("wallets", family.walletId);
    if (!wallet) {
      return null;
    }

    return {
      id: user._id,
      walletAddress: wallet.address,
      network: "testnet" as const,
    };
  },
});
