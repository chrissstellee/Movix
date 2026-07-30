import { describe, expect, it } from "vitest";
import { validateDeploymentManifest } from "./deployment-manifest.js";
import {
  deriveEscrowKey,
  encodeEscrowFundingArguments,
  fundingDeadlineSeconds,
  hexToBytes32,
} from "./escrow-funding.js";

describe("escrow-funding", () => {
  const sampleContractId = "CCEECHOGV6MXZANAOLJNDMA2GPEBDETPNWUR4XDEW32KHJUYN3V5ZAP5";
  const sampleBuyer = "GBNGA4F7BGTSYHIJEJFD2RKPFZNVVGB7ALLQZHAIZRKHSSXXVABDREQU";
  const sampleSupplier = "GAHH6R256G74JWW32NFRYAYED7V2QJ4VQL7EAK42YJNXD423J4K3J2X3";
  const sampleToken = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
  const sampleTermsHash = "a6c938a6148a7fd0cc768eee25088ef66822243c05e71516e1400d9bc18bd498";

  it("derives deterministic escrow key consistently", () => {
    const key1 = deriveEscrowKey({
      verifiedContractId: sampleContractId,
      orderId: "order_123",
      acceptedRevisionId: "rev_456",
    });

    const key2 = deriveEscrowKey({
      verifiedContractId: sampleContractId,
      orderId: "order_123",
      acceptedRevisionId: "rev_456",
    });

    expect(key1.keyHex).toBe(key2.keyHex);
    expect(key1.keyHex.length).toBe(64);
    expect(key1.keyBytes.length).toBe(32);

    // Different revision produces different key
    const key3 = deriveEscrowKey({
      verifiedContractId: sampleContractId,
      orderId: "order_123",
      acceptedRevisionId: "rev_457",
    });
    expect(key3.keyHex).not.toBe(key1.keyHex);
  });

  it("converts 64-char hex terms hash to 32 bytes", () => {
    const bytes = hexToBytes32(sampleTermsHash);
    expect(bytes.length).toBe(32);
    expect(Buffer.from(bytes).toString("hex")).toBe(sampleTermsHash);
  });

  it("converts deadline ms to whole seconds", () => {
    const ms = 1750000000000;
    const sec = fundingDeadlineSeconds(ms);
    expect(sec).toBe(1750000000n);
  });

  it("encodes valid funding arguments correctly", () => {
    const futureMs = Date.now() + 86400000;
    const args = encodeEscrowFundingArguments({
      verifiedContractId: sampleContractId,
      orderId: "ord_1",
      acceptedRevisionId: "rev_1",
      buyerWalletAddress: sampleBuyer,
      supplierWalletAddress: sampleSupplier,
      tokenContractId: sampleToken,
      grandTotalBaseUnits: 5000000000n,
      fundingDeadlineMs: futureMs,
      termsHashHex: sampleTermsHash,
    });

    expect(args.fee_bps).toBe(0);
    expect(args.amount).toBe(5000000000n);
    expect(args.buyer).toBe(sampleBuyer);
    expect(args.supplier).toBe(sampleSupplier);
    expect(args.token).toBe(sampleToken);
    expect(args.id.length).toBe(32);
    expect(args.terms_hash.length).toBe(32);
  });

  it("validates deployment manifest correctly", () => {
    const validManifest = {
      schemaVersion: 1,
      contractVersion: 1,
      escrowSchemaVersion: 1,
      network: "testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
      rpcEnvironment: "SDF public testnet RPC",
      source: { commit: "abc" },
      toolchain: { rust: "1.97", sorobanSdk: "27.0", stellarCli: "27.0", stellarXdr: "27.0", protocol: 27 },
      artifact: { path: "wasm", sizeBytes: 100, sha256: "abc", optimized: true },
      bindings: { path: "bindings", command: "cmd", sha256: "def" },
      deployment: { contractId: sampleContractId, transactionHash: "tx", ledger: 100 },
      constructor: { treasury: sampleBuyer, maxFeeBps: 0, pilotFeeBps: 0, ttl: { threshold: 1, extendTo: 2, networkLimitReference: "ref" } },
      assets: {
        XLM: { code: "XLM", issuer: null, sac: sampleToken },
        USDC: { code: "USDC", issuer: sampleBuyer, sac: sampleToken },
      },
      evidenceIndex: "docs",
      deployedAt: "2026-07-28",
      testnetOnly: true,
    };

    const validated = validateDeploymentManifest(validManifest);
    expect(validated.deployment.contractId).toBe(sampleContractId);
  });
});
