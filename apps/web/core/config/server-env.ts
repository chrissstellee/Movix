import { z } from "zod";

const serverEnvSchema = z.object({
  MOVIX_AUTH_AUDIENCE: z.string().min(1),
  MOVIX_AUTH_ISSUER: z.url(),
  MOVIX_AUTH_STORE_SECRET: z.string().min(32),
  MOVIX_AUTH_STORE_URL: z.url(),
  MOVIX_HOME_DOMAIN: z.string().min(1),
  MOVIX_HORIZON_URL: z.url().default("https://horizon-testnet.stellar.org"),
  MOVIX_JWT_ACCESS_SECONDS: z.coerce.number().int().min(60).max(600).default(600),
  MOVIX_JWT_ACTIVE_KID: z.string().min(1),
  MOVIX_JWT_PRIVATE_KEY: z.string().min(1),
  MOVIX_JWT_RETIRING_PUBLIC_KEYS: z.string().default("[]"),
  MOVIX_RATE_LIMIT_HMAC_SECRET: z.string().min(32),
  MOVIX_SEP10_CHALLENGE_SECONDS: z.coerce.number().int().min(60).max(300).default(300),
  MOVIX_SEP10_SIGNING_SECRET: z.string().min(1),
  MOVIX_SESSION_DAYS: z.coerce.number().int().min(1).max(7).default(7),
  MOVIX_STELLAR_NETWORK: z.literal("testnet").default("testnet"),
  MOVIX_WEB_AUTH_DOMAIN: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}

export function normalizePem(value: string): string {
  return value.replaceAll("\\n", "\n");
}
