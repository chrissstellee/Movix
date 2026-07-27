import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const rateLimiterComponent = (
  components as unknown as {
    rateLimiter: ConstructorParameters<typeof RateLimiter>[0];
  }
).rateLimiter;

const rateLimiter = new RateLimiter(rateLimiterComponent, {
  challenge: {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 5,
  },
  challengeCoarse: {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 30,
  },
  verification: {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 10,
  },
  verificationCoarse: {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 30,
  },
});

const ROTATION_GRACE_MS = 5_000;

const authUserResult = v.object({
  id: v.string(),
  walletAddress: v.string(),
  network: v.literal("testnet"),
});

export const issueChallenge = internalMutation({
  args: {
    challengeHash: v.string(),
    intentHash: v.string(),
    account: v.string(),
    homeDomain: v.string(),
    webAuthDomain: v.string(),
    issuedAt: v.number(),
    expiresAt: v.number(),
    correlationId: v.string(),
    rateLimitKey: v.string(),
    coarseRateLimitKey: v.string(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({
      ok: v.literal(false),
      code: v.literal("rate_limited"),
      retryAfter: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = await rateLimiter.limit(ctx, "challenge", {
      key: args.rateLimitKey,
    });
    const coarseLimit = await rateLimiter.limit(ctx, "challengeCoarse", {
      key: args.coarseRateLimitKey,
    });
    if (!limit.ok || !coarseLimit.ok) {
      return {
        ok: false as const,
        code: "rate_limited" as const,
        retryAfter: Math.max(limit.retryAfter ?? 0, coarseLimit.retryAfter ?? 0, MINUTE),
      };
    }

    const duplicate = await ctx.db
      .query("authChallenges")
      .withIndex("by_challengeHash", (query) => query.eq("challengeHash", args.challengeHash))
      .unique();
    if (duplicate) {
      throw new Error("DUPLICATE_CHALLENGE");
    }

    const activeChallenges = await ctx.db
      .query("authChallenges")
      .withIndex("by_intentHash_and_state", (query) =>
        query.eq("intentHash", args.intentHash).eq("state", "active"),
      )
      .take(10);
    for (const challenge of activeChallenges) {
      await ctx.db.patch("authChallenges", challenge._id, {
        state: "superseded",
        supersededAt: args.issuedAt,
        outcome: "superseded",
      });
    }

    await ctx.db.insert("authChallenges", {
      challengeHash: args.challengeHash,
      intentHash: args.intentHash,
      account: args.account,
      homeDomain: args.homeDomain,
      webAuthDomain: args.webAuthDomain,
      network: "testnet",
      state: "active",
      issuedAt: args.issuedAt,
      expiresAt: args.expiresAt,
      correlationId: args.correlationId,
    });
    await ctx.db.insert("authSecurityEvents", {
      category: "challenge",
      outcome: "issued",
      correlationId: args.correlationId,
      network: "testnet",
      occurredAt: args.issuedAt,
    });

    return { ok: true as const };
  },
});

export const limitVerification = internalMutation({
  args: {
    rateLimitKey: v.string(),
    coarseRateLimitKey: v.string(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({
      ok: v.literal(false),
      code: v.literal("rate_limited"),
      retryAfter: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = await rateLimiter.limit(ctx, "verification", {
      key: args.rateLimitKey,
    });
    const coarseLimit = await rateLimiter.limit(ctx, "verificationCoarse", {
      key: args.coarseRateLimitKey,
    });
    return limit.ok && coarseLimit.ok
      ? { ok: true as const }
      : {
          ok: false as const,
          code: "rate_limited" as const,
          retryAfter: Math.max(limit.retryAfter ?? 0, coarseLimit.retryAfter ?? 0, MINUTE),
        };
  },
});

export const consumeChallenge = internalMutation({
  args: {
    challengeHash: v.string(),
    intentHash: v.string(),
    account: v.string(),
    issuer: v.string(),
    credentialHash: v.string(),
    familyPublicId: v.string(),
    jwtKeyId: v.string(),
    absoluteExpiresAt: v.number(),
    now: v.number(),
    correlationId: v.string(),
    walletFingerprint: v.string(),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      familyId: v.string(),
      familyExpiresAt: v.number(),
      user: authUserResult,
    }),
    v.object({
      ok: v.literal(false),
      code: v.union(
        v.literal("rate_limited"),
        v.literal("challenge_invalid"),
        v.literal("challenge_expired"),
        v.literal("challenge_replayed"),
      ),
      retryAfter: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const challenge = await ctx.db
      .query("authChallenges")
      .withIndex("by_challengeHash", (query) => query.eq("challengeHash", args.challengeHash))
      .unique();
    if (
      !challenge ||
      challenge.intentHash !== args.intentHash ||
      challenge.account !== args.account
    ) {
      return { ok: false as const, code: "challenge_invalid" as const };
    }
    if (challenge.state !== "active") {
      return { ok: false as const, code: "challenge_replayed" as const };
    }
    if (challenge.expiresAt <= args.now) {
      await ctx.db.patch("authChallenges", challenge._id, {
        state: "consumed",
        consumedAt: args.now,
        outcome: "expired",
      });
      return { ok: false as const, code: "challenge_expired" as const };
    }

    await ctx.db.patch("authChallenges", challenge._id, {
      state: "consumed",
      consumedAt: args.now,
      outcome: "verified",
    });

    let wallet = await ctx.db
      .query("wallets")
      .withIndex("by_address_and_network", (query) =>
        query.eq("address", args.account).eq("network", "testnet"),
      )
      .unique();
    let userId = wallet?.userId;
    if (!userId) {
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_primaryWallet", (query) => query.eq("primaryWallet", args.account))
        .unique();
      userId =
        existingUser?._id ??
        (await ctx.db.insert("users", {
          primaryWallet: args.account,
          status: "active",
          timezone: "UTC",
          lastLoginAt: args.now,
          createdAt: args.now,
          updatedAt: args.now,
          version: 1n,
        }));
      if (!wallet) {
        const walletId = await ctx.db.insert("wallets", {
          userId,
          address: args.account,
          network: "testnet",
          verifiedAt: args.now,
          createdAt: args.now,
        });
        wallet = await ctx.db.get("wallets", walletId);
      }
    }
    if (!wallet || !userId) {
      throw new Error("IDENTITY_UPSERT_FAILED");
    }

    const user = await ctx.db.get("users", userId);
    if (!user || user.status !== "active") {
      await ctx.db.patch("authChallenges", challenge._id, {
        outcome: "account_inactive",
      });
      await ctx.db.insert("authSecurityEvents", {
        category: "authentication",
        outcome: "account_inactive",
        correlationId: args.correlationId,
        network: "testnet",
        walletFingerprint: args.walletFingerprint,
        occurredAt: args.now,
      });
      return { ok: false as const, code: "challenge_invalid" as const };
    }

    const tokenIdentifier = `${args.issuer}|${userId}`;
    await ctx.db.patch("users", userId, {
      tokenIdentifier,
      lastLoginAt: args.now,
      updatedAt: args.now,
    });

    const familyId = await ctx.db.insert("authSessionFamilies", {
      familyId: args.familyPublicId,
      userId,
      walletId: wallet._id,
      network: "testnet",
      currentCredentialHash: args.credentialHash,
      absoluteExpiresAt: args.absoluteExpiresAt,
      createdAt: args.now,
      updatedAt: args.now,
    });
    await ctx.db.insert("authSessions", {
      credentialHash: args.credentialHash,
      familyId,
      userId,
      walletId: wallet._id,
      network: "testnet",
      jwtKeyId: args.jwtKeyId,
      state: "active",
      createdAt: args.now,
      expiresAt: args.absoluteExpiresAt,
    });
    await ctx.db.insert("authSecurityEvents", {
      category: "authentication",
      outcome: "succeeded",
      correlationId: args.correlationId,
      network: "testnet",
      walletFingerprint: args.walletFingerprint,
      occurredAt: args.now,
    });

    return {
      ok: true as const,
      familyId: args.familyPublicId,
      familyExpiresAt: args.absoluteExpiresAt,
      user: {
        id: userId,
        walletAddress: wallet.address,
        network: "testnet" as const,
      },
    };
  },
});

export const rotateSession = internalMutation({
  args: {
    credentialHash: v.string(),
    successorHash: v.string(),
    jwtKeyId: v.string(),
    now: v.number(),
    correlationId: v.string(),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      familyId: v.string(),
      familyExpiresAt: v.number(),
      user: authUserResult,
    }),
    v.object({
      ok: v.literal(false),
      code: v.union(
        v.literal("session_expired"),
        v.literal("session_revoked"),
        v.literal("session_reused"),
        v.literal("session_conflict"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_credentialHash", (query) => query.eq("credentialHash", args.credentialHash))
      .unique();
    if (!session) {
      return { ok: false as const, code: "session_expired" as const };
    }
    const family = await ctx.db.get("authSessionFamilies", session.familyId);
    if (!family || family.revokedAt) {
      return { ok: false as const, code: "session_revoked" as const };
    }
    if (session.state !== "active" || family.currentCredentialHash !== args.credentialHash) {
      if (
        session.state === "rotated" &&
        session.rotatedAt !== undefined &&
        args.now - session.rotatedAt <= ROTATION_GRACE_MS
      ) {
        return { ok: false as const, code: "session_conflict" as const };
      }
      await ctx.db.patch("authSessionFamilies", family._id, {
        revokedAt: args.now,
        revocationReason: "credential_reuse",
        updatedAt: args.now,
      });
      await ctx.db.insert("authSecurityEvents", {
        category: "session",
        outcome: "credential_reuse",
        correlationId: args.correlationId,
        network: "testnet",
        occurredAt: args.now,
      });
      return { ok: false as const, code: "session_reused" as const };
    }
    if (family.absoluteExpiresAt <= args.now) {
      await ctx.db.patch("authSessionFamilies", family._id, {
        revokedAt: args.now,
        revocationReason: "expired",
        updatedAt: args.now,
      });
      return { ok: false as const, code: "session_expired" as const };
    }

    const [user, wallet] = await Promise.all([
      ctx.db.get("users", session.userId),
      ctx.db.get("wallets", session.walletId),
    ]);
    if (!user || !wallet) {
      throw new Error("SESSION_IDENTITY_MISSING");
    }
    if (user.status !== "active") {
      await ctx.db.patch("authSessionFamilies", family._id, {
        revokedAt: args.now,
        revocationReason: "account_inactive",
        updatedAt: args.now,
      });
      await ctx.db.insert("authSecurityEvents", {
        category: "session",
        outcome: "account_inactive",
        correlationId: args.correlationId,
        network: "testnet",
        occurredAt: args.now,
      });
      return { ok: false as const, code: "session_revoked" as const };
    }

    const successorId = await ctx.db.insert("authSessions", {
      credentialHash: args.successorHash,
      familyId: family._id,
      userId: session.userId,
      walletId: session.walletId,
      network: "testnet",
      predecessorId: session._id,
      jwtKeyId: args.jwtKeyId,
      state: "active",
      createdAt: args.now,
      expiresAt: family.absoluteExpiresAt,
    });
    await ctx.db.patch("authSessions", session._id, {
      state: "rotated",
      successorId,
      rotatedAt: args.now,
    });
    await ctx.db.patch("authSessionFamilies", family._id, {
      currentCredentialHash: args.successorHash,
      updatedAt: args.now,
    });

    return {
      ok: true as const,
      familyId: family.familyId,
      familyExpiresAt: family.absoluteExpiresAt,
      user: {
        id: user._id,
        walletAddress: wallet.address,
        network: "testnet" as const,
      },
    };
  },
});

export const revokeSession = internalMutation({
  args: {
    credentialHash: v.string(),
    now: v.number(),
    correlationId: v.string(),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_credentialHash", (query) => query.eq("credentialHash", args.credentialHash))
      .unique();
    if (!session) {
      return { ok: true as const };
    }

    const family = await ctx.db.get("authSessionFamilies", session.familyId);
    if (family && !family.revokedAt) {
      await ctx.db.patch("authSessionFamilies", family._id, {
        revokedAt: args.now,
        revocationReason: "logout",
        updatedAt: args.now,
      });
      await ctx.db.insert("authSecurityEvents", {
        category: "session",
        outcome: "logout",
        correlationId: args.correlationId,
        network: "testnet",
        occurredAt: args.now,
      });
    }
    return { ok: true as const };
  },
});

export const cleanupExpired = internalMutation({
  args: {},
  returns: v.object({
    challenges: v.number(),
    families: v.number(),
    sessions: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("by_expiresAt", (query) => query.lte("expiresAt", now))
      .take(100);
    for (const session of sessions) {
      await ctx.db.delete("authSessions", session._id);
    }

    const families = await ctx.db
      .query("authSessionFamilies")
      .withIndex("by_absoluteExpiresAt", (query) => query.lte("absoluteExpiresAt", now))
      .take(100);
    for (const family of families) {
      await ctx.db.delete("authSessionFamilies", family._id);
    }

    const challenges = await ctx.db
      .query("authChallenges")
      .withIndex("by_expiresAt", (query) => query.lte("expiresAt", now))
      .take(100);
    for (const challenge of challenges) {
      await ctx.db.delete("authChallenges", challenge._id);
    }

    return {
      challenges: challenges.length,
      families: families.length,
      sessions: sessions.length,
    };
  },
});
