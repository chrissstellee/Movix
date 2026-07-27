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
  const origin = request.headers.get("origin");
  const expected = new URL(expectedOrigin);
  const actual = new URL(request.url);
  return (
    origin === expected.origin &&
    actual.protocol === expected.protocol &&
    actual.host === expected.host
  );
}

export function clientNetworkSubject(request: Request): string {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip");
  const candidate = forwarded?.split(",")[0]?.trim();
  return candidate && candidate.length <= 64 ? candidate : "network-unavailable";
}
