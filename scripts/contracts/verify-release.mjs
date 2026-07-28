import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";

import {
  BINDINGS_DIR,
  hasFlag,
  readJson,
  RELEASE_WASM,
  sha256Directory,
  sha256File,
  TESTNET_MANIFEST,
} from "./_shared.mjs";

if (hasFlag("--help")) {
  process.stdout.write(
    "Usage: node scripts/contracts/verify-release.mjs\n" +
      "Fails unless the manifest, optimized WASM, generated bindings, and contract source commit agree.\n",
  );
  process.exit(0);
}

const manifest = readJson(TESTNET_MANIFEST);
for (const field of [
  "schemaVersion",
  "contractVersion",
  "escrowSchemaVersion",
  "network",
  "source",
  "toolchain",
  "artifact",
  "bindings",
  "deployment",
  "constructor",
  "evidenceIndex",
  "testnetOnly",
]) {
  if (!(field in manifest)) {
    throw new Error(`Manifest is missing ${field}`);
  }
}

if (manifest.network !== "testnet" || manifest.testnetOnly !== true) {
  throw new Error("Manifest must be explicitly testnet-only");
}
if (manifest.contractVersion !== 1 || manifest.escrowSchemaVersion !== 1) {
  throw new Error("Manifest version does not identify escrow contract/schema v1");
}
if (!manifest.deployment.contractId || !manifest.deployment.transactionHash) {
  throw new Error("Manifest does not identify a completed deployment");
}

const actualArtifactHash = sha256File(RELEASE_WASM);
const actualArtifactSize = statSync(RELEASE_WASM).size;
const actualBindingsHash = sha256Directory(BINDINGS_DIR);
const sourceCommit = runGit([
  "rev-list",
  "-1",
  "HEAD",
  "--",
  "contracts/Cargo.toml",
  "contracts/Cargo.lock",
  "contracts/escrow/Cargo.toml",
  "contracts/escrow/src/lib.rs",
]);
const worktreeStatus = runGit(["status", "--porcelain"]);
if (worktreeStatus) {
  throw new Error("Release verification requires a clean worktree");
}

const mismatches = [];
compare(mismatches, "source.commit", manifest.source.commit, sourceCommit);
compare(mismatches, "artifact.sha256", manifest.artifact.sha256, actualArtifactHash);
compare(mismatches, "artifact.sizeBytes", manifest.artifact.sizeBytes, actualArtifactSize);
compare(mismatches, "bindings.sha256", manifest.bindings.sha256, actualBindingsHash);

if (mismatches.length > 0) {
  throw new Error(`Release verification failed:\n- ${mismatches.join("\n- ")}`);
}

process.stdout.write(
  `${JSON.stringify(
    {
      verified: true,
      sourceCommit,
      wasmSha256: actualArtifactHash,
      bindingsSha256: actualBindingsHash,
      contractId: manifest.deployment.contractId,
    },
    null,
    2,
  )}\n`,
);

function compare(mismatches, label, expected, actual) {
  if (expected !== actual) {
    mismatches.push(
      `${label}: manifest=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`,
    );
  }
}

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8", shell: false });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}
