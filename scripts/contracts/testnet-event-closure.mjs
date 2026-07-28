import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { hasFlag, run } from "./_shared.mjs";

const CONTRACT_ID =
  process.env.MOVIX_ESCROW_CONTRACT_ID ??
  "CCEECHOGV6MXZANAOLJNDMA2GPEBDETPNWUR4XDEW32KHJUYN3V5ZAP5";
const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const CONFIG_DIR = mkdtempSync(resolve(tmpdir(), "movix-s3-event-closure-config-"));
const FIXTURE_DIR = mkdtempSync(resolve(tmpdir(), "movix-s3-event-closure-fixture-"));
const IDENTITIES = {
  buyer: "movix-s3-event-buyer",
  supplier: "movix-s3-event-supplier",
};

if (hasFlag("--help")) {
  process.stdout.write(
    "Usage: node scripts/contracts/testnet-event-closure.mjs [--execute]\n" +
      "Completes refund rejection and withdrawal against the verified Sprint 3 testnet contract, then refunds the escrow and deletes disposable keys.\n",
  );
  cleanup();
  process.exit(0);
}

if (!hasFlag("--execute")) {
  process.stdout.write("Dry run only. Add --execute with MOVIX_ENABLE_TESTNET_EVENT_CLOSURE=1.\n");
  cleanup();
  process.exit(0);
}
if (process.env.MOVIX_ENABLE_TESTNET_EVENT_CLOSURE !== "1") {
  cleanup();
  throw new Error(
    "Set MOVIX_ENABLE_TESTNET_EVENT_CLOSURE=1 to acknowledge public testnet mutations",
  );
}

const transactions = [];
let reconciled = false;
try {
  for (const identity of Object.values(IDENTITIES)) {
    stellar(["keys", "generate", identity, "--network", "testnet"]);
    await fundIdentity(identity);
  }
  const buyer = publicKey(IDENTITIES.buyer);
  const supplier = publicKey(IDENTITIES.supplier);
  const id = fixture("id", 0x70);
  const terms = fixture("terms", 0x71);
  const rejectedTerms = fixture("refund-rejected", 0x72);
  const withdrawnTerms = fixture("refund-withdrawn", 0x73);
  const approvedTerms = fixture("refund-approved", 0x74);
  const acceptBy = Math.floor(Date.now() / 1000) + 300;

  invoke(IDENTITIES.buyer, "create_and_fund", [
    "--id-file-path",
    id,
    "--buyer",
    buyer,
    "--supplier",
    supplier,
    "--token",
    XLM_SAC,
    "--amount",
    "10000000",
    "--fee-bps",
    "0",
    "--accept-by",
    String(acceptBy),
    "--terms-hash-file-path",
    terms,
  ]);
  invoke(IDENTITIES.buyer, "propose_refund", [
    "--id-file-path",
    id,
    "--proposer",
    buyer,
    "--refund-terms-hash-file-path",
    rejectedTerms,
  ]);
  invoke(IDENTITIES.supplier, "reject_refund", [
    "--id-file-path",
    id,
    "--approver",
    supplier,
    "--refund-terms-hash-file-path",
    rejectedTerms,
  ]);
  invoke(IDENTITIES.buyer, "propose_refund", [
    "--id-file-path",
    id,
    "--proposer",
    buyer,
    "--refund-terms-hash-file-path",
    withdrawnTerms,
  ]);
  invoke(IDENTITIES.buyer, "withdraw_refund", [
    "--id-file-path",
    id,
    "--proposer",
    buyer,
    "--refund-terms-hash-file-path",
    withdrawnTerms,
  ]);
  invoke(IDENTITIES.buyer, "propose_refund", [
    "--id-file-path",
    id,
    "--proposer",
    buyer,
    "--refund-terms-hash-file-path",
    approvedTerms,
  ]);
  invoke(IDENTITIES.supplier, "approve_refund", [
    "--id-file-path",
    id,
    "--approver",
    supplier,
    "--refund-terms-hash-file-path",
    approvedTerms,
  ]);

  const escrow = parse(invoke(IDENTITIES.buyer, "get_escrow", ["--id-file-path", id], false));
  const liability = parse(invoke(IDENTITIES.buyer, "get_liability", ["--token", XLM_SAC], false));
  if (statusOf(escrow) !== "Refunded" || BigInt(liability) !== 0n) {
    throw new Error(
      `Event closure failed terminal reconciliation: ${JSON.stringify({ escrow, liability })}`,
    );
  }
  reconciled = true;

  process.stdout.write(
    `${JSON.stringify(
      {
        network: "testnet",
        contractId: CONTRACT_ID,
        buyer,
        supplier,
        finalStatus: "Refunded",
        finalXlmLiability: "0",
        transactions,
        disposableKeysDeleted: true,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
  if (reconciled) {
    rmSync(CONFIG_DIR, { recursive: true, force: true });
  } else {
    process.stderr.write(
      `Event closure did not reconcile. Disposable recovery keys were preserved at ${CONFIG_DIR}.\n`,
    );
  }
}

function invoke(source, fnName, args, record = true) {
  const result = stellar([
    "contract",
    "invoke",
    "--id",
    CONTRACT_ID,
    "--source-account",
    source,
    "--network",
    "testnet",
    "--",
    fnName,
    ...args,
  ]);
  const transactionHash = /Signing transaction:\s*([0-9a-f]{64})/i.exec(result.stderr)?.[1];
  if (record && transactionHash) {
    transactions.push({ function: fnName, transactionHash });
  }
  return result.stdout.trim();
}

function stellar(args) {
  return run("stellar", ["--config-dir", CONFIG_DIR, ...args], { capture: true });
}

function publicKey(identity) {
  return stellar(["keys", "public-key", identity]).stdout.trim();
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
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
    }
  }
  throw new Error(`Friendbot could not fund ${identity}`);
}

function fixture(name, byte) {
  const path = resolve(FIXTURE_DIR, `${name}.bin`);
  writeFileSync(path, Buffer.alloc(32, byte));
  return path;
}

function parse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function statusOf(escrow) {
  return typeof escrow?.status === "string" ? escrow.status : escrow?.status?.tag;
}

function cleanup() {
  rmSync(CONFIG_DIR, { recursive: true, force: true });
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
}
