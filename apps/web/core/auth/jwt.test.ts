// @vitest-environment node

import { createPublicKey, generateKeyPairSync } from "node:crypto";

import { createLocalJWKSet, exportJWK, importJWK, importPKCS8, jwtVerify, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { getServerEnv } from "../config/server-env";

import { getPublicJwk, getPublicJwks, mintAccessToken } from "./jwt";

beforeAll(() => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  Object.assign(process.env, {
    MOVIX_AUTH_AUDIENCE: "movix-convex",
    MOVIX_AUTH_ISSUER: "https://movix.test",
    MOVIX_AUTH_STORE_SECRET: "a".repeat(32),
    MOVIX_AUTH_STORE_URL: "https://example.convex.site",
    MOVIX_HOME_DOMAIN: "movix.test",
    MOVIX_JWT_ACCESS_SECONDS: "600",
    MOVIX_JWT_ACTIVE_KID: "test-kid",
    MOVIX_JWT_PRIVATE_KEY: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    MOVIX_JWT_RETIRING_PUBLIC_KEYS: "[]",
    MOVIX_RATE_LIMIT_HMAC_SECRET: "b".repeat(32),
    MOVIX_SEP10_CHALLENGE_SECONDS: "300",
    MOVIX_SEP10_SIGNING_SECRET: "unused-for-jwt-test",
    MOVIX_SESSION_DAYS: "7",
    MOVIX_STELLAR_NETWORK: "testnet",
    MOVIX_WEB_AUTH_DOMAIN: "movix.test",
  });
});

describe("Movix access JWT", () => {
  it("uses RS256, exact issuer/audience, a family claim, and the bounded expiry", async () => {
    const now = 1_800_000_000_000;
    const result = await mintAccessToken({
      userId: "user-1",
      walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      familyId: "family-1",
      familyExpiresAt: now + 60_000,
      now,
    });
    const jwk = await getPublicJwk();
    const verified = await jwtVerify(result.accessToken, await importJWK(jwk, "RS256"), {
      algorithms: ["RS256"],
      issuer: "https://movix.test",
      audience: "movix-convex",
      currentDate: new Date(now),
    });

    expect(verified.protectedHeader).toMatchObject({
      alg: "RS256",
      kid: "test-kid",
      typ: "JWT",
    });
    expect(verified.payload).toMatchObject({
      sub: "user-1",
      session_family_id: "family-1",
      stellar_network: "testnet",
    });
    expect(result.expiresAt).toBe(now + 60_000);
    expect(jwk).not.toHaveProperty("d");
  });

  it("is rejected for the wrong audience", async () => {
    const now = 1_800_000_000_000;
    const result = await mintAccessToken({
      userId: "user-1",
      walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      familyId: "family-1",
      familyExpiresAt: now + 600_000,
      now,
    });
    const key = await importJWK(await getPublicJwk(), "RS256");

    await expect(
      jwtVerify(result.accessToken, key, {
        issuer: "https://movix.test",
        audience: "wrong-audience",
        currentDate: new Date(now),
      }),
    ).rejects.toThrow();
  });

  it("is rejected for the wrong issuer, signature, or verification algorithm", async () => {
    const now = 1_800_000_000_000;
    const result = await mintAccessToken({
      userId: "user-1",
      walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      familyId: "family-1",
      familyExpiresAt: now + 600_000,
      now,
    });
    const key = await importJWK(await getPublicJwk(), "RS256");
    await expect(
      jwtVerify(result.accessToken, key, {
        issuer: "https://wrong.test",
        audience: "movix-convex",
        currentDate: new Date(now),
      }),
    ).rejects.toThrow();

    const [header, payload, signature] = result.accessToken.split(".");
    const alteredSignature = `${signature!.startsWith("A") ? "B" : "A"}${signature!.slice(1)}`;
    await expect(
      jwtVerify(`${header}.${payload}.${alteredSignature}`, key, {
        algorithms: ["RS256"],
        issuer: "https://movix.test",
        audience: "movix-convex",
        currentDate: new Date(now),
      }),
    ).rejects.toThrow();

    const hs256 = await new SignJWT({ sub: "user-1" })
      .setProtectedHeader({ alg: "HS256", kid: "test-kid" })
      .setIssuer("https://movix.test")
      .setAudience("movix-convex")
      .setIssuedAt(Math.floor(now / 1000))
      .setExpirationTime(Math.floor(now / 1000) + 600)
      .sign(new TextEncoder().encode("not-an-rsa-key"));
    await expect(
      jwtVerify(hs256, key, {
        algorithms: ["RS256"],
        issuer: "https://movix.test",
        audience: "movix-convex",
        currentDate: new Date(now),
      }),
    ).rejects.toThrow();
  });

  it("is rejected after expiry and when its kid is not published", async () => {
    const now = 1_800_000_000_000;
    const result = await mintAccessToken({
      userId: "user-1",
      walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      familyId: "family-1",
      familyExpiresAt: now + 60_000,
      now,
    });
    const jwk = await getPublicJwk();
    await expect(
      jwtVerify(result.accessToken, await importJWK(jwk, "RS256"), {
        issuer: "https://movix.test",
        audience: "movix-convex",
        currentDate: new Date(now + 61_000),
      }),
    ).rejects.toThrow();

    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const unknownKidToken = await new SignJWT({ sub: "user-1" })
      .setProtectedHeader({ alg: "RS256", kid: "unknown-kid" })
      .setIssuer("https://movix.test")
      .setAudience("movix-convex")
      .setIssuedAt(Math.floor(now / 1000))
      .setExpirationTime(Math.floor(now / 1000) + 600)
      .sign(
        await importPKCS8(privateKey.export({ format: "pem", type: "pkcs8" }).toString(), "RS256"),
      );
    await expect(
      jwtVerify(unknownKidToken, createLocalJWKSet({ keys: [jwk] }), {
        algorithms: ["RS256"],
        issuer: "https://movix.test",
        audience: "movix-convex",
        currentDate: new Date(now),
      }),
    ).rejects.toThrow();
  });

  it("publishes valid retiring public keys only during their overlap window", async () => {
    const now = 1_800_000_000_000;
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const retiringJwk = {
      ...(await exportJWK(createPublicKey(privateKey))),
      kid: "retiring-kid",
    };
    const env = getServerEnv();
    env.MOVIX_JWT_RETIRING_PUBLIC_KEYS = JSON.stringify([
      { retireAt: now + 60_000, jwk: retiringJwk },
      { retireAt: now - 1, jwk: { ...retiringJwk, kid: "expired-kid" } },
    ]);

    const jwks = await getPublicJwks(now);
    expect(jwks.keys.map((key) => key.kid)).toEqual(["test-kid", "retiring-kid"]);
    expect(jwks.keys.every((key) => !("d" in key))).toBe(true);

    env.MOVIX_JWT_RETIRING_PUBLIC_KEYS = JSON.stringify([
      { retireAt: now + 60_000, jwk: { ...retiringJwk, d: "private-material" } },
    ]);
    await expect(getPublicJwks(now)).rejects.toThrow(/public RSA keys only/);
    env.MOVIX_JWT_RETIRING_PUBLIC_KEYS = "[]";
  });
});
