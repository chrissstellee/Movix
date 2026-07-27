import { clearSessionCookie, sessionCookieName } from "@/core/auth/cookies";
import { hashCredential, newCorrelationId } from "@/core/auth/crypto";
import { callAuthStore } from "@/core/auth/gateway";
import { authError, isSameOrigin, NO_STORE_HEADERS } from "@/core/auth/http";
import { getServerEnv } from "@/core/config/server-env";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const correlationId = newCorrelationId();
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return authError(
      "service_unavailable",
      "Logout is temporarily unavailable. Your session has not been cleared.",
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
  if (credential) {
    try {
      await callAuthStore("/internal/auth/sessions/logout", {
        credentialHash: hashCredential(credential),
        now: Date.now(),
        correlationId,
      });
    } catch {
      return authError(
        "service_unavailable",
        "Logout is temporarily unavailable. Your session has not been cleared.",
        503,
        correlationId,
      );
    }
  }

  const response = NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  clearSessionCookie(response);
  return response;
}
