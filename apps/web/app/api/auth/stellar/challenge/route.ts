import { LOGIN_INTENT_COOKIE, setLoginIntentCookie } from "@/core/auth/cookies";
import { keyedHash, newCorrelationId, newOpaqueCredential } from "@/core/auth/crypto";
import { callAuthStore, type GatewayResult } from "@/core/auth/gateway";
import { authError, clientNetworkSubject, NO_STORE_HEADERS } from "@/core/auth/http";
import { getServerEnv } from "@/core/config/server-env";
import { Keypair, Networks, StrKey, TransactionBuilder, WebAuth } from "@stellar/stellar-sdk";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { Sep10Challenge } from "@repo/stellar/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = newCorrelationId();
  try {
    const env = getServerEnv();
    const origin = request.headers.get("origin");
    const expected = new URL(env.MOVIX_AUTH_ISSUER);
    const actual = new URL(request.url);
    if (
      (origin && origin !== expected.origin) ||
      actual.protocol !== expected.protocol ||
      actual.host !== expected.host ||
      request.headers.get("sec-fetch-site") === "cross-site"
    ) {
      return authError(
        "invalid_request",
        "Cross-origin requests are not allowed.",
        403,
        correlationId,
      );
    }

    const account = new URL(request.url).searchParams.get("account") ?? "";
    if (!account.startsWith("G") || !StrKey.isValidEd25519PublicKey(account)) {
      return authError("invalid_account", "Use a standard Stellar G account.", 400, correlationId);
    }

    const cookieStore = await cookies();
    const existingIntent = cookieStore.get(LOGIN_INTENT_COOKIE)?.value;
    const intent =
      existingIntent && existingIntent.length <= 128 ? existingIntent : newOpaqueCredential();
    const serverKeypair = Keypair.fromSecret(env.MOVIX_SEP10_SIGNING_SECRET);
    const issuedAt = Date.now();
    const expiresAt = issuedAt + env.MOVIX_SEP10_CHALLENGE_SECONDS * 1000;
    const transactionXdr = WebAuth.buildChallengeTx(
      serverKeypair,
      account,
      env.MOVIX_HOME_DOMAIN,
      env.MOVIX_SEP10_CHALLENGE_SECONDS,
      Networks.TESTNET,
      env.MOVIX_WEB_AUTH_DOMAIN,
    );
    const challengeHash = TransactionBuilder.fromXDR(transactionXdr, Networks.TESTNET)
      .hash()
      .toString("hex");
    const intentHash = keyedHash(env.MOVIX_RATE_LIMIT_HMAC_SECRET, "login-intent", intent);
    const rateLimitKey = keyedHash(
      env.MOVIX_RATE_LIMIT_HMAC_SECRET,
      "challenge-rate",
      `${intent}:${account}`,
    );
    const coarseRateLimitKey = keyedHash(
      env.MOVIX_RATE_LIMIT_HMAC_SECRET,
      "challenge-network-rate",
      clientNetworkSubject(request),
    );
    const result = await callAuthStore<GatewayResult<Record<string, never>>>(
      "/internal/auth/challenges/issue",
      {
        challengeHash,
        intentHash,
        account,
        homeDomain: env.MOVIX_HOME_DOMAIN,
        webAuthDomain: env.MOVIX_WEB_AUTH_DOMAIN,
        issuedAt,
        expiresAt,
        correlationId,
        rateLimitKey,
        coarseRateLimitKey,
      },
    );
    if (!result.ok) {
      const seconds = Math.max(1, Math.ceil((result.retryAfter ?? 60_000) / 1000));
      return authError(
        "rate_limited",
        "Too many sign-in attempts. Try again shortly.",
        429,
        correlationId,
        seconds,
      );
    }

    const response = NextResponse.json<Sep10Challenge>(
      { transactionXdr, networkPassphrase: Networks.TESTNET, expiresAt },
      { headers: NO_STORE_HEADERS },
    );
    if (intent !== existingIntent) {
      setLoginIntentCookie(response, intent);
    }
    return response;
  } catch {
    return authError(
      "service_unavailable",
      "Authentication is temporarily unavailable.",
      503,
      correlationId,
    );
  }
}
