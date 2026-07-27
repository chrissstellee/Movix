import {
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
} from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Keypair } from "@stellar/stellar-sdk";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webEnvPath = resolve(projectRoot, "apps/web/.env.local");
const backendEnvPath = resolve(projectRoot, "packages/backend/.env.local");
const syncConvex = process.argv.includes("--sync-convex");

function readEnv(path) {
  if (!existsSync(path)) return { source: "", values: new Map() };
  const source = readFileSync(path, "utf8");
  const values = new Map();
  for (const line of source.split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (match) values.set(match[1], match[2].replace(/^["']|["']$/gu, ""));
  }
  return { source, values };
}

function escaped(value) {
  return value.replaceAll("\r", "").replaceAll("\n", "\\n");
}

function updateEnv(source, additions) {
  let next = source.trimEnd();
  for (const [name, value] of Object.entries(additions)) {
    const line = `${name}=${escaped(value)}`;
    const pattern = new RegExp(`^${name}=.*$`, "mu");
    next = pattern.test(next) ? next.replace(pattern, line) : `${next}\n${line}`;
  }
  return `${next.trimStart()}\n`;
}

function requiredUrl(values, name) {
  const value = values.get(name);
  if (!value) throw new Error(`${name} is missing from the existing Convex environment file`);
  new URL(value);
  return value;
}

const web = readEnv(webEnvPath);
const backend = readEnv(backendEnvPath);
const convexSiteUrl = (
  web.values.get("NEXT_PUBLIC_CONVEX_SITE_URL") ??
  requiredUrl(backend.values, "CONVEX_SITE_URL")
).replace(/\/$/u, "");
new URL(convexSiteUrl);

const existing = web.values;
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPem =
  existing.get("MOVIX_JWT_PRIVATE_KEY")?.replaceAll("\\n", "\n") ??
  privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const activeKid = existing.get("MOVIX_JWT_ACTIVE_KID") ?? "local-rs256-1";
const additions = {
  MOVIX_STELLAR_NETWORK: existing.get("MOVIX_STELLAR_NETWORK") ?? "testnet",
  MOVIX_HOME_DOMAIN: existing.get("MOVIX_HOME_DOMAIN") ?? "localhost:3000",
  MOVIX_WEB_AUTH_DOMAIN: existing.get("MOVIX_WEB_AUTH_DOMAIN") ?? "localhost:3000",
  MOVIX_AUTH_ISSUER: existing.get("MOVIX_AUTH_ISSUER") ?? "http://localhost:3000",
  MOVIX_AUTH_AUDIENCE: existing.get("MOVIX_AUTH_AUDIENCE") ?? "movix-convex",
  MOVIX_AUTH_STORE_URL: existing.get("MOVIX_AUTH_STORE_URL") ?? convexSiteUrl,
  MOVIX_HORIZON_URL:
    existing.get("MOVIX_HORIZON_URL") ?? "https://horizon-testnet.stellar.org",
  MOVIX_JWT_ACTIVE_KID: activeKid,
  MOVIX_JWT_RETIRING_PUBLIC_KEYS:
    existing.get("MOVIX_JWT_RETIRING_PUBLIC_KEYS") ?? "[]",
  MOVIX_SEP10_CHALLENGE_SECONDS:
    existing.get("MOVIX_SEP10_CHALLENGE_SECONDS") ?? "300",
  MOVIX_JWT_ACCESS_SECONDS: existing.get("MOVIX_JWT_ACCESS_SECONDS") ?? "600",
  MOVIX_SESSION_DAYS: existing.get("MOVIX_SESSION_DAYS") ?? "7",
  MOVIX_SEP10_SIGNING_SECRET:
    existing.get("MOVIX_SEP10_SIGNING_SECRET") ?? Keypair.random().secret(),
  MOVIX_JWT_PRIVATE_KEY: privateKeyPem,
  MOVIX_RATE_LIMIT_HMAC_SECRET:
    existing.get("MOVIX_RATE_LIMIT_HMAC_SECRET") ?? randomBytes(32).toString("base64url"),
  MOVIX_AUTH_STORE_SECRET:
    existing.get("MOVIX_AUTH_STORE_SECRET") ?? randomBytes(32).toString("base64url"),
};

const secretValues = [
  additions.MOVIX_SEP10_SIGNING_SECRET,
  additions.MOVIX_JWT_PRIVATE_KEY,
  additions.MOVIX_RATE_LIMIT_HMAC_SECRET,
  additions.MOVIX_AUTH_STORE_SECRET,
];
if (new Set(secretValues).size !== secretValues.length) {
  throw new Error("Local authentication secrets must be distinct");
}

writeFileSync(webEnvPath, updateEnv(web.source, additions), "utf8");

const publicJwk = {
  ...createPublicKey(privateKeyPem).export({ format: "jwk" }),
  alg: "RS256",
  kid: activeKid,
  use: "sig",
};
const convexValues = {
  MOVIX_AUTH_ISSUER: additions.MOVIX_AUTH_ISSUER,
  MOVIX_AUTH_AUDIENCE: additions.MOVIX_AUTH_AUDIENCE,
  MOVIX_AUTH_STORE_SECRET: additions.MOVIX_AUTH_STORE_SECRET,
  MOVIX_AUTH_PUBLIC_JWKS: JSON.stringify({ keys: [publicJwk] }),
  MOVIX_AUTH_JWKS_URL: `${convexSiteUrl}/.well-known/movix-auth-jwks.json`,
};

if (syncConvex) {
  const pnpmCli = process.env.npm_execpath;
  if (!pnpmCli) throw new Error("Run this setup through pnpm auth:setup:convex");
  for (const [name, value] of Object.entries(convexValues)) {
    const result = spawnSync(
      process.execPath,
      [pnpmCli, "exec", "convex", "env", "set", name, value],
      {
        cwd: resolve(projectRoot, "packages/backend"),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (result.status !== 0) {
      throw new Error(`Could not synchronize ${name} with the Convex dev deployment`);
    }
  }
}

console.log("Configured apps/web/.env.local with development-only authentication keys.");
if (syncConvex) {
  console.log(
    `Synchronized Convex dev variables: ${Object.keys(convexValues).join(", ")}.`,
  );
} else {
  console.log("No external deployment was changed.");
  console.log("Run pnpm auth:setup:convex to synchronize the selected Convex dev deployment.");
}
console.log("Restart pnpm dev so Next.js and Convex reload the updated configuration.");
