import { describe, expect, it } from "vitest";

import { parsePublicJwks } from "./authJwks";

const publicKey = {
  kty: "RSA",
  kid: "local-rs256-1",
  alg: "RS256",
  use: "sig",
  n: "fixture-modulus",
  e: "AQAB",
};

describe("development JWKS bridge", () => {
  it("accepts a public RS256 key set", () => {
    expect(parsePublicJwks(JSON.stringify({ keys: [publicKey] }))).toEqual({
      keys: [publicKey],
    });
  });

  it("rejects malformed, empty, or private key sets", () => {
    for (const value of [
      "not-json",
      JSON.stringify({ keys: [] }),
      JSON.stringify({ keys: [{ ...publicKey, d: "private-material" }] }),
      JSON.stringify({ keys: [{ ...publicKey, alg: "HS256" }] }),
    ]) {
      expect(() => parsePublicJwks(value)).toThrow();
    }
  });
});
