import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { hasFlag, relativeToRepo, RELEASE_WASM, requireFile, run } from "./_shared.mjs";
import { runLifecycleSmoke } from "./_smoke.mjs";

const IDENTITIES = {
  buyer: "movix-local-buyer",
  supplier: "movix-local-supplier",
  treasury: "movix-local-treasury",
};
const LOCAL_CONFIG_DIR = resolve(tmpdir(), "movix-stellar-cli-config");

if (hasFlag("--help")) {
  process.stdout.write(
    "Usage: node scripts/contracts/local-smoke.mjs [--execute]\n" +
      "Deploys the release WASM and proves release, refund, cancellation, and zero liability locally.\n",
  );
  process.exit(0);
}

if (!hasFlag("--execute")) {
  process.stdout.write(
    "Dry run only. Add --execute after contracts:local:setup and build:contracts.\n",
  );
  process.exit(0);
}

requireFile(RELEASE_WASM, "Release WASM");
const buyerAddress = publicKey(IDENTITIES.buyer);
const supplierAddress = publicKey(IDENTITIES.supplier);
const treasuryAddress = publicKey(IDENTITIES.treasury);
const xlmSac = contractAlias("movix-local-xlm");
const usdcSac = contractAlias("movix-local-usdc");

const fixtureDir = mkdtempSync(resolve(tmpdir(), "movix-s3-constructor-"));
try {
  const configPath = resolve(fixtureDir, "config.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      treasury: treasuryAddress,
      supported_sac_addresses: [xlmSac, usdcSac],
      max_fee_bps: 0,
      ttl: { threshold: 1000, extend_to: 200000 },
    }),
  );

  const contractId = run(
    "stellar",
    [
      "--config-dir",
      LOCAL_CONFIG_DIR,
      "contract",
      "deploy",
      "--wasm",
      relativeToRepo(RELEASE_WASM),
      "--source-account",
      IDENTITIES.buyer,
      "--network",
      "local",
      "--alias",
      "movix-local-escrow-v1",
      "--",
      "--config-file-path",
      configPath,
    ],
    { capture: true },
  ).stdout.trim();

  await runLifecycleSmoke({
    network: "local",
    contractId,
    buyerIdentity: IDENTITIES.buyer,
    supplierIdentity: IDENTITIES.supplier,
    buyerAddress,
    supplierAddress,
    token: xlmSac,
    cancellationWaitSeconds: 6,
    configDir: LOCAL_CONFIG_DIR,
  });
  await runLifecycleSmoke({
    network: "local",
    contractId,
    buyerIdentity: IDENTITIES.buyer,
    supplierIdentity: IDENTITIES.supplier,
    buyerAddress,
    supplierAddress,
    token: usdcSac,
    cancellationWaitSeconds: 6,
    seedOffset: 20,
    configDir: LOCAL_CONFIG_DIR,
  });
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}

function publicKey(identity) {
  return run("stellar", ["--config-dir", LOCAL_CONFIG_DIR, "keys", "public-key", identity], {
    capture: true,
  }).stdout.trim();
}

function contractAlias(alias) {
  return run(
    "stellar",
    ["--config-dir", LOCAL_CONFIG_DIR, "contract", "alias", "show", alias, "--network", "local"],
    { capture: true },
  ).stdout.trim();
}
