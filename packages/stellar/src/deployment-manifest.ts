import { StrKey } from "@stellar/stellar-sdk";

export interface DeploymentManifest {
  schemaVersion: number;
  contractVersion: number;
  escrowSchemaVersion: number;
  network: string;
  networkPassphrase: string;
  rpcEnvironment: string;
  source: {
    commit: string;
  };
  toolchain: {
    rust: string;
    sorobanSdk: string;
    stellarCli: string;
    stellarXdr: string;
    protocol: number;
  };
  artifact: {
    path: string;
    sizeBytes: number;
    sha256: string;
    optimized: boolean;
  };
  bindings: {
    path: string;
    command: string;
    sha256: string;
  };
  deployment: {
    contractId: string;
    transactionHash: string;
    ledger: number;
  };
  constructor: {
    treasury: string;
    maxFeeBps: number;
    pilotFeeBps: number;
    ttl: {
      threshold: number;
      extendTo: number;
      networkLimitReference: string;
    };
  };
  assets: {
    XLM: {
      code: "XLM";
      issuer: null;
      sac: string;
    };
    USDC: {
      code: "USDC";
      issuer: string;
      sac: string;
    };
  };
  evidenceIndex: string;
  deployedAt: string;
  testnetOnly: boolean;
}

export function validateDeploymentManifest(manifest: unknown): DeploymentManifest {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Invalid deployment manifest: must be an object");
  }

  const m = manifest as Record<string, unknown>;

  if (m.schemaVersion !== 1 || m.contractVersion !== 1 || m.escrowSchemaVersion !== 1) {
    throw new Error("Invalid deployment manifest: unsupported schema or contract version");
  }

  if (m.network !== "testnet") {
    throw new Error("Invalid deployment manifest: network must be testnet");
  }

  if (m.networkPassphrase !== "Test SDF Network ; September 2015") {
    throw new Error("Invalid deployment manifest: network passphrase mismatch");
  }

  const deployment = m.deployment as Record<string, unknown> | undefined;
  if (
    !deployment ||
    typeof deployment.contractId !== "string" ||
    !StrKey.isValidContract(deployment.contractId)
  ) {
    throw new Error("Invalid deployment manifest: missing or invalid contractId");
  }

  const ctor = m["constructor" as keyof typeof m] as unknown as Record<string, unknown> | undefined;
  if (!ctor || ctor.maxFeeBps !== 0 || ctor.pilotFeeBps !== 0) {
    throw new Error("Invalid deployment manifest: fee must be zero");
  }

  const assets = m.assets as Record<string, Record<string, unknown>> | undefined;
  if (!assets || !assets.XLM || !assets.USDC) {
    throw new Error("Invalid deployment manifest: missing XLM or USDC asset mappings");
  }

  if (
    !StrKey.isValidContract(String(assets.XLM.sac)) ||
    !StrKey.isValidContract(String(assets.USDC.sac))
  ) {
    throw new Error("Invalid deployment manifest: invalid XLM or USDC SAC contract address");
  }

  return manifest as DeploymentManifest;
}
