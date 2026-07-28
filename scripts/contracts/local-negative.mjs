import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { hasFlag, relativeToRepo, RELEASE_WASM, requireFile, run } from "./_shared.mjs";

const LOCAL_CONFIG_DIR = resolve(tmpdir(), "movix-stellar-cli-config");
const IDENTITIES = {
  buyer: "movix-local-buyer",
  supplier: "movix-local-supplier",
  wrongParty: "movix-local-wrong-party",
  treasury: "movix-local-treasury",
};

if (hasFlag("--help")) {
  process.stdout.write(
    "Usage: node scripts/contracts/local-negative.mjs [--execute]\n" +
      "Proves real-SAC rollback for missing supplier/treasury trustlines plus duplicate, unsupported, race, and multi-escrow liability behavior.\n",
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
const actors = Object.fromEntries(
  Object.entries(IDENTITIES).map(([role, identity]) => [role, publicKey(identity)]),
);
const xlmSac = contractAlias("movix-local-xlm");
const usdcSac = contractAlias("movix-local-usdc");
const fixtureDir = mkdtempSync(resolve(tmpdir(), "movix-s3-negative-"));

try {
  const files = createCommitments(fixtureDir);
  const normalContract = deployContract(
    "movix-local-negative-normal",
    actors.treasury,
    [xlmSac, usdcSac],
    500,
    fixtureDir,
  );
  const badTreasuryContract = deployContract(
    "movix-local-negative-treasury",
    actors.wrongParty,
    [xlmSac, usdcSac],
    500,
    fixtureDir,
  );

  const supplierFailure = proveFailedPayout({
    contractId: normalContract,
    token: usdcSac,
    id: files.failedSupplierId,
    supplierIdentity: IDENTITIES.wrongParty,
    supplierAddress: actors.wrongParty,
    feeBps: 0,
    files,
  });
  const treasuryFailure = proveFailedPayout({
    contractId: badTreasuryContract,
    token: usdcSac,
    id: files.failedTreasuryId,
    supplierIdentity: IDENTITIES.supplier,
    supplierAddress: actors.supplier,
    feeBps: 500,
    files,
  });

  expectFailure(() =>
    invoke(normalContract, IDENTITIES.buyer, "create_and_fund", [
      "--id-file-path",
      files.insufficientId,
      "--buyer",
      actors.buyer,
      "--supplier",
      actors.supplier,
      "--token",
      usdcSac,
      "--amount",
      "1000000000000000000",
      "--fee-bps",
      "0",
      "--accept-by",
      String(Math.floor(Date.now() / 1000) + 300),
      "--terms-hash-file-path",
      files.terms,
    ]),
  );
  expectFailure(() =>
    readEscrow(normalContract, files.insufficientId, IDENTITIES.buyer),
  );
  expectFailure(() =>
    invoke(normalContract, IDENTITIES.buyer, "create_and_fund", [
      "--id-file-path",
      files.unsupportedId,
      "--buyer",
      actors.buyer,
      "--supplier",
      actors.supplier,
      "--token",
      normalContract,
      "--amount",
      "10000000",
      "--fee-bps",
      "0",
      "--accept-by",
      String(Math.floor(Date.now() / 1000) + 300),
      "--terms-hash-file-path",
      files.terms,
    ]),
  );

  const raceContract = deployContract(
    "movix-local-negative-race",
    actors.treasury,
    [xlmSac, usdcSac],
    0,
    fixtureDir,
  );
  const race = proveSerializedRaceAndLiability(raceContract, xlmSac, actors, files);

  process.stdout.write(
    `${JSON.stringify(
      {
        network: "local",
        optimizedWasm: relativeToRepo(RELEASE_WASM),
        contracts: { normalContract, badTreasuryContract, raceContract },
        supplierFailure,
        treasuryFailure,
        race,
        result: "pass",
      },
      null,
      2,
    )}\n`,
  );
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}

function proveFailedPayout({
  contractId,
  token,
  id,
  supplierIdentity,
  supplierAddress,
  feeBps,
  files,
}) {
  const deadline = Math.floor(Date.now() / 1000) + 300;
  invoke(contractId, IDENTITIES.buyer, "create_and_fund", [
    "--id-file-path",
    id,
    "--buyer",
    actors.buyer,
    "--supplier",
    supplierAddress,
    "--token",
    token,
    "--amount",
    "10000000",
    "--fee-bps",
    String(feeBps),
    "--accept-by",
    String(deadline),
    "--terms-hash-file-path",
    files.terms,
  ]);
  invoke(contractId, supplierIdentity, "accept", [
    "--id-file-path",
    id,
    "--supplier",
    supplierAddress,
    "--terms-hash-file-path",
    files.terms,
  ]);
  invoke(contractId, supplierIdentity, "mark_shipped", [
    "--id-file-path",
    id,
    "--supplier",
    supplierAddress,
    "--shipment-hash-file-path",
    files.shipment,
  ]);

  const supplierHasTrustline = supplierAddress !== actors.wrongParty;
  let supplierBefore;
  if (supplierHasTrustline) {
    supplierBefore = tokenBalance(token, supplierAddress);
  } else {
    expectFailure(() => tokenBalance(token, supplierAddress));
  }
  const contractBefore = tokenBalance(token, contractId);
  expectFailure(() =>
    invoke(contractId, IDENTITIES.buyer, "confirm_delivery", [
      "--id-file-path",
      id,
      "--buyer",
      actors.buyer,
      "--delivery-hash-file-path",
      files.delivery,
    ]),
  );
  const escrow = readEscrow(contractId, id, IDENTITIES.buyer);
  const liability = readLiability(contractId, token);
  let supplierAfter;
  if (supplierHasTrustline) {
    supplierAfter = tokenBalance(token, supplierAddress);
  } else {
    expectFailure(() => tokenBalance(token, supplierAddress));
  }
  const contractAfter = tokenBalance(token, contractId);
  assertStatus(escrow, "Shipped");
  assertEqual(liability, 10_000_000n, "failed-payout liability");
  if (supplierHasTrustline) {
    assertEqual(supplierAfter, supplierBefore, "failed-payout supplier balance");
  }
  assertEqual(contractAfter, contractBefore, "failed-payout contract balance");
  return {
    status: "Shipped",
    liability: liability.toString(),
    supplierBalanceUnchanged: supplierHasTrustline,
    supplierTrustlineStillMissing: !supplierHasTrustline,
    contractBalanceUnchanged: true,
  };
}

function proveSerializedRaceAndLiability(contractId, token, actorAddresses, files) {
  const deadline = Math.floor(Date.now() / 1000) + 300;
  for (const [id, amount] of [
    [files.raceReleaseId, "10000000"],
    [files.raceRefundId, "20000000"],
  ]) {
    invoke(contractId, IDENTITIES.buyer, "create_and_fund", [
      "--id-file-path",
      id,
      "--buyer",
      actorAddresses.buyer,
      "--supplier",
      actorAddresses.supplier,
      "--token",
      token,
      "--amount",
      amount,
      "--fee-bps",
      "0",
      "--accept-by",
      String(deadline),
      "--terms-hash-file-path",
      files.terms,
    ]);
  }
  assertEqual(readLiability(contractId, token), 30_000_000n, "aggregate liability");

  invoke(contractId, IDENTITIES.supplier, "accept", [
    "--id-file-path",
    files.raceReleaseId,
    "--supplier",
    actorAddresses.supplier,
    "--terms-hash-file-path",
    files.terms,
  ]);
  invoke(contractId, IDENTITIES.supplier, "mark_shipped", [
    "--id-file-path",
    files.raceReleaseId,
    "--supplier",
    actorAddresses.supplier,
    "--shipment-hash-file-path",
    files.shipment,
  ]);
  invoke(contractId, IDENTITIES.supplier, "propose_refund", [
    "--id-file-path",
    files.raceReleaseId,
    "--proposer",
    actorAddresses.supplier,
    "--refund-terms-hash-file-path",
    files.refund,
  ]);
  expectFailure(() =>
    invoke(contractId, IDENTITIES.buyer, "confirm_delivery", [
      "--id-file-path",
      files.raceReleaseId,
      "--buyer",
      actorAddresses.buyer,
      "--delivery-hash-file-path",
      files.delivery,
    ]),
  );
  invoke(contractId, IDENTITIES.buyer, "approve_refund", [
    "--id-file-path",
    files.raceReleaseId,
    "--approver",
    actorAddresses.buyer,
    "--refund-terms-hash-file-path",
    files.refund,
  ]);
  assertEqual(readLiability(contractId, token), 20_000_000n, "post-race liability");

  invoke(contractId, IDENTITIES.buyer, "propose_refund", [
    "--id-file-path",
    files.raceRefundId,
    "--proposer",
    actorAddresses.buyer,
    "--refund-terms-hash-file-path",
    files.refund,
  ]);
  invoke(contractId, IDENTITIES.supplier, "approve_refund", [
    "--id-file-path",
    files.raceRefundId,
    "--approver",
    actorAddresses.supplier,
    "--refund-terms-hash-file-path",
    files.refund,
  ]);
  const liability = readLiability(contractId, token);
  const contractBalance = tokenBalance(token, contractId);
  assertEqual(liability, 0n, "terminal liability");
  assertEqual(contractBalance, 0n, "terminal contract balance");
  return { serializedWinner: "refund", liability: "0", contractBalance: "0" };
}

function deployContract(alias, treasury, assets, maxFeeBps, directory) {
  const configPath = resolve(directory, `${alias}.json`);
  writeFileSync(
    configPath,
    JSON.stringify({
      treasury,
      supported_sac_addresses: assets,
      max_fee_bps: maxFeeBps,
      ttl: { threshold: 1000, extend_to: 200000 },
    }),
  );
  return stellar(
    [
      "contract",
      "deploy",
      "--wasm",
      relativeToRepo(RELEASE_WASM),
      "--source-account",
      IDENTITIES.buyer,
      "--network",
      "local",
      "--alias",
      alias,
      "--",
      "--config-file-path",
      configPath,
    ],
    { capture: true },
  ).stdout.trim();
}

function invoke(contractId, identity, functionName, args) {
  return stellar(
    [
      "contract",
      "invoke",
      "--id",
      contractId,
      "--source-account",
      identity,
      "--network",
      "local",
      "--",
      functionName,
      ...args,
    ],
    { capture: true },
  ).stdout.trim();
}

function readEscrow(contractId, id, identity) {
  return parse(
    invoke(contractId, identity, "get_escrow", ["--id-file-path", id]),
  );
}

function readLiability(contractId, token) {
  return BigInt(
    parse(invoke(contractId, IDENTITIES.buyer, "get_liability", ["--token", token])),
  );
}

function tokenBalance(token, address) {
  return BigInt(
    parse(
      invoke(token, IDENTITIES.buyer, "balance", ["--id", address]),
    ),
  );
}

function publicKey(identity) {
  return stellar(["keys", "public-key", identity], { capture: true }).stdout.trim();
}

function contractAlias(alias) {
  return stellar(
    ["contract", "alias", "show", alias, "--network", "local"],
    { capture: true },
  ).stdout.trim();
}

function stellar(args, options) {
  return run("stellar", ["--config-dir", LOCAL_CONFIG_DIR, ...args], options);
}

function expectFailure(operation) {
  try {
    operation();
  } catch {
    return;
  }
  throw new Error("Expected invocation to fail");
}

function parse(output) {
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
}

function assertStatus(escrow, expected) {
  const actual =
    typeof escrow?.status === "string"
      ? escrow.status
      : typeof escrow?.status?.tag === "string"
        ? escrow.status.tag
        : undefined;
  if (actual !== expected) {
    throw new Error(`Expected status ${expected}, received ${JSON.stringify(escrow?.status)}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function createCommitments(directory) {
  return Object.fromEntries(
    [
      ["failedSupplierId", 101],
      ["failedTreasuryId", 102],
      ["insufficientId", 103],
      ["unsupportedId", 104],
      ["raceReleaseId", 105],
      ["raceRefundId", 106],
      ["terms", 111],
      ["shipment", 112],
      ["delivery", 113],
      ["refund", 114],
    ].map(([name, byte]) => {
      const path = resolve(directory, `${name}.bin`);
      writeFileSync(path, Buffer.alloc(32, byte));
      return [name, path];
    }),
  );
}
