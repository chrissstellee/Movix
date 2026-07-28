import { Networks, StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { TESTNET_XLM_CONTRACT } from "./config.js";
import { createTestnetEscrowClient } from "./contracts.js";

const contractId = StrKey.encodeContract(Buffer.alloc(32, 9));

describe("generated escrow client adapter", () => {
  it("constructs a testnet client with the approved asset policy", () => {
    const client = createTestnetEscrowClient({
      contractId,
      supportedAssets: [TESTNET_XLM_CONTRACT],
    });

    expect(client.generated.options).toMatchObject({
      contractId,
      networkPassphrase: Networks.TESTNET,
      rpcUrl: "https://soroban-testnet.stellar.org",
    });
  });

  it("rejects invalid contract, network, RPC, and asset configuration", () => {
    expect(() => createTestnetEscrowClient({ contractId: "not-a-contract" })).toThrow(
      "valid Stellar contract",
    );
    expect(() =>
      createTestnetEscrowClient({
        contractId,
        networkPassphrase: Networks.PUBLIC,
      }),
    ).toThrow("testnet only");
    expect(() =>
      createTestnetEscrowClient({
        contractId,
        rpcUrl: "http://localhost:8000",
      }),
    ).toThrow("must use HTTPS");
    expect(() =>
      createTestnetEscrowClient({
        contractId,
        supportedAssets: [StrKey.encodeContract(Buffer.alloc(32, 10))],
      }),
    ).toThrow("approved testnet SACs");
    expect(() =>
      createTestnetEscrowClient({
        contractId,
        supportedAssets: [TESTNET_XLM_CONTRACT, TESTNET_XLM_CONTRACT],
      }),
    ).toThrow("unique approved testnet SACs");
  });
});
