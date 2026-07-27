// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  credential: "current-credential" as string | undefined,
  callAuthStore: vi.fn(),
  mintAccessToken: vi.fn(),
  getServerEnv: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => (mocks.credential ? { value: mocks.credential } : undefined),
  })),
}));
vi.mock("@/core/auth/gateway", () => ({
  callAuthStore: mocks.callAuthStore,
}));
vi.mock("@/core/auth/jwt", () => ({
  mintAccessToken: mocks.mintAccessToken,
}));
vi.mock("@/core/config/server-env", () => ({
  getServerEnv: mocks.getServerEnv,
}));

import { POST as logout } from "./logout/route";
import { POST as refresh } from "./token/route";

const user = {
  id: "user-1",
  walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  network: "testnet" as const,
};

function request(path: string, origin = "https://movix.test", host = "movix.test") {
  return new Request(`https://${host}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: "{}",
  });
}

beforeEach(() => {
  mocks.credential = "current-credential";
  mocks.callAuthStore.mockReset();
  mocks.mintAccessToken.mockReset();
  mocks.getServerEnv.mockReset();
  mocks.getServerEnv.mockReturnValue({
    MOVIX_AUTH_ISSUER: "https://movix.test",
    MOVIX_JWT_ACTIVE_KID: "kid-1",
  });
  mocks.mintAccessToken.mockResolvedValue({
    accessToken: "fixture-access-token",
    expiresAt: 1_800_000_600_000,
  });
});

describe("refresh route", () => {
  it("rejects a wrong origin or request host", async () => {
    await expect(refresh(request("/api/auth/token", "https://evil.test"))).resolves.toMatchObject({
      status: 403,
    });
    await expect(
      refresh(request("/api/auth/token", "https://movix.test", "evil.test")),
    ).resolves.toMatchObject({ status: 403 });
    expect(mocks.callAuthStore).not.toHaveBeenCalled();
  });

  it("rejects a missing session credential", async () => {
    mocks.credential = undefined;
    const response = await refresh(request("/api/auth/token"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "session_expired" },
    });
  });

  it("rotates successfully and replaces the cookie", async () => {
    mocks.callAuthStore.mockResolvedValue({
      ok: true,
      familyId: "family-1",
      familyExpiresAt: 1_800_100_000_000,
      user,
    });
    const response = await refresh(request("/api/auth/token"));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("movix_session_local=");
    await expect(response.json()).resolves.toEqual({
      accessToken: "fixture-access-token",
      expiresAt: 1_800_000_600_000,
      user,
    });
  });

  it("returns a retryable conflict without clearing the cookie", async () => {
    mocks.callAuthStore.mockResolvedValue({ ok: false, code: "session_conflict" });
    const response = await refresh(request("/api/auth/token"));

    expect(response.status).toBe(409);
    expect(response.headers.get("retry-after")).toBe("1");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("clears the cookie after terminal reuse or revocation", async () => {
    for (const code of ["session_reused", "session_revoked"]) {
      mocks.callAuthStore.mockResolvedValueOnce({ ok: false, code });
      const response = await refresh(request("/api/auth/token"));
      expect(response.status).toBe(401);
      expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    }
  });
});

describe("logout route", () => {
  it("is idempotent without a cookie", async () => {
    mocks.credential = undefined;
    const response = await logout(request("/api/auth/logout"));

    expect(response.status).toBe(200);
    expect(mocks.callAuthStore).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("clears the cookie only after confirmed revocation", async () => {
    mocks.callAuthStore.mockResolvedValue({ ok: true });
    const response = await logout(request("/api/auth/logout"));

    expect(response.status).toBe(200);
    expect(mocks.callAuthStore).toHaveBeenCalledWith(
      "/internal/auth/sessions/logout",
      expect.objectContaining({ credentialHash: expect.any(String) }),
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("retains the cookie when revocation cannot be confirmed", async () => {
    mocks.callAuthStore.mockRejectedValue(new Error("store unavailable"));
    const response = await logout(request("/api/auth/logout"));

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "service_unavailable" },
    });
  });
});
