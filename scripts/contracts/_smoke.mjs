import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { run } from "./_shared.mjs";

let activeTransactionSink;

export async function runLifecycleSmoke({
  network,
  contractId,
  buyerIdentity,
  supplierIdentity,
  buyerAddress,
  supplierAddress,
  token,
  cancellationWaitSeconds,
  seedOffset = 0,
  configDir,
}) {
  const fixtureDir = mkdtempSync(resolve(tmpdir(), "movix-s3-smoke-"));
  const transactionHashes = [];
  const previousTransactionSink = activeTransactionSink;
  activeTransactionSink = transactionHashes;
  try {
    const fixtures = createCommitments(fixtureDir, seedOffset);
    const baseDeadline = Math.floor(Date.now() / 1000) + 300;

    const releaseId = fixtures.idRelease;
    invoke(
      network,
      contractId,
      buyerIdentity,
      "create_and_fund",
      [
        "--id-file-path",
        releaseId,
        "--buyer",
        buyerAddress,
        "--supplier",
        supplierAddress,
        "--token",
        token,
        "--amount",
        "10000000",
        "--fee-bps",
        "0",
        "--accept-by",
        String(baseDeadline),
        "--terms-hash-file-path",
        fixtures.terms,
      ],
      configDir,
    );
    invoke(
      network,
      contractId,
      supplierIdentity,
      "accept",
      [
        "--id-file-path",
        releaseId,
        "--supplier",
        supplierAddress,
        "--terms-hash-file-path",
        fixtures.terms,
      ],
      configDir,
    );
    invoke(
      network,
      contractId,
      supplierIdentity,
      "mark_shipped",
      [
        "--id-file-path",
        releaseId,
        "--supplier",
        supplierAddress,
        "--shipment-hash-file-path",
        fixtures.shipment,
      ],
      configDir,
    );
    invoke(
      network,
      contractId,
      buyerIdentity,
      "confirm_delivery",
      [
        "--id-file-path",
        releaseId,
        "--buyer",
        buyerAddress,
        "--delivery-hash-file-path",
        fixtures.delivery,
      ],
      configDir,
    );
    expectInvokeFailure(
      network,
      contractId,
      buyerIdentity,
      "confirm_delivery",
      [
        "--id-file-path",
        releaseId,
        "--buyer",
        buyerAddress,
        "--delivery-hash-file-path",
        fixtures.delivery,
      ],
      configDir,
    );

    const refundId = fixtures.idRefund;
    invoke(
      network,
      contractId,
      buyerIdentity,
      "create_and_fund",
      [
        "--id-file-path",
        refundId,
        "--buyer",
        buyerAddress,
        "--supplier",
        supplierAddress,
        "--token",
        token,
        "--amount",
        "20000000",
        "--fee-bps",
        "0",
        "--accept-by",
        String(baseDeadline),
        "--terms-hash-file-path",
        fixtures.terms,
      ],
      configDir,
    );
    invoke(
      network,
      contractId,
      buyerIdentity,
      "propose_refund",
      [
        "--id-file-path",
        refundId,
        "--proposer",
        buyerAddress,
        "--refund-terms-hash-file-path",
        fixtures.refund,
      ],
      configDir,
    );
    invoke(
      network,
      contractId,
      supplierIdentity,
      "approve_refund",
      [
        "--id-file-path",
        refundId,
        "--approver",
        supplierAddress,
        "--refund-terms-hash-file-path",
        fixtures.refund,
      ],
      configDir,
    );
    expectInvokeFailure(
      network,
      contractId,
      supplierIdentity,
      "approve_refund",
      [
        "--id-file-path",
        refundId,
        "--approver",
        supplierAddress,
        "--refund-terms-hash-file-path",
        fixtures.refund,
      ],
      configDir,
    );

    const cancellationId = fixtures.idCancellation;
    const cancellationDeadline = Math.floor(Date.now() / 1000) + cancellationWaitSeconds;
    invoke(
      network,
      contractId,
      buyerIdentity,
      "create_and_fund",
      [
        "--id-file-path",
        cancellationId,
        "--buyer",
        buyerAddress,
        "--supplier",
        supplierAddress,
        "--token",
        token,
        "--amount",
        "30000000",
        "--fee-bps",
        "0",
        "--accept-by",
        String(cancellationDeadline),
        "--terms-hash-file-path",
        fixtures.terms,
      ],
      configDir,
    );
    await wait((cancellationWaitSeconds + 2) * 1000);
    await invokeWithRetry(
      () =>
        invoke(
          network,
          contractId,
          buyerIdentity,
          "cancel_unaccepted",
          ["--id-file-path", cancellationId, "--buyer", buyerAddress],
          configDir,
        ),
      10,
      2_000,
    );
    expectInvokeFailure(
      network,
      contractId,
      buyerIdentity,
      "cancel_unaccepted",
      ["--id-file-path", cancellationId, "--buyer", buyerAddress],
      configDir,
    );

    const results = {
      release: parseOutput(readEscrow(network, contractId, buyerIdentity, releaseId, configDir)),
      refund: parseOutput(readEscrow(network, contractId, buyerIdentity, refundId, configDir)),
      cancellation: parseOutput(
        readEscrow(network, contractId, buyerIdentity, cancellationId, configDir),
      ),
      liability: parseOutput(
        invoke(network, contractId, buyerIdentity, "get_liability", ["--token", token], configDir),
      ),
    };
    assertStatus(results.release, "Released");
    assertStatus(results.refund, "Refunded");
    assertStatus(results.cancellation, "Cancelled");
    if (BigInt(results.liability) !== 0n) {
      throw new Error(`Expected zero ${token} liability, received ${String(results.liability)}`);
    }

    process.stdout.write(
      `${JSON.stringify({ network, contractId, token, results, transactionHashes }, null, 2)}\n`,
    );
    return { results, transactionHashes };
  } finally {
    activeTransactionSink = previousTransactionSink;
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

function expectInvokeFailure(network, contractId, sourceAccount, fnName, args, configDir) {
  try {
    invoke(network, contractId, sourceAccount, fnName, args, configDir);
  } catch {
    return;
  }
  throw new Error(`Expected terminal replay of ${fnName} to fail`);
}

function parseOutput(output) {
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
}

function assertStatus(escrow, expected) {
  const value = escrow?.status;
  const actual =
    typeof value === "string" ? value : typeof value?.tag === "string" ? value.tag : undefined;
  if (actual !== expected) {
    throw new Error(`Expected escrow status ${expected}, received ${JSON.stringify(value)}`);
  }
}

function invoke(network, contractId, sourceAccount, fnName, args, configDir) {
  const result = run(
    "stellar",
    [
      ...(configDir ? ["--config-dir", configDir] : []),
      "contract",
      "invoke",
      "--id",
      contractId,
      "--source-account",
      sourceAccount,
      "--network",
      network,
      "--",
      fnName,
      ...args,
    ],
    { capture: true },
  );
  const transactionHash = /Signing transaction:\s*([0-9a-f]{64})/i.exec(result.stderr)?.[1];
  if (transactionHash && activeTransactionSink) {
    activeTransactionSink.push({ function: fnName, transactionHash });
  }
  return result.stdout.trim();
}

function readEscrow(network, contractId, sourceAccount, idPath, configDir) {
  return invoke(
    network,
    contractId,
    sourceAccount,
    "get_escrow",
    ["--id-file-path", idPath],
    configDir,
  );
}

function createCommitments(directory, seedOffset) {
  return Object.fromEntries(
    [
      ["idRelease", 1],
      ["idRefund", 2],
      ["idCancellation", 3],
      ["terms", 11],
      ["shipment", 12],
      ["delivery", 13],
      ["refund", 14],
    ].map(([name, byte]) => {
      const path = resolve(directory, `${name}.bin`);
      writeFileSync(path, Buffer.alloc(32, byte + seedOffset));
      return [name, path];
    }),
  );
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function invokeWithRetry(operation, attempts, delayMilliseconds) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(delayMilliseconds);
      }
    }
  }
  throw lastError;
}
