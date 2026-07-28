import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { hasFlag, printCommand, run } from "./_shared.mjs";

const CONTAINER = "movix-s3-local";
const LOCAL_CONFIG_DIR = resolve(tmpdir(), "movix-stellar-cli-config");
const IDENTITIES = {
  buyer: "movix-local-buyer",
  supplier: "movix-local-supplier",
  wrongParty: "movix-local-wrong-party",
  treasury: "movix-local-treasury",
  issuer: "movix-local-issuer",
};

if (hasFlag("--help")) {
  process.stdout.write(
    "Usage: node scripts/contracts/local-setup.mjs [--execute] [--reset]\n" +
      "Without --execute, prints the secret-safe setup outline. --reset stops only movix-s3-local and recreates its temporary identities.\n",
  );
  process.exit(0);
}

if (!hasFlag("--execute")) {
  printCommand("stellar", [
    "--config-dir",
    LOCAL_CONFIG_DIR,
    "container",
    "start",
    "local",
    "--name",
    CONTAINER,
    "--limits",
    "testnet",
    "--protocol-version",
    "27",
  ]);
  for (const identity of Object.values(IDENTITIES)) {
    printCommand("stellar", [
      "--config-dir",
      LOCAL_CONFIG_DIR,
      "keys",
      "generate",
      identity,
      "--network",
      "local",
    ]);
    printCommand("stellar", ["--config-dir", LOCAL_CONFIG_DIR, "keys", "public-key", identity]);
    process.stdout.write(`HTTP GET local Quickstart Friendbot for ${identity}\n`);
  }
  process.stdout.write("Dry run only. Add --execute to create local fixtures.\n");
  process.exit(0);
}

if (hasFlag("--reset")) {
  try {
    stellar(["container", "stop", CONTAINER]);
  } catch {
    process.stdout.write(`Container ${CONTAINER} was not running; continuing.\n`);
  }
  resetLocalConfig();
}

stellar([
  "container",
  "start",
  "local",
  "--name",
  CONTAINER,
  "--limits",
  "testnet",
  "--protocol-version",
  "27",
]);
await waitForLocalNetwork();

for (const identity of Object.values(IDENTITIES)) {
  ensureIdentity(identity);
  await fundLocalIdentity(identity);
}

const addresses = Object.fromEntries(
  Object.entries(IDENTITIES).map(([role, identity]) => [
    role,
    stellar(["keys", "public-key", identity], { capture: true }).stdout.trim(),
  ]),
);
const issuedAsset = `USDC:${addresses.issuer}`;

for (const identity of [IDENTITIES.buyer, IDENTITIES.supplier, IDENTITIES.treasury]) {
  stellar([
    "tx",
    "new",
    "change-trust",
    "--source-account",
    identity,
    "--line",
    issuedAsset,
    "--network",
    "local",
  ]);
}

const xlmSac = stellar(
  [
    "contract",
    "asset",
    "deploy",
    "--asset",
    "native",
    "--source-account",
    IDENTITIES.issuer,
    "--network",
    "local",
    "--alias",
    "movix-local-xlm",
  ],
  { capture: true },
).stdout.trim();
const usdcSac = stellar(
  [
    "contract",
    "asset",
    "deploy",
    "--asset",
    issuedAsset,
    "--source-account",
    IDENTITIES.issuer,
    "--network",
    "local",
    "--alias",
    "movix-local-usdc",
  ],
  { capture: true },
).stdout.trim();

stellar([
  "contract",
  "invoke",
  "--id",
  usdcSac,
  "--source-account",
  IDENTITIES.issuer,
  "--network",
  "local",
  "--",
  "mint",
  "--to",
  addresses.buyer,
  "--amount",
  "1000000000000",
]);

process.stdout.write(
  `${JSON.stringify(
    {
      network: "local",
      networkPassphrase: "Standalone Network ; February 2017",
      actors: addresses,
      assets: {
        XLM: { sac: xlmSac },
        USDC: { issuer: addresses.issuer, sac: usdcSac },
      },
    },
    null,
    2,
  )}\n`,
);

function ensureIdentity(identity) {
  try {
    stellar(["keys", "public-key", identity], { capture: true });
  } catch {
    stellar(["keys", "generate", identity, "--network", "local"]);
  }
}

async function waitForLocalNetwork() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      stellar(["network", "info", "--network", "local"], { capture: true });
      return;
    } catch {
      if (attempt === 30) {
        throw new Error("Local Stellar RPC did not become ready within 60 seconds");
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
    }
  }
}

async function fundLocalIdentity(identity) {
  const address = stellar(["keys", "public-key", identity], { capture: true }).stdout.trim();
  const url = `http://localhost:8000/friendbot?addr=${encodeURIComponent(address)}`;

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(url);
      const body = await response.json();
      if (response.ok && body.successful === true) {
        return;
      }
    } catch {
      // Quickstart may expose RPC before Friendbot is ready.
    }
    if (attempt === 30) {
      throw new Error(`Local Friendbot could not fund ${identity} within 60 seconds`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
  }
}

function stellar(args, options) {
  return run("stellar", ["--config-dir", LOCAL_CONFIG_DIR, ...args], options);
}

function resetLocalConfig() {
  const expected = resolve(tmpdir(), "movix-stellar-cli-config");
  if (LOCAL_CONFIG_DIR !== expected) {
    throw new Error(`Refusing to reset unexpected Stellar config path: ${LOCAL_CONFIG_DIR}`);
  }
  rmSync(LOCAL_CONFIG_DIR, { recursive: true, force: true });
}
