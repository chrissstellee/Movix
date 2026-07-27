import { getServerEnv } from "@/core/config/server-env";

export type GatewayResult<T> =
  | ({ ok: true } & T)
  | {
      ok: false;
      code: string;
      retryAfter?: number;
    };

export async function callAuthStore<T>(
  path:
    | "/internal/auth/challenges/issue"
    | "/internal/auth/verification/check"
    | "/internal/auth/challenges/consume"
    | "/internal/auth/sessions/refresh"
    | "/internal/auth/sessions/logout",
  body: Record<string, unknown>,
): Promise<T> {
  const env = getServerEnv();
  const response = await fetch(new URL(path, env.MOVIX_AUTH_STORE_URL), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.MOVIX_AUTH_STORE_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`AUTH_STORE_${response.status}`);
  }
  return (await response.json()) as T;
}
