import type { AuthConfig } from "convex/server";

const issuer = process.env.MOVIX_AUTH_ISSUER!;
const audience = process.env.MOVIX_AUTH_AUDIENCE!;
const jwks = process.env.MOVIX_AUTH_JWKS_URL!;

export default {
  providers: [
    {
      type: "customJwt",
      applicationID: audience,
      issuer,
      jwks,
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
