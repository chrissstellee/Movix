import { LOGIN_INTENT_COOKIE, setSessionCookie } from "@/core/auth/cookies";
import {
  hashCredential,
  keyedHash,
  newCorrelationId,
  newOpaqueCredential,
} from "@/core/auth/crypto";
import { callAuthStore, type GatewayResult } from "@/core/auth/gateway";
import { authError, clientNetworkSubject, isSameOrigin, NO_STORE_HEADERS } from "@/core/auth/http";
import { mintAccessToken } from "@/core/auth/jwt";
import { readSep10Challenge, verifySep10Challenge } from "@/core/auth/sep10";
import { getServerEnv } from "@/core/config/server-env";
import { Horizon, Keypair, Networks, StrKey } from "@stellar/stellar-sdk";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { AuthenticatedSession, AuthenticatedUser } from "@repo/stellar/auth";

export const dynamic = "force-dynamic";

interface ConsumeSuccess {
  familyId: string;
  familyExpiresAt: number;
  user: AuthenticatedUser;
}

export async function POST(request: Request) {
  const correlationId = newCorrelationId();
  try {
    const env = getServerEnv();
    if (!isSameOrigin(request, env.MOVIX_AUTH_ISSUER)) {
      return authError(
        "invalid_request",
        "Cross-origin requests are not allowed.",
        403,
        correlationId,
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (
      contentLength > 65_536 ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")
    ) {
      return authError("invalid_request", "Invalid request body.", 400, correlationId);
    }
    const body: unknown = await request.json().catch(() => null);
    const signedTransactionXdr =
      body &&
      typeof body === "object" &&
      "signedTransactionXdr" in body &&
      typeof body.signedTransactionXdr === "string"
        ? body.signedTransactionXdr
        : "";
    if (!signedTransactionXdr || signedTransactionXdr.length > 65_536) {
      return authError("invalid_request", "A signed challenge is required.", 400, correlationId);
    }

    const cookieStore = await cookies();
    const intent = cookieStore.get(LOGIN_INTENT_COOKIE)?.value;
    if (!intent) {
      return authError(
        "challenge_invalid",
        "The login attempt is no longer active.",
        400,
        correlationId,
      );
    }
    const verificationRateKey = keyedHash(env.MOVIX_RATE_LIMIT_HMAC_SECRET, "verify-rate", intent);
    const coarseRateLimitKey = keyedHash(
      env.MOVIX_RATE_LIMIT_HMAC_SECRET,
      "verify-network-rate",
      clientNetworkSubject(request),
    );
    const rateLimit = await callAuthStore<GatewayResult<Record<string, never>>>(
      "/internal/auth/verification/check",
      { rateLimitKey: verificationRateKey, coarseRateLimitKey },
    );
    if (!rateLimit.ok) {
      return authError(
        "rate_limited",
        "Too many verification attempts. Try again shortly.",
        429,
        correlationId,
        Math.max(1, Math.ceil((rateLimit.retryAfter ?? 60_000) / 1000)),
      );
    }

    const serverAccount = Keypair.fromSecret(env.MOVIX_SEP10_SIGNING_SECRET).publicKey();
    const parsedChallenge = readSep10Challenge(
      signedTransactionXdr,
      serverAccount,
      Networks.TESTNET,
      env.MOVIX_HOME_DOMAIN,
      env.MOVIX_WEB_AUTH_DOMAIN,
    );
    if (
      !parsedChallenge.clientAccountID.startsWith("G") ||
      !StrKey.isValidEd25519PublicKey(parsedChallenge.clientAccountID)
    ) {
      return authError("challenge_invalid", "The signed challenge is invalid.", 400, correlationId);
    }

    const horizon = new Horizon.Server(env.MOVIX_HORIZON_URL);
    const now = Date.now();
    const accountRecord = await horizon.loadAccount(parsedChallenge.clientAccountID);
    const challenge = verifySep10Challenge({
      signedTransactionXdr,
      serverAccount,
      networkPassphrase: Networks.TESTNET,
      homeDomain: env.MOVIX_HOME_DOMAIN,
      webAuthDomain: env.MOVIX_WEB_AUTH_DOMAIN,
      challengeSeconds: env.MOVIX_SEP10_CHALLENGE_SECONDS,
      now,
      threshold: Math.max(1, accountRecord.thresholds.med_threshold),
      signers: accountRecord.signers,
    });

    const refreshCredential = newOpaqueCredential();
    const absoluteExpiresAt = now + env.MOVIX_SESSION_DAYS * 24 * 60 * 60 * 1000;
    const result = await callAuthStore<GatewayResult<ConsumeSuccess>>(
      "/internal/auth/challenges/consume",
      {
        challengeHash: challenge.tx.hash().toString("hex"),
        intentHash: keyedHash(env.MOVIX_RATE_LIMIT_HMAC_SECRET, "login-intent", intent),
        account: challenge.clientAccountID,
        issuer: env.MOVIX_AUTH_ISSUER,
        credentialHash: hashCredential(refreshCredential),
        familyPublicId: crypto.randomUUID(),
        jwtKeyId: env.MOVIX_JWT_ACTIVE_KID,
        absoluteExpiresAt,
        now,
        correlationId,
        walletFingerprint: keyedHash(
          env.MOVIX_RATE_LIMIT_HMAC_SECRET,
          "wallet-event",
          challenge.clientAccountID,
        ),
      },
    );
    if (!result.ok) {
      const status = result.code === "rate_limited" ? 429 : 400;
      return authError(
        result.code === "rate_limited"
          ? "rate_limited"
          : result.code === "challenge_expired"
            ? "challenge_expired"
            : result.code === "challenge_replayed"
              ? "challenge_replayed"
              : "challenge_invalid",
        result.code === "rate_limited"
          ? "Too many verification attempts. Try again shortly."
          : "The challenge is invalid, expired, or already used.",
        status,
        correlationId,
        result.retryAfter === undefined
          ? undefined
          : Math.max(1, Math.ceil(result.retryAfter / 1000)),
      );
    }

    const token = await mintAccessToken({
      userId: result.user.id,
      walletAddress: result.user.walletAddress,
      familyId: result.familyId,
      familyExpiresAt: result.familyExpiresAt,
      now,
    });
    const session: AuthenticatedSession = { ...token, user: result.user };
    const response = NextResponse.json(session, { headers: NO_STORE_HEADERS });
    setSessionCookie(response, refreshCredential, result.familyExpiresAt);
    return response;
  } catch {
    return authError(
      "challenge_invalid",
      "The signed challenge could not be verified.",
      400,
      correlationId,
    );
  }
}
