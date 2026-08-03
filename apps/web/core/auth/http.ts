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

function isLocalHost(hostname: string): boolean {
  const clean = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    clean === "localhost" ||
    clean === "127.0.0.1" ||
    clean === "0.0.0.0" ||
    clean === "::1" ||
    clean.endsWith(".localhost")
  );
}

export function isSameOrigin(request: Request, expectedOrigin: string): boolean {
  const expected = new URL(expectedOrigin);
  const actual = new URL(request.url);

  const requestHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? actual.host;
  const requestProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? actual.protocol.replace(":", "");

  let requestHostname = requestHost;
  try {
    requestHostname = new URL(`http://${requestHost}`).hostname;
  } catch {
    requestHostname = requestHost.split(":")[0]?.replace(/^\[|\]$/g, "") ?? requestHost;
  }

  const origin = request.headers.get("origin");
  let originUrl: URL | null = null;
  if (origin) {
    try {
      originUrl = new URL(origin);
    } catch {
      return false;
    }
  }

  const isLocalDev =
    isLocalHost(expected.hostname) &&
    isLocalHost(requestHostname) &&
    (!originUrl || isLocalHost(originUrl.hostname));

  if (!isLocalDev && request.headers.get("sec-fetch-site") === "cross-site") {
    return false;
  }

  const expectedProto = expected.protocol.replace(":", "");
  const isProtoMatching = isLocalDev || requestProto === expectedProto;
  const isHostMatching = requestHost === expected.host || isLocalDev;

  let isOriginMatching = true;
  if (origin) {
    isOriginMatching = origin === expected.origin || isLocalDev;
  }

  return isProtoMatching && isHostMatching && isOriginMatching;
}

export function clientNetworkSubject(request: Request): string {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip");
  const candidate = forwarded?.split(",")[0]?.trim();
  return candidate && candidate.length <= 64 ? candidate : "network-unavailable";
}
