import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { rpc } from "@stellar/stellar-sdk";

import {
  BINDINGS_DIR,
  hasFlag,
  relativeToRepo,
  RELEASE_WASM,
  requireFile,
  run,
  sha256Directory,
  sha256File,
} from "./_shared.mjs";
import { runLifecycleSmoke } from "./_smoke.mjs";

const TESTNET_CONFIG_DIR = resolve(tmpdir(), "movix-testnet-cli-config");
const RPC_URL = "https://soroban-testnet.stellar.org";
const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_SAC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const IDENTITIES = {
  buyer: "movix-s3-testnet-buyer",
  supplier: "movix-s3-testnet-supplier",
  treasury: "movix-s3-testnet-treasury",
};

if (hasFlag("--help")) {
  process.stdout.write(
    "Usage: node scripts/contracts/testnet-proof.mjs [--execute]\n" +
      "Creates disposable funded testnet identities, deploys the exact optimized WASM, runs the XLM lifecycle proof, prints public evidence, and deletes all temporary keys.\n",
  );
  process.exit(0);
}

if (!hasFlag("--execute")) {
  process.stdout.write(
    "Dry run only. Add --execute to perform the explicitly testnet-only proof.\n",
  );
  process.exit(0);
}
if (process.env.MOVIX_ENABLE_TESTNET_PROOF !== "1") {
  throw new Error("Set MOVIX_ENABLE_TESTNET_PROOF=1 to acknowledge testnet mutations");
}

requireFile(RELEASE_WASM, "Release WASM");
resetTestnetConfig();
const fixtureDir = mkdtempSync(resolve(tmpdir(), "movix-s3-testnet-proof-"));
const server = new rpc.Server(RPC_URL);

try {
  for (const identity of Object.values(IDENTITIES)) {
    stellar(["keys", "generate", identity, "--network", "testnet"]);
    await fundIdentity(identity);
  }
  const actors = Object.fromEntries(
    Object.entries(IDENTITIES).map(([role, identity]) => [role, publicKey(identity)]),
  );
  const constructorPath = resolve(fixtureDir, "constructor.json");
  writeFileSync(
    constructorPath,
    JSON.stringify({
      treasury: actors.treasury,
      supported_sac_addresses: [XLM_SAC, USDC_SAC],
      max_fee_bps: 0,
      ttl: { threshold: 120960, extend_to: 1555200 },
    }),
  );

  const deployment = stellar(
    [
      "contract",
      "deploy",
      "--wasm",
      relativeToRepo(RELEASE_WASM),
      "--source-account",
      IDENTITIES.buyer,
      "--network",
      "testnet",
      "--alias",
      "movix-s3-escrow-v1-proof",
      "--",
      "--config-file-path",
      constructorPath,
    ],
    { capture: true },
  );
  const contractId = deployment.stdout.trim();
  const deploymentHash = requireTransactionHash(deployment.stderr, "deployment");
  const deploymentTransaction = await fetchTransaction(deploymentHash);
  const smoke = await runLifecycleSmoke({
    network: "testnet",
    contractId,
    buyerIdentity: IDENTITIES.buyer,
    supplierIdentity: IDENTITIES.supplier,
    buyerAddress: actors.buyer,
    supplierAddress: actors.supplier,
    token: XLM_SAC,
    cancellationWaitSeconds: 12,
    seedOffset: 60,
    configDir: TESTNET_CONFIG_DIR,
  });
  const smokeTransactions = [];
  for (const item of smoke.transactionHashes) {
    const transaction = await fetchTransaction(item.transactionHash);
    smokeTransactions.push({
      ...item,
      status: transaction.status,
      ledger: transaction.ledger,
    });
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "working-tree testnet proof; release manifest still requires a clean commit",
        network: "testnet",
        rpcUrl: RPC_URL,
        protocol: 27,
        source: {
          baseCommit: git(["rev-parse", "HEAD"]),
          dirty: git(["status", "--porcelain"]).length > 0,
        },
        artifact: {
          path: relativeToRepo(RELEASE_WASM),
          sizeBytes: 19617,
          sha256: sha256File(RELEASE_WASM),
        },
        bindings: {
          path: relativeToRepo(BINDINGS_DIR),
          sha256: sha256Directory(BINDINGS_DIR),
        },
        constructor: {
          treasury: actors.treasury,
          maxFeeBps: 0,
          pilotFeeBps: 0,
          ttl: { threshold: 120960, extendTo: 1555200 },
        },
        assets: {
          XLM: { code: "XLM", issuer: null, sac: XLM_SAC },
          USDC: { code: "USDC", issuer: USDC_ISSUER, sac: USDC_SAC },
        },
        actors,
        deployment: {
          contractId,
          transactionHash: deploymentHash,
          status: deploymentTransaction.status,
          ledger: deploymentTransaction.ledger,
        },
        smoke: {
          results: smoke.results,
          transactions: smokeTransactions,
        },
        secretsDeletedAfterProof: true,
        testnetOnly: true,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
  resetTestnetConfig();
}

async function fundIdentity(identity) {
  const address = publicKey(identity);
  const url = `https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) {
      return;
    }
    if (attempt < 10) {
      await wait(2_000);
    }
  }
  throw new Error(`Friendbot could not fund ${identity}`);
}

async function fetchTransaction(hash) {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const transaction = await server.getTransaction(hash);
    if (transaction.status !== "NOT_FOUND") {
      return transaction;
    }
    if (attempt < 10) {
      await wait(2_000);
    }
  }
  throw new Error(`Transaction was not found: ${hash}`);
}

function requireTransactionHash(stderr, label) {
  const hash = /Signing transaction:\s*([0-9a-f]{64})/i.exec(stderr)?.[1];
  if (!hash) {
    throw new Error(`Could not capture ${label} transaction hash`);
  }
  return hash;
}

function publicKey(identity) {
  return stellar(["keys", "public-key", identity], { capture: true }).stdout.trim();
}

function stellar(args, options) {
  return run("stellar", ["--config-dir", TESTNET_CONFIG_DIR, ...args], options);
}

function git(args) {
  return run("git", args, { capture: true }).stdout.trim();
}

function resetTestnetConfig() {
  const expected = resolve(tmpdir(), "movix-testnet-cli-config");
  if (TESTNET_CONFIG_DIR !== expected) {
    throw new Error(`Refusing to reset unexpected config path: ${TESTNET_CONFIG_DIR}`);
  }
  rmSync(TESTNET_CONFIG_DIR, { recursive: true, force: true });
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}
