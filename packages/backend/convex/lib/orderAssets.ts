import { testnetConfig } from "@repo/stellar/config";

import { businessError } from "./errors";

import type { SupportedOrderAssetKey } from "@repo/domain";

export function resolveOrderAsset(key: SupportedOrderAssetKey) {
  if (key === "testnet:XLM") {
    return {
      key,
      network: "testnet" as const,
      code: "XLM" as const,
      issuer: null,
      contractId: testnetConfig.assets.XLM.contractId,
      decimals: 7n,
    };
  }
  if (key === "testnet:USDC") {
    return {
      key,
      network: "testnet" as const,
      code: "USDC" as const,
      issuer: testnetConfig.assets.USDC.issuer,
      contractId: testnetConfig.assets.USDC.contractId,
      decimals: 7n,
    };
  }
  throw businessError("ASSET_UNSUPPORTED");
}
