import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  Address,
  Contract,
  nativeToScVal,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

import { hasFlag, relativeToRepo, RELEASE_WASM, requireFile, run } from "./_shared.mjs";

const LOCAL_CONFIG_DIR = resolve(tmpdir(), "movix-stellar-cli-config");
const RPC_URL = "http://localhost:8000/soroban/rpc";
const NETWORK_PASSPHRASE = "Standalone Network ; February 2017";
const IDENTITIES = {
  buyer: "movix-local-buyer",
  supplier: "movix-local-supplier",
  treasury: "movix-local-treasury",
};
const NORMAL_LIMITS = {
  instructions: 100_000_000,
  readEntries: 50,
  writeEntries: 50,
  diskReadBytes: 50_000,
  writeBytes: 33_024,
};
const TERMINAL_LIMITS = {
  instructions: 140_000_000,
  readEntries: 70,
  writeEntries: 70,
  diskReadBytes: 70_000,
  writeBytes: 46_234,
};

if (hasFlag("--help")) {
  process.stdout.write(
    "Usage: node scripts/contracts/resource-profile.mjs [--execute]\n" +
      "Profiles every escrow v1 entry point against the local testnet-limit RPC using the exact optimized WASM.\n",
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
const server = new rpc.Server(RPC_URL, { allowHttp: true });
const actors = Object.fromEntries(
  Object.entries(IDENTITIES).map(([role, identity]) => [role, publicKey(identity)]),
);
const xlmSac = contractAlias("movix-local-xlm");
const usdcSac = contractAlias("movix-local-usdc");
const fixtureDir = mkdtempSync(resolve(tmpdir(), "movix-s3-resources-"));

try {
  const files = createCommitments(fixtureDir);
  const contractId = deployContract(
    "movix-local-resource-profile",
    actors.treasury,
    [xlmSac, usdcSac],
    500,
    fixtureDir,
  );
  const contract = new Contract(contractId);
  const measurements = [];
  const deadline = Math.floor(Date.now() / 1000) + 300;

  await measure(measurements, contract, "get_version", [], actors.buyer);
  await measure(measurements, contract, "get_config", [], actors.buyer);
  await measure(
    measurements,
    contract,
    "get_liability",
    [address(xlmSac)],
    actors.buyer,
  );
  await measure(
    measurements,
    contract,
    "create_and_fund",
    fundingArgs(files.releaseId, actors.supplier, xlmSac, 10_001_000n, 125, deadline, files.terms),
    actors.buyer,
  );
  submit(contractId, IDENTITIES.buyer, "create_and_fund", [
    "--id-file-path",
    files.releaseId,
    "--buyer",
    actors.buyer,
    "--supplier",
    actors.supplier,
    "--token",
    xlmSac,
    "--amount",
    "10001000",
    "--fee-bps",
    "125",
    "--accept-by",
    String(deadline),
    "--terms-hash-file-path",
    files.terms,
  ]);
  await measure(
    measurements,
    contract,
    "get_escrow",
    [bytes32(1)],
    actors.buyer,
  );
  await measure(
    measurements,
    contract,
    "accept",
    [bytes32(1), address(actors.supplier), bytes32(11)],
    actors.supplier,
  );
  submit(contractId, IDENTITIES.supplier, "accept", [
    "--id-file-path",
    files.releaseId,
    "--supplier",
    actors.supplier,
    "--terms-hash-file-path",
    files.terms,
  ]);
  await measure(
    measurements,
    contract,
    "mark_shipped",
    [bytes32(1), address(actors.supplier), bytes32(12)],
    actors.supplier,
  );
  submit(contractId, IDENTITIES.supplier, "mark_shipped", [
    "--id-file-path",
    files.releaseId,
    "--supplier",
    actors.supplier,
    "--shipment-hash-file-path",
    files.shipment,
  ]);
  await measure(
    measurements,
    contract,
    "confirm_delivery",
    [bytes32(1), address(actors.buyer), bytes32(13)],
    actors.buyer,
    true,
  );
  submit(contractId, IDENTITIES.buyer, "confirm_delivery", [
    "--id-file-path",
    files.releaseId,
    "--buyer",
    actors.buyer,
    "--delivery-hash-file-path",
    files.delivery,
  ]);

  submitFunding(contractId, files.refundId, actors.supplier, xlmSac, deadline, files.terms);
  await measure(
    measurements,
    contract,
    "propose_refund",
    [bytes32(2), address(actors.buyer), bytes32(14)],
    actors.buyer,
  );
  submit(contractId, IDENTITIES.buyer, "propose_refund", [
    "--id-file-path",
    files.refundId,
    "--proposer",
    actors.buyer,
    "--refund-terms-hash-file-path",
    files.refund,
  ]);
  await measure(
    measurements,
    contract,
    "reject_refund",
    [bytes32(2), address(actors.supplier), bytes32(14)],
    actors.supplier,
  );
  submit(contractId, IDENTITIES.supplier, "reject_refund", [
    "--id-file-path",
    files.refundId,
    "--approver",
    actors.supplier,
    "--refund-terms-hash-file-path",
    files.refund,
  ]);

  submit(contractId, IDENTITIES.buyer, "propose_refund", [
    "--id-file-path",
    files.refundId,
    "--proposer",
    actors.buyer,
    "--refund-terms-hash-file-path",
    files.refund,
  ]);
  await measure(
    measurements,
    contract,
    "withdraw_refund",
    [bytes32(2), address(actors.buyer), bytes32(14)],
    actors.buyer,
  );
  submit(contractId, IDENTITIES.buyer, "withdraw_refund", [
    "--id-file-path",
    files.refundId,
    "--proposer",
    actors.buyer,
    "--refund-terms-hash-file-path",
    files.refund,
  ]);

  submit(contractId, IDENTITIES.buyer, "propose_refund", [
    "--id-file-path",
    files.refundId,
    "--proposer",
    actors.buyer,
    "--refund-terms-hash-file-path",
    files.refund,
  ]);
  await measure(
    measurements,
    contract,
    "approve_refund",
    [bytes32(2), address(actors.supplier), bytes32(14)],
    actors.supplier,
    true,
  );
  submit(contractId, IDENTITIES.supplier, "approve_refund", [
    "--id-file-path",
    files.refundId,
    "--approver",
    actors.supplier,
    "--refund-terms-hash-file-path",
    files.refund,
  ]);

  const cancellationDeadline = Math.floor(Date.now() / 1000) + 5;
  submitFunding(
    contractId,
    files.cancellationId,
    actors.supplier,
    xlmSac,
    cancellationDeadline,
    files.terms,
  );
  await wait(8_000);
  await measureWithRetry(
    measurements,
    contract,
    "cancel_unaccepted",
    [bytes32(3), address(actors.buyer)],
    actors.buyer,
    true,
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        network: "local",
        limitsProfile: "testnet",
        optimizedWasm: relativeToRepo(RELEASE_WASM),
        contractId,
        measurements,
        result: "pass",
      },
      null,
      2,
    )}\n`,
  );
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}

async function measure(
  measurements,
  contract,
  functionName,
  args,
  sourceAddress,
  terminal = false,
) {
  const account = await server.getAccount(sourceAddress);
  const transaction = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(30)
    .build();
  const simulation = await server.simulateTransaction(transaction);
  if (!rpc.Api.isSimulationSuccess(simulation)) {
    throw new Error(
      `Simulation failed for ${functionName}: ${JSON.stringify(simulation, jsonBigInt)}`,
    );
  }

  const resources = simulation.transactionData.build().resources();
  const footprint = resources.footprint();
  const measurement = {
    function: functionName,
    instructions: Number(resources.instructions()),
    readEntries: footprint.readOnly().length + footprint.readWrite().length,
    writeEntries: footprint.readWrite().length,
    diskReadBytes: resources.diskReadBytes(),
    writeBytes: resources.writeBytes(),
    minResourceFee: simulation.minResourceFee,
    budgetClass: terminal ? "terminal" : "normal",
  };
  enforce(measurement, terminal ? TERMINAL_LIMITS : NORMAL_LIMITS);
  measurements.push(measurement);
  return measurement;
}

async function measureWithRetry(measurements, contract, functionName, args, sourceAddress, terminal) {
  let lastError;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      return await measure(
        measurements,
        contract,
        functionName,
        args,
        sourceAddress,
        terminal,
      );
    } catch (error) {
      lastError = error;
      if (attempt < 10) {
        await wait(2_000);
      }
    }
  }
  throw lastError;
}

function enforce(measurement, limits) {
  for (const [field, limit] of Object.entries(limits)) {
    if (measurement[field] > limit) {
      throw new Error(
        `${measurement.function} exceeds ${field}: ${measurement[field]} > ${limit}`,
      );
    }
  }
}

function submitFunding(contractId, id, supplier, token, deadline, terms) {
  submit(contractId, IDENTITIES.buyer, "create_and_fund", [
    "--id-file-path",
    id,
    "--buyer",
    actors.buyer,
    "--supplier",
    supplier,
    "--token",
    token,
    "--amount",
    "10000000",
    "--fee-bps",
    "0",
    "--accept-by",
    String(deadline),
    "--terms-hash-file-path",
    terms,
  ]);
}

function fundingArgs(id, supplier, token, amount, feeBps, deadline, terms) {
  return [
    bytes32FromFileName(id),
    address(actors.buyer),
    address(supplier),
    address(token),
    nativeToScVal(amount, { type: "i128" }),
    nativeToScVal(feeBps, { type: "u32" }),
    nativeToScVal(BigInt(deadline), { type: "u64" }),
    bytes32FromFileName(terms),
  ];
}

function submit(contractId, identity, functionName, args) {
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

function address(value) {
  return Address.fromString(value).toScVal();
}

function bytes32(byte) {
  return xdr.ScVal.scvBytes(Buffer.alloc(32, byte));
}

function bytes32FromFileName(path) {
  const match = /([a-zA-Z]+)\.bin$/.exec(path);
  const values = {
    releaseId: 1,
    refundId: 2,
    cancellationId: 3,
    terms: 11,
  };
  return bytes32(values[match?.[1]]);
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

function createCommitments(directory) {
  return Object.fromEntries(
    [
      ["releaseId", 1],
      ["refundId", 2],
      ["cancellationId", 3],
      ["terms", 11],
      ["shipment", 12],
      ["delivery", 13],
      ["refund", 14],
    ].map(([name, byte]) => {
      const path = resolve(directory, `${name}.bin`);
      writeFileSync(path, Buffer.alloc(32, byte));
      return [name, path];
    }),
  );
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function jsonBigInt(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}
