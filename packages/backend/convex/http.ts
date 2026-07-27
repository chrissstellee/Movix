import { httpRouter, makeFunctionReference, type FunctionReference } from "convex/server";

import { httpAction } from "./_generated/server";
import { parsePublicJwks } from "./authJwks";

type JsonObject = Record<string, unknown>;

const issueChallenge = makeFunctionReference<"mutation">("authStore:issueChallenge");
const limitVerification = makeFunctionReference<"mutation">("authStore:limitVerification");
const consumeChallenge = makeFunctionReference<"mutation">("authStore:consumeChallenge");
const rotateSession = makeFunctionReference<"mutation">("authStore:rotateSession");
const revokeSession = makeFunctionReference<"mutation">("authStore:revokeSession");

function forbidden() {
  return Response.json({ error: "forbidden" }, { status: 403 });
}

function isAuthorized(request: Request) {
  const configured = process.env.MOVIX_AUTH_STORE_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied || configured.length !== supplied.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < configured.length; index += 1) {
    difference |= configured.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return difference === 0;
}

async function readJsonObject(request: Request): Promise<JsonObject | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return null;
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 65_536) {
    return null;
  }
  const body: unknown = await request.json().catch(() => null);
  return body !== null && typeof body === "object" && !Array.isArray(body)
    ? (body as JsonObject)
    : null;
}

function route(path: string, functionReference: FunctionReference<"mutation", "public">) {
  return {
    path,
    method: "POST" as const,
    handler: httpAction(async (ctx, request) => {
      if (!isAuthorized(request)) {
        return forbidden();
      }
      const body = await readJsonObject(request);
      if (!body) {
        return Response.json({ error: "invalid_request" }, { status: 400 });
      }
      try {
        const result: unknown = await ctx.runMutation(functionReference, body);
        return Response.json(result, {
          headers: {
            "Cache-Control": "no-store",
            "Content-Security-Policy": "default-src 'none'",
          },
        });
      } catch {
        return Response.json({ error: "invalid_request" }, { status: 400 });
      }
    }),
  };
}

const http = httpRouter();
http.route({
  path: "/.well-known/movix-auth-jwks.json",
  method: "GET",
  handler: httpAction(async () => {
    try {
      return Response.json(parsePublicJwks(process.env.MOVIX_AUTH_PUBLIC_JWKS!), {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
          "Content-Security-Policy": "default-src 'none'",
        },
      });
    } catch {
      return Response.json({ error: "service_unavailable" }, { status: 503 });
    }
  }),
});
http.route(route("/internal/auth/challenges/issue", issueChallenge));
http.route(route("/internal/auth/verification/check", limitVerification));
http.route(route("/internal/auth/challenges/consume", consumeChallenge));
http.route(route("/internal/auth/sessions/refresh", rotateSession));
http.route(route("/internal/auth/sessions/logout", revokeSession));

export default http;
