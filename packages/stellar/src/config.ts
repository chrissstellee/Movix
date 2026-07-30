import { Asset, Networks, StrKey } from "@stellar/stellar-sdk";

export type StellarNetwork = "testnet";

export interface AssetConfig {
  code: "XLM" | "USDC";
  contractId: string;
  decimals: 7;
  issuer: string | null;
}

export interface StellarNetworkConfig {
  network: StellarNetwork;
  networkPassphrase: typeof Networks.TESTNET;
  rpcUrl: string;
  explorerUrl: string;
  assets: {
    XLM: AssetConfig;
    USDC: AssetConfig;
  };
}

export const TESTNET_USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
export const TESTNET_USDC_CONTRACT = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
export const TESTNET_XLM_CONTRACT = (() => {
  try {
    return Asset.native().contractId(Networks.TESTNET);
  } catch {
    return "CAS3J5D3ZLE2C766TVBR2ZSXYSMGCHDXFCZ2M3F5M2RKRO3TFTE44T7B";
  }
})();

export const testnetConfig: StellarNetworkConfig = {
  network: "testnet",
  networkPassphrase: Networks.TESTNET,
  rpcUrl: "https://soroban-testnet.stellar.org",
  explorerUrl: "https://stellar.expert/explorer/testnet",
  assets: {
    XLM: {
      code: "XLM",
      issuer: null,
      contractId: TESTNET_XLM_CONTRACT,
      decimals: 7,
    },
    USDC: {
      code: "USDC",
      issuer: TESTNET_USDC_ISSUER,
      contractId: TESTNET_USDC_CONTRACT,
      decimals: 7,
    },
  },
};

export function createStellarConfig(input: StellarNetworkConfig): StellarNetworkConfig {
  if (input.network !== "testnet" || input.networkPassphrase !== Networks.TESTNET) {
    throw new Error("Movix Sprint 0 accepts Testnet configuration only");
  }

  assertHttpsUrl(input.rpcUrl, "RPC URL");
  assertHttpsUrl(input.explorerUrl, "Explorer URL");

  if (input.assets.XLM.contractId !== TESTNET_XLM_CONTRACT || input.assets.XLM.issuer !== null) {
    throw new Error("XLM configuration does not match the Testnet native SAC");
  }
  if (
    input.assets.USDC.issuer !== TESTNET_USDC_ISSUER ||
    input.assets.USDC.contractId !== TESTNET_USDC_CONTRACT
  ) {
    throw new Error("USDC configuration does not match the approved Testnet asset");
  }
  if (
    !StrKey.isValidContract(input.assets.XLM.contractId) ||
    !StrKey.isValidContract(input.assets.USDC.contractId) ||
    !StrKey.isValidEd25519PublicKey(input.assets.USDC.issuer)
  ) {
    throw new Error("Asset configuration contains an invalid Stellar address");
  }

  return Object.freeze({
    ...input,
    assets: {
      XLM: Object.freeze({ ...input.assets.XLM }),
      USDC: Object.freeze({ ...input.assets.USDC }),
    },
  });
}

function assertHttpsUrl(value: string, label: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS`);
  }
}
