import { describe, expect, it } from "vitest";

import { isSameOrigin } from "./http";

describe("isSameOrigin", () => {
  const PROD_ISSUER = "https://movix.app";
  const LOCAL_ISSUER = "http://localhost:3000";

  it("allows standard same-origin production requests", () => {
    const req = new Request(`${PROD_ISSUER}/api/auth/stellar/challenge`, {
      headers: {
        Host: "movix.app",
        Origin: PROD_ISSUER,
        "sec-fetch-site": "same-origin",
      },
    });
    expect(isSameOrigin(req, PROD_ISSUER)).toBe(true);
  });

  it("rejects cross-origin production requests", () => {
    const req = new Request(`${PROD_ISSUER}/api/auth/stellar/challenge`, {
      headers: {
        Host: "movix.app",
        Origin: "https://evil.com",
      },
    });
    expect(isSameOrigin(req, PROD_ISSUER)).toBe(false);
  });

  it("rejects sec-fetch-site cross-site in production", () => {
    const req = new Request(`${PROD_ISSUER}/api/auth/stellar/challenge`, {
      headers: {
        Host: "movix.app",
        Origin: PROD_ISSUER,
        "sec-fetch-site": "cross-site",
      },
    });
    expect(isSameOrigin(req, PROD_ISSUER)).toBe(false);
  });

  it("allows local development loopback requests (127.0.0.1 vs localhost)", () => {
    const req = new Request("http://127.0.0.1:3000/api/auth/stellar/challenge", {
      headers: {
        Host: "127.0.0.1:3000",
        Origin: "http://127.0.0.1:3000",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(isSameOrigin(req, LOCAL_ISSUER)).toBe(true);
  });

  it("allows local development IPv6 loopback [::1] requests", () => {
    const req = new Request("http://[::1]:3000/api/auth/stellar/challenge", {
      headers: {
        Host: "[::1]:3000",
        Origin: "http://[::1]:3000",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(isSameOrigin(req, LOCAL_ISSUER)).toBe(true);
  });

  it("rejects external origins targeting local dev", () => {
    const req = new Request("http://localhost:3000/api/auth/stellar/challenge", {
      headers: {
        Host: "localhost:3000",
        Origin: "https://attacker.com",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(isSameOrigin(req, LOCAL_ISSUER)).toBe(false);
  });
});
