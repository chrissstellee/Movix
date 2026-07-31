import { NextResponse } from "next/server";

import { newCorrelationId } from "./crypto";

import type { AuthErrorCode } from "@repo/stellar/auth";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
} as const;

export function authError(
  code: AuthErrorCode,
  message: string,
  status: number,
  correlationId = newCorrelationId(),
  retryAfterSeconds?: number,
) {
  const response = NextResponse.json(
    {
      error: {
        code,
        message,
        correlationId,
        ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
      },
    },
    { status, headers: NO_STORE_HEADERS },
  );
  if (retryAfterSeconds !== undefined) {
    response.headers.set("Retry-After", String(retryAfterSeconds));
  }
  return response;
}

export function isSameOrigin(request: Request, expectedOrigin: string): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return false;
  }
  const origin = request.headers.get("origin");
  const expected = new URL(expectedOrigin);
  const actual = new URL(request.url);
  const requestHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? actual.host;

  const isLocalDevHost =
    (expected.hostname === "localhost" || expected.hostname === "127.0.0.1") &&
    (requestHost.startsWith("localhost") || requestHost.startsWith("127.0.0.1"));

  const isHostMatching = requestHost === expected.host || isLocalDevHost;

  let isOriginMatching = true;
  if (origin) {
    const originUrl = new URL(origin);
    const isLocalDevOrigin =
      (expected.hostname === "localhost" || expected.hostname === "127.0.0.1") &&
      (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1");
    isOriginMatching = origin === expected.origin || isLocalDevOrigin;
  }

  return actual.protocol === expected.protocol && isHostMatching && isOriginMatching;
}

export function clientNetworkSubject(request: Request): string {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip");
  const candidate = forwarded?.split(",")[0]?.trim();
  return candidate && candidate.length <= 64 ? candidate : "network-unavailable";
}
