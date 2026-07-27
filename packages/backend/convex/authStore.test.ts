/// <reference types="vite/client" />

import { register } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";

import type { FunctionReference } from "convex/server";

const modules = import.meta.glob("./**/*.ts");

interface IssueArgs extends Record<string, string | number> {
  challengeHash: string;
  intentHash: string;
  account: string;
  homeDomain: string;
  webAuthDomain: string;
  issuedAt: number;
  expiresAt: number;
  correlationId: string;
  rateLimitKey: string;
  coarseRateLimitKey: string;
}

interface ConsumeArgs extends Record<string, string | number> {
  challengeHash: string;
  intentHash: string;
  account: string;
  issuer: string;
  credentialHash: string;
  familyPublicId: string;
  jwtKeyId: string;
  absoluteExpiresAt: number;
  now: number;
  correlationId: string;
  walletFingerprint: string;
}

interface AuthStoreReferences {
  authStore: {
    issueChallenge: FunctionReference<"mutation", "internal", IssueArgs>;
    limitVerification: FunctionReference<
      "mutation",
      "internal",
      { rateLimitKey: string; coarseRateLimitKey: string },
      { ok: true } | { ok: false; code: "rate_limited"; retryAfter: number }
    >;
    consumeChallenge: FunctionReference<"mutation", "internal", ConsumeArgs>;
    rotateSession: FunctionReference<
      "mutation",
      "internal",
      {
        credentialHash: string;
        successorHash: string;
        jwtKeyId: string;
        now: number;
        correlationId: string;
      },
      | {
          ok: true;
          familyId: string;
          familyExpiresAt: number;
          user: { id: string; walletAddress: string; network: "testnet" };
        }
      | {
          ok: false;
          code: "session_expired" | "session_revoked" | "session_reused" | "session_conflict";
        }
    >;
    revokeSession: FunctionReference<
      "mutation",
      "internal",
      { credentialHash: string; now: number; correlationId: string }
    >;
  };
}

interface PublicReferences {
  auth: {
    currentUser: FunctionReference<"query", "public", Record<string, never>>;
  };
}

const authStore = (internal as unknown as AuthStoreReferences).authStore;
const publicAuth = (api as unknown as PublicReferences).auth;
const account = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

function createTest() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}

async function establishSession(
  t: ReturnType<typeof createTest>,
  prefix: string,
  now: number,
  absoluteExpiresAt = now + 600_000,
) {
  await t.mutation(authStore.issueChallenge, {
    challengeHash: `${prefix}-challenge`,
    intentHash: `${prefix}-intent`,
    account,
    homeDomain: "movix.test",
    webAuthDomain: "auth.movix.test",
    issuedAt: now,
    expiresAt: now + 300_000,
    correlationId: `${prefix}-issue`,
    rateLimitKey: `${prefix}-rate`,
    coarseRateLimitKey: `${prefix}-network`,
  });
  const result = await t.mutation(authStore.consumeChallenge, {
    challengeHash: `${prefix}-challenge`,
    intentHash: `${prefix}-intent`,
    account,
    issuer: "https://movix.test",
    credentialHash: `${prefix}-credential`,
    familyPublicId: `${prefix}-family`,
    jwtKeyId: "kid-1",
    absoluteExpiresAt,
    now: now + 1_000,
    correlationId: `${prefix}-consume`,
    walletFingerprint: "wallet-fingerprint",
  });
  if (!result.ok) {
    throw new Error(`Unexpected result: ${result.code}`);
  }
  return result;
}

describe("auth store", () => {
  it("rate limits verification before expensive SEP-10 processing", async () => {
    const t = createTest();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(
        t.mutation(authStore.limitVerification, {
          rateLimitKey: "verification-key",
          coarseRateLimitKey: "verification-network",
        }),
      ).resolves.toEqual({ ok: true });
    }
    await expect(
      t.mutation(authStore.limitVerification, {
        rateLimitKey: "verification-key",
        coarseRateLimitKey: "verification-network",
      }),
    ).resolves.toMatchObject({ ok: false, code: "rate_limited" });
  });

  it("atomically permits only one challenge consumption", async () => {
    const t = createTest();
    const now = 1_800_000_000_000;
    const issue: IssueArgs = {
      challengeHash: "challenge-hash",
      intentHash: "intent-hash",
      account,
      homeDomain: "movix.test",
      webAuthDomain: "auth.movix.test",
      issuedAt: now,
      expiresAt: now + 300_000,
      correlationId: "correlation-1",
      rateLimitKey: "challenge-rate-key",
      coarseRateLimitKey: "challenge-network-key",
    };
    await expect(t.mutation(authStore.issueChallenge, issue)).resolves.toEqual({
      ok: true,
    });

    const consume: ConsumeArgs = {
      challengeHash: issue.challengeHash,
      intentHash: issue.intentHash,
      account,
      issuer: "https://movix.test",
      credentialHash: "credential-hash",
      familyPublicId: "family-public-id",
      jwtKeyId: "kid-1",
      absoluteExpiresAt: now + 7 * 24 * 60 * 60 * 1000,
      now: now + 1_000,
      correlationId: "correlation-2",
      walletFingerprint: "wallet-fingerprint",
    };
    const [first, second] = await Promise.all([
      t.mutation(authStore.consumeChallenge, consume),
      t.mutation(authStore.consumeChallenge, {
        ...consume,
        credentialHash: "credential-hash-2",
      }),
    ]);

    expect([first, second].filter((result) => result.ok)).toHaveLength(1);
    expect([first, second].filter((result) => !result.ok)).toEqual([
      { ok: false, code: "challenge_replayed" },
    ]);
    const counts = await t.run(async (ctx) => ({
      families: (await ctx.db.query("authSessionFamilies").take(10)).length,
      sessions: (await ctx.db.query("authSessions").take(10)).length,
      users: (await ctx.db.query("users").take(10)).length,
      wallets: (await ctx.db.query("wallets").take(10)).length,
    }));
    expect(counts).toEqual({ families: 1, sessions: 1, users: 1, wallets: 1 });
  });

  it("applies the independent coarse challenge limit across cycled intents", async () => {
    const t = createTest();
    const now = 1_800_000_000_000;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await expect(
        t.mutation(authStore.issueChallenge, {
          challengeHash: `coarse-challenge-${attempt}`,
          intentHash: `coarse-intent-${attempt}`,
          account,
          homeDomain: "movix.test",
          webAuthDomain: "auth.movix.test",
          issuedAt: now,
          expiresAt: now + 300_000,
          correlationId: `coarse-${attempt}`,
          rateLimitKey: `coarse-fine-${attempt}`,
          coarseRateLimitKey: "shared-network",
        }),
      ).resolves.toEqual({ ok: true });
    }
    await expect(
      t.mutation(authStore.issueChallenge, {
        challengeHash: "coarse-challenge-blocked",
        intentHash: "coarse-intent-blocked",
        account,
        homeDomain: "movix.test",
        webAuthDomain: "auth.movix.test",
        issuedAt: now,
        expiresAt: now + 300_000,
        correlationId: "coarse-blocked",
        rateLimitKey: "coarse-fine-new",
        coarseRateLimitKey: "shared-network",
      }),
    ).resolves.toMatchObject({ ok: false, code: "rate_limited" });
  });

  it("rejects superseded, mismatched, and expired challenges without creating sessions", async () => {
    const t = createTest();
    const now = 1_800_000_000_000;
    for (const challengeHash of ["old-challenge", "current-challenge"]) {
      await t.mutation(authStore.issueChallenge, {
        challengeHash,
        intentHash: "shared-intent",
        account,
        homeDomain: "movix.test",
        webAuthDomain: "auth.movix.test",
        issuedAt: now,
        expiresAt: now + 300_000,
        correlationId: challengeHash,
        rateLimitKey: "shared-rate",
        coarseRateLimitKey: "shared-network",
      });
    }
    const base: ConsumeArgs = {
      challengeHash: "old-challenge",
      intentHash: "shared-intent",
      account,
      issuer: "https://movix.test",
      credentialHash: "rejected-credential",
      familyPublicId: "rejected-family",
      jwtKeyId: "kid-1",
      absoluteExpiresAt: now + 600_000,
      now: now + 1_000,
      correlationId: "consume-rejected",
      walletFingerprint: "wallet-fingerprint",
    };
    await expect(t.mutation(authStore.consumeChallenge, base)).resolves.toEqual({
      ok: false,
      code: "challenge_replayed",
    });
    await expect(
      t.mutation(authStore.consumeChallenge, {
        ...base,
        challengeHash: "unknown-challenge",
      }),
    ).resolves.toEqual({ ok: false, code: "challenge_invalid" });
    await expect(
      t.mutation(authStore.consumeChallenge, {
        ...base,
        challengeHash: "current-challenge",
        intentHash: "wrong-intent",
      }),
    ).resolves.toEqual({ ok: false, code: "challenge_invalid" });

    await t.mutation(authStore.issueChallenge, {
      challengeHash: "expired-challenge",
      intentHash: "expired-intent",
      account,
      homeDomain: "movix.test",
      webAuthDomain: "auth.movix.test",
      issuedAt: now,
      expiresAt: now + 1_000,
      correlationId: "expired-issue",
      rateLimitKey: "expired-rate",
      coarseRateLimitKey: "expired-network",
    });
    await expect(
      t.mutation(authStore.consumeChallenge, {
        ...base,
        challengeHash: "expired-challenge",
        intentHash: "expired-intent",
        now: now + 2_000,
      }),
    ).resolves.toEqual({ ok: false, code: "challenge_expired" });
    await expect(
      t.run(async (ctx) => (await ctx.db.query("authSessionFamilies").take(10)).length),
    ).resolves.toBe(0);
  });

  it("resolves tokenIdentifier only while its session family is active", async () => {
    const t = createTest();
    const now = 1_800_000_000_000;
    await t.mutation(authStore.issueChallenge, {
      challengeHash: "identity-challenge",
      intentHash: "identity-intent",
      account,
      homeDomain: "movix.test",
      webAuthDomain: "auth.movix.test",
      issuedAt: now,
      expiresAt: now + 300_000,
      correlationId: "correlation-identity",
      rateLimitKey: "challenge-identity",
      coarseRateLimitKey: "challenge-identity-network",
    });
    const result = await t.mutation(authStore.consumeChallenge, {
      challengeHash: "identity-challenge",
      intentHash: "identity-intent",
      account,
      issuer: "https://movix.test",
      credentialHash: "identity-credential",
      familyPublicId: "identity-family",
      jwtKeyId: "kid-1",
      absoluteExpiresAt: now + 600_000,
      now: now + 1_000,
      correlationId: "correlation-consume",
      walletFingerprint: "wallet-fingerprint",
    });
    if (!result.ok) {
      throw new Error(`Unexpected result: ${result.code}`);
    }

    const authenticated = t.withIdentity({
      subject: result.user.id,
      issuer: "https://movix.test",
      tokenIdentifier: `https://movix.test|${result.user.id}`,
      session_family_id: result.familyId,
    });
    await expect(authenticated.query(publicAuth.currentUser, {})).resolves.toMatchObject({
      id: result.user.id,
      walletAddress: account,
      network: "testnet",
    });

    await t.mutation(authStore.revokeSession, {
      credentialHash: "identity-credential",
      now: now + 2_000,
      correlationId: "correlation-logout",
    });
    await expect(authenticated.query(publicAuth.currentUser, {})).resolves.toBeNull();
  });

  it("treats an immediate duplicate refresh as a retryable conflict before reuse revocation", async () => {
    const t = createTest();
    const now = 1_800_000_000_000;
    await t.mutation(authStore.issueChallenge, {
      challengeHash: "rotation-challenge",
      intentHash: "rotation-intent",
      account,
      homeDomain: "movix.test",
      webAuthDomain: "auth.movix.test",
      issuedAt: now,
      expiresAt: now + 300_000,
      correlationId: "correlation-rotation",
      rateLimitKey: "challenge-rotation",
      coarseRateLimitKey: "challenge-rotation-network",
    });
    const established = await t.mutation(authStore.consumeChallenge, {
      challengeHash: "rotation-challenge",
      intentHash: "rotation-intent",
      account,
      issuer: "https://movix.test",
      credentialHash: "rotation-original",
      familyPublicId: "rotation-family",
      jwtKeyId: "kid-1",
      absoluteExpiresAt: now + 600_000,
      now: now + 1_000,
      correlationId: "correlation-establish",
      walletFingerprint: "wallet-fingerprint",
    });
    expect(established.ok).toBe(true);

    await expect(
      t.mutation(authStore.rotateSession, {
        credentialHash: "rotation-original",
        successorHash: "rotation-successor",
        jwtKeyId: "kid-1",
        now: now + 2_000,
        correlationId: "correlation-refresh",
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      t.mutation(authStore.rotateSession, {
        credentialHash: "rotation-original",
        successorHash: "ignored-successor",
        jwtKeyId: "kid-1",
        now: now + 3_000,
        correlationId: "correlation-race",
      }),
    ).resolves.toEqual({ ok: false, code: "session_conflict" });
    await expect(
      t.mutation(authStore.rotateSession, {
        credentialHash: "rotation-original",
        successorHash: "ignored-successor-2",
        jwtKeyId: "kid-1",
        now: now + 8_000,
        correlationId: "correlation-reuse",
      }),
    ).resolves.toEqual({ ok: false, code: "session_reused" });
  });

  it("expires session families and keeps logout idempotent", async () => {
    const t = createTest();
    const now = 1_800_000_000_000;
    await establishSession(t, "expiry", now, now + 1_500);

    await expect(
      t.mutation(authStore.rotateSession, {
        credentialHash: "expiry-credential",
        successorHash: "expiry-successor",
        jwtKeyId: "kid-1",
        now: now + 2_000,
        correlationId: "expiry-refresh",
      }),
    ).resolves.toEqual({ ok: false, code: "session_expired" });
    await expect(
      t.mutation(authStore.revokeSession, {
        credentialHash: "unknown-credential",
        now: now + 3_000,
        correlationId: "unknown-logout",
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      t.mutation(authStore.revokeSession, {
        credentialHash: "expiry-credential",
        now: now + 3_000,
        correlationId: "expiry-logout",
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("consumes the proof but refuses a session for an inactive existing user", async () => {
    const t = createTest();
    const now = 1_800_000_000_000;
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        primaryWallet: account,
        status: "suspended",
        timezone: "UTC",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      await ctx.db.insert("wallets", {
        userId,
        address: account,
        network: "testnet",
        verifiedAt: now,
        createdAt: now,
      });
    });
    await t.mutation(authStore.issueChallenge, {
      challengeHash: "inactive-challenge",
      intentHash: "inactive-intent",
      account,
      homeDomain: "movix.test",
      webAuthDomain: "auth.movix.test",
      issuedAt: now,
      expiresAt: now + 300_000,
      correlationId: "correlation-inactive",
      rateLimitKey: "challenge-inactive",
      coarseRateLimitKey: "challenge-inactive-network",
    });

    await expect(
      t.mutation(authStore.consumeChallenge, {
        challengeHash: "inactive-challenge",
        intentHash: "inactive-intent",
        account,
        issuer: "https://movix.test",
        credentialHash: "inactive-credential",
        familyPublicId: "inactive-family",
        jwtKeyId: "kid-1",
        absoluteExpiresAt: now + 600_000,
        now: now + 1_000,
        correlationId: "correlation-inactive-consume",
        walletFingerprint: "wallet-fingerprint",
      }),
    ).resolves.toEqual({ ok: false, code: "challenge_invalid" });
    await expect(
      t.run(async (ctx) => (await ctx.db.query("authSessionFamilies").take(10)).length),
    ).resolves.toBe(0);
  });
});
