interface PublicRsaJwk {
  kty: "RSA";
  kid: string;
  alg: "RS256";
  use: "sig";
  n: string;
  e: string;
}

const privateFields = ["d", "p", "q", "dp", "dq", "qi", "oth"];

export function parsePublicJwks(value: string): { keys: PublicRsaJwk[] } {
  const parsed: unknown = JSON.parse(value);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("keys" in parsed) ||
    !Array.isArray(parsed.keys) ||
    parsed.keys.length === 0
  ) {
    throw new Error("MOVIX_AUTH_PUBLIC_JWKS must contain at least one key");
  }

  const keys = parsed.keys.map((candidate): PublicRsaJwk => {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      !("kty" in candidate) ||
      candidate.kty !== "RSA" ||
      !("kid" in candidate) ||
      typeof candidate.kid !== "string" ||
      !("alg" in candidate) ||
      candidate.alg !== "RS256" ||
      !("use" in candidate) ||
      candidate.use !== "sig" ||
      !("n" in candidate) ||
      typeof candidate.n !== "string" ||
      !("e" in candidate) ||
      typeof candidate.e !== "string" ||
      privateFields.some((field) => field in candidate)
    ) {
      throw new Error("MOVIX_AUTH_PUBLIC_JWKS may contain public RS256 keys only");
    }
    return candidate as unknown as PublicRsaJwk;
  });

  return { keys };
}
