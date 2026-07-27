import { clearSessionCookie, sessionCookieName, setSessionCookie } from "@/core/auth/cookies";
import { hashCredential, newCorrelationId, newOpaqueCredential } from "@/core/auth/crypto";
import { callAuthStore, type GatewayResult } from "@/core/auth/gateway";
import { authError, isSameOrigin, NO_STORE_HEADERS } from "@/core/auth/http";
import { mintAccessToken } from "@/core/auth/jwt";
import { getServerEnv } from "@/core/config/server-env";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { AuthenticatedSession, AuthenticatedUser } from "@repo/stellar/auth";

export const dynamic = "force-dynamic";

interface RefreshSuccess {
  familyId: string;
  familyExpiresAt: number;
  user: AuthenticatedUser;
}

export async function POST(request: Request) {
  const correlationId = newCorrelationId();
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return authError(
      "service_unavailable",
      "Session refresh is temporarily unavailable.",
      503,
      correlationId,
    );
  }
  if (!isSameOrigin(request, env.MOVIX_AUTH_ISSUER)) {
    return authError(
      "invalid_request",
      "Cross-origin requests are not allowed.",
      403,
      correlationId,
    );
  }

  const cookieStore = await cookies();
  const credential = cookieStore.get(sessionCookieName())?.value;
  if (!credential) {
    return authError("session_expired", "Your session has expired.", 401, correlationId);
  }

  try {
    const successor = newOpaqueCredential();
    const now = Date.now();
    const result = await callAuthStore<GatewayResult<RefreshSuccess>>(
      "/internal/auth/sessions/refresh",
      {
        credentialHash: hashCredential(credential),
        successorHash: hashCredential(successor),
        jwtKeyId: env.MOVIX_JWT_ACTIVE_KID,
        now,
        correlationId,
      },
    );
    if (!result.ok) {
      if (result.code === "session_conflict") {
        return authError(
          "session_conflict",
          "Another tab refreshed this session. Retry with the current credential.",
          409,
          correlationId,
          1,
        );
      }
      const response = authError(
        result.code === "session_reused"
          ? "session_reused"
          : result.code === "session_revoked"
            ? "session_revoked"
            : "session_expired",
        "Your session is no longer active. Sign in again.",
        401,
        correlationId,
      );
      clearSessionCookie(response);
      return response;
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
    setSessionCookie(response, successor, result.familyExpiresAt);
    return response;
  } catch {
    const response = authError(
      "service_unavailable",
      "Session refresh is temporarily unavailable.",
      503,
      correlationId,
    );
    return response;
  }
}
