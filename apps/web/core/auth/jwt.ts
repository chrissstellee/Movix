import { createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";

import { getServerEnv, normalizePem } from "@/core/config/server-env";
import { exportJWK, SignJWT, type JWK } from "jose";

let privateKey: KeyObject | undefined;
let publicJwk: JWK | undefined;

function getPrivateKey() {
  privateKey ??= createPrivateKey(normalizePem(getServerEnv().MOVIX_JWT_PRIVATE_KEY));
  if (privateKey.asymmetricKeyType !== "rsa") {
    throw new Error("MOVIX_JWT_PRIVATE_KEY must be an RSA private key");
  }
  return privateKey;
}

export async function getPublicJwk() {
  if (!publicJwk) {
    publicJwk = {
      ...(await exportJWK(createPublicKey(getPrivateKey()))),
      alg: "RS256",
      kid: getServerEnv().MOVIX_JWT_ACTIVE_KID,
      use: "sig",
    };
  }
  return publicJwk;
}

export async function getPublicJwks(now = Date.now()) {
  const parsed: unknown = JSON.parse(getServerEnv().MOVIX_JWT_RETIRING_PUBLIC_KEYS);
  if (!Array.isArray(parsed)) {
    throw new Error("MOVIX_JWT_RETIRING_PUBLIC_KEYS must be a JSON array");
  }

  const retiring = parsed.flatMap((entry): JWK[] => {
    if (
      !entry ||
      typeof entry !== "object" ||
      !("retireAt" in entry) ||
      typeof entry.retireAt !== "number" ||
      entry.retireAt <= now ||
      !("jwk" in entry) ||
      !entry.jwk ||
      typeof entry.jwk !== "object"
    ) {
      return [];
    }
    const jwk = entry.jwk as JWK;
    if (
      jwk.kty !== "RSA" ||
      typeof jwk.kid !== "string" ||
      ["d", "p", "q", "dp", "dq", "qi", "oth"].some((field) => field in jwk)
    ) {
      throw new Error("Retiring JWKS entries must contain public RSA keys only");
    }
    return [{ ...jwk, alg: "RS256", use: "sig" }];
  });

  return { keys: [await getPublicJwk(), ...retiring] };
}

export async function mintAccessToken(input: {
  userId: string;
  walletAddress: string;
  familyId: string;
  familyExpiresAt: number;
  now?: number;
}) {
  const env = getServerEnv();
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  const familyExpirySeconds = Math.floor(input.familyExpiresAt / 1000);
  const expiresAt = Math.min(nowSeconds + env.MOVIX_JWT_ACCESS_SECONDS, familyExpirySeconds);
  if (expiresAt <= nowSeconds) {
    throw new Error("SESSION_EXPIRED");
  }

  const accessToken = await new SignJWT({
    session_family_id: input.familyId,
    stellar_network: "testnet",
    wallet_address: input.walletAddress,
  })
    .setProtectedHeader({ alg: "RS256", kid: env.MOVIX_JWT_ACTIVE_KID, typ: "JWT" })
    .setIssuer(env.MOVIX_AUTH_ISSUER)
    .setAudience(env.MOVIX_AUTH_AUDIENCE)
    .setSubject(input.userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt(nowSeconds)
    .setExpirationTime(expiresAt)
    .sign(getPrivateKey());

  return { accessToken, expiresAt: expiresAt * 1000 };
}
