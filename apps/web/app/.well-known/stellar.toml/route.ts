import { NO_STORE_HEADERS } from "@/core/auth/http";
import { getServerEnv } from "@/core/config/server-env";
import { Keypair } from "@stellar/stellar-sdk";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getServerEnv();
  const signingKey = Keypair.fromSecret(env.MOVIX_SEP10_SIGNING_SECRET).publicKey();
  const body = [
    `NETWORK_PASSPHRASE="Test SDF Network ; September 2015"`,
    `SIGNING_KEY="${signingKey}"`,
    `WEB_AUTH_ENDPOINT="${new URL("/api/auth/stellar", env.MOVIX_AUTH_ISSUER)}"`,
  ].join("\n");

  return new Response(`${body}\n`, {
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
