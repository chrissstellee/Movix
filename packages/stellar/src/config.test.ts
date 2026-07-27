import { Networks } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import {
  TESTNET_USDC_CONTRACT,
  TESTNET_XLM_CONTRACT,
  createStellarConfig,
  testnetConfig,
} from "./config.js";

describe("Stellar Testnet configuration", () => {
  it("accepts the approved fail-closed configuration", () => {
    const config = createStellarConfig(testnetConfig);
    expect(config.networkPassphrase).toBe(Networks.TESTNET);
    expect(config.assets.XLM.contractId).toBe(TESTNET_XLM_CONTRACT);
    expect(config.assets.USDC.contractId).toBe(TESTNET_USDC_CONTRACT);
  });

  it("rejects mixed network and asset configuration", () => {
    expect(() =>
      createStellarConfig({
        ...testnetConfig,
        networkPassphrase: Networks.PUBLIC as typeof Networks.TESTNET,
      }),
    ).toThrow("Testnet configuration only");

    expect(() =>
      createStellarConfig({
        ...testnetConfig,
        assets: {
          ...testnetConfig.assets,
          USDC: {
            ...testnetConfig.assets.USDC,
            contractId: TESTNET_XLM_CONTRACT,
          },
        },
      }),
    ).toThrow("approved Testnet asset");
  });

  it("rejects insecure RPC configuration", () => {
    expect(() =>
      createStellarConfig({ ...testnetConfig, rpcUrl: "http://localhost:8000" }),
    ).toThrow("must use HTTPS");
  });
});
