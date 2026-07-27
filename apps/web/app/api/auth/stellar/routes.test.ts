// @vitest-environment node

import { Keypair, Networks, TransactionBuilder, WebAuth } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  intent: "login-intent" as string | undefined,
  env: {} as Record<string, unknown>,
  callAuthStore: vi.fn(),
  loadAccount: vi.fn(),
  mintAccessToken: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => (mocks.intent ? { value: mocks.intent } : undefined),
  })),
}));
vi.mock("@/core/auth/gateway", () => ({
  callAuthStore: mocks.callAuthStore,
}));
vi.mock("@/core/auth/jwt", () => ({
  mintAccessToken: mocks.mintAccessToken,
}));
vi.mock("@/core/config/server-env", () => ({
  getServerEnv: () => mocks.env,
}));
vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function MockHorizonServer() {
        return { loadAccount: mocks.loadAccount };
      }),
    },
  };
});

import { GET as challenge } from "./challenge/route";
import { POST as verify } from "./token/route";

function getRequest(account: string, origin = "https://movix.test", host = "movix.test") {
  return new Request(`https://${host}/api/auth/stellar/challenge?account=${account}`, {
    headers: {
      Origin: origin,
      "x-vercel-forwarded-for": "192.0.2.10",
    },
  });
}

function postRequest(
  body: unknown,
  { origin = "https://movix.test", host = "movix.test", contentType = "application/json" } = {},
) {
  return new Request(`https://${host}/api/auth/stellar/token`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": contentType,
      "x-vercel-forwarded-for": "192.0.2.10",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  const server = Keypair.random();
  mocks.intent = "login-intent";
  mocks.callAuthStore.mockReset();
  mocks.loadAccount.mockReset();
  mocks.mintAccessToken.mockReset();
  mocks.env = {
    MOVIX_AUTH_ISSUER: "https://movix.test",
    MOVIX_HOME_DOMAIN: "movix.test",
    MOVIX_WEB_AUTH_DOMAIN: "auth.movix.test",
    MOVIX_SEP10_SIGNING_SECRET: server.secret(),
    MOVIX_SEP10_CHALLENGE_SECONDS: 300,
    MOVIX_RATE_LIMIT_HMAC_SECRET: "r".repeat(32),
    MOVIX_HORIZON_URL: "https://horizon-testnet.stellar.org",
    MOVIX_SESSION_DAYS: 7,
    MOVIX_JWT_ACTIVE_KID: "kid-1",
  };
});

describe("challenge route", () => {
  it("rejects wrong origin, host, cross-site metadata, and invalid accounts", async () => {
    const account = Keypair.random().publicKey();
    await expect(challenge(getRequest(account, "https://evil.test"))).resolves.toMatchObject({
      status: 403,
    });
    await expect(
      challenge(getRequest(account, "https://movix.test", "evil.test")),
    ).resolves.toMatchObject({ status: 403 });
    const crossSite = getRequest(account);
    crossSite.headers.set("sec-fetch-site", "cross-site");
    await expect(challenge(crossSite)).resolves.toMatchObject({ status: 403 });
    await expect(challenge(getRequest("not-an-account"))).resolves.toMatchObject({ status: 400 });
    expect(mocks.callAuthStore).not.toHaveBeenCalled();
  });

  it("issues a no-store Testnet challenge and a bounded login-intent cookie", async () => {
    mocks.intent = undefined;
    mocks.callAuthStore.mockResolvedValue({ ok: true });
    const account = Keypair.random().publicKey();
    const response = await challenge(getRequest(account));
    const body = (await response.json()) as { transactionXdr: string; networkPassphrase: string };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("set-cookie")).toContain("movix_login_intent=");
    expect(body.networkPassphrase).toBe(Networks.TESTNET);
    const transaction = TransactionBuilder.fromXDR(body.transactionXdr, Networks.TESTNET);
    expect("sequence" in transaction ? transaction.sequence : null).toBe("0");
    expect(mocks.callAuthStore).toHaveBeenCalledWith(
      "/internal/auth/challenges/issue",
      expect.objectContaining({
        account,
        rateLimitKey: expect.any(String),
        coarseRateLimitKey: expect.any(String),
      }),
    );
  });

  it("maps challenge throttling to 429 with retry metadata", async () => {
    mocks.callAuthStore.mockResolvedValue({
      ok: false,
      code: "rate_limited",
      retryAfter: 2_000,
    });
    const response = await challenge(getRequest(Keypair.random().publicKey()));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("2");
  });
});

describe("signed challenge route", () => {
  it("rejects wrong origin, content type, missing input, and missing intent before verification", async () => {
    await expect(
      verify(postRequest({ signedTransactionXdr: "xdr" }, { origin: "https://evil.test" })),
    ).resolves.toMatchObject({ status: 403 });
    await expect(
      verify(postRequest({ signedTransactionXdr: "xdr" }, { contentType: "text/plain" })),
    ).resolves.toMatchObject({ status: 400 });
    const oversized = postRequest({ signedTransactionXdr: "xdr" });
    oversized.headers.set("content-length", "65537");
    await expect(verify(oversized)).resolves.toMatchObject({ status: 400 });
    await expect(verify(postRequest({}))).resolves.toMatchObject({ status: 400 });
    mocks.intent = undefined;
    await expect(verify(postRequest({ signedTransactionXdr: "xdr" }))).resolves.toMatchObject({
      status: 400,
    });
    expect(mocks.loadAccount).not.toHaveBeenCalled();
  });

  it("rate limits before parsing XDR or calling Horizon", async () => {
    mocks.callAuthStore.mockResolvedValue({
      ok: false,
      code: "rate_limited",
      retryAfter: 3_000,
    });
    const response = await verify(postRequest({ signedTransactionXdr: "not-xdr" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3");
    expect(mocks.loadAccount).not.toHaveBeenCalled();
  });

  it("verifies a real signed fixture before atomically establishing the session", async () => {
    const server = Keypair.fromSecret(mocks.env.MOVIX_SEP10_SIGNING_SECRET as string);
    const client = Keypair.random();
    const challengeXdr = WebAuth.buildChallengeTx(
      server,
      client.publicKey(),
      mocks.env.MOVIX_HOME_DOMAIN as string,
      300,
      Networks.TESTNET,
      mocks.env.MOVIX_WEB_AUTH_DOMAIN as string,
    );
    const transaction = TransactionBuilder.fromXDR(challengeXdr, Networks.TESTNET);
    transaction.sign(client);
    const signedTransactionXdr = transaction.toEnvelope().toXDR("base64").toString();
    mocks.loadAccount.mockResolvedValue({
      thresholds: { med_threshold: 1 },
      signers: [{ key: client.publicKey(), weight: 1, type: "ed25519_public_key" }],
    });
    mocks.callAuthStore.mockImplementation(async (path: string) =>
      path === "/internal/auth/verification/check"
        ? { ok: true }
        : {
            ok: true,
            familyId: "family-1",
            familyExpiresAt: Date.now() + 600_000,
            user: { id: "user-1", walletAddress: client.publicKey(), network: "testnet" },
          },
    );
    mocks.mintAccessToken.mockResolvedValue({
      accessToken: "fixture-access-token",
      expiresAt: Date.now() + 600_000,
    });

    const response = await verify(postRequest({ signedTransactionXdr }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("movix_session_local=");
    expect(mocks.callAuthStore).toHaveBeenNthCalledWith(
      2,
      "/internal/auth/challenges/consume",
      expect.objectContaining({
        account: client.publicKey(),
        challengeHash: transaction.hash().toString("hex"),
      }),
    );
  });
});
