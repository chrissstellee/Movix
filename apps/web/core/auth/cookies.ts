import { getServerEnv } from "@/core/config/server-env";

import type { NextResponse } from "next/server";

export const LOGIN_INTENT_COOKIE = "movix_login_intent";

export function sessionCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-movix_session" : "movix_session_local";
}

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function setLoginIntentCookie(response: NextResponse, intent: string) {
  response.cookies.set(LOGIN_INTENT_COOKIE, intent, {
    ...cookieBase(),
    maxAge: getServerEnv().MOVIX_SEP10_CHALLENGE_SECONDS,
  });
}

export function setSessionCookie(response: NextResponse, credential: string, expiresAt: number) {
  response.cookies.set(sessionCookieName(), credential, {
    ...cookieBase(),
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookieName(), "", {
    ...cookieBase(),
    expires: new Date(0),
    maxAge: 0,
  });
}
