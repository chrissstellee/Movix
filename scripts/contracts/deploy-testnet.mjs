import { hasFlag, relativeToRepo, RELEASE_WASM, requireEnv, requireFile, run } from "./_shared.mjs";

if (hasFlag("--help")) {
  process.stdout.write(
    "Usage: node scripts/contracts/deploy-testnet.mjs [--execute]\n" +
      "Dry-runs by default. Execution requires MOVIX_ENABLE_TESTNET_DEPLOY=1,\n" +
      "MOVIX_TESTNET_SOURCE_ACCOUNT, and MOVIX_ESCROW_CONSTRUCTOR_CONFIG.\n",
  );
  process.exit(0);
}

const execute = hasFlag("--execute");
const sourceAccount = execute
  ? requireEnv("MOVIX_TESTNET_SOURCE_ACCOUNT")
  : "<MOVIX_TESTNET_SOURCE_ACCOUNT>";
const constructorConfig = execute
  ? requireEnv("MOVIX_ESCROW_CONSTRUCTOR_CONFIG")
  : "<MOVIX_ESCROW_CONSTRUCTOR_CONFIG>";

if (execute && process.env.MOVIX_ENABLE_TESTNET_DEPLOY !== "1") {
  throw new Error("Set MOVIX_ENABLE_TESTNET_DEPLOY=1 to acknowledge the testnet mutation");
}
if (execute) {
  requireFile(RELEASE_WASM, "Verified release WASM");
  requireFile(constructorConfig, "Constructor config");
}

const args = [
  "contract",
  "deploy",
  "--wasm",
  relativeToRepo(RELEASE_WASM),
  "--source-account",
  sourceAccount,
  "--network",
  "testnet",
  "--alias",
  "movix-escrow-v1",
  "--",
  "--config-file-path",
  constructorConfig,
];
const result = run("stellar", args, { capture: execute, dryRun: !execute });

if (execute) {
  process.stdout.write(
    `${JSON.stringify(
      {
        network: "testnet",
        contractId: result.stdout.trim(),
        wasmPath: relativeToRepo(RELEASE_WASM),
        evidenceStatus:
          "Contract ID captured. Record the deployment transaction hash and ledger before creating escrow-v1.json.",
      },
      null,
      2,
    )}\n`,
  );
}
