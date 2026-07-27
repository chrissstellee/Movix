import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    MOVIX_AUTH_AUDIENCE: v.string(),
    MOVIX_AUTH_ISSUER: v.string(),
    MOVIX_AUTH_JWKS_URL: v.string(),
    MOVIX_AUTH_PUBLIC_JWKS: v.string(),
    MOVIX_AUTH_STORE_SECRET: v.string(),
  },
});

app.use(rateLimiter);

export default app;
