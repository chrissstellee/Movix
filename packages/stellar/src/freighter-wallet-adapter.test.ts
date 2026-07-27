import { Keypair, Networks } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import { FreighterWalletAdapter, type FreighterDriver } from "./freighter-wallet-adapter.js";
import { WalletError } from "./wallet.js";

function createDriver(overrides: Partial<FreighterDriver> = {}) {
  let stateListener: ((state: { address?: string; networkPassphrase: string }) => void) | undefined;
  const address = Keypair.random().publicKey();
  const driver: FreighterDriver = {
    connect: vi.fn().mockResolvedValue({ address }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getNetwork: vi
      .fn()
      .mockResolvedValue({ network: "TESTNET", networkPassphrase: Networks.TESTNET }),
    signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: "signed-xdr" }),
    subscribe: vi.fn((listener) => {
      stateListener = listener;
      return vi.fn();
    }),
    ...overrides,
  };
  return {
    address,
    driver,
    emit: (state: Parameters<NonNullable<typeof stateListener>>[0]) => stateListener?.(state),
  };
}

describe("FreighterWalletAdapter", () => {
  it("connects only a valid Testnet account", async () => {
    const { address, driver } = createDriver();
    const adapter = new FreighterWalletAdapter(async () => driver);

    await expect(adapter.connect()).resolves.toEqual({
      address,
      network: "testnet",
      networkPassphrase: Networks.TESTNET,
    });
  });

  it("rejects invalid addresses and non-Testnet networks", async () => {
    const invalid = createDriver({
      connect: vi.fn().mockResolvedValue({ address: "not-an-account" }),
    });
    await expect(
      new FreighterWalletAdapter(async () => invalid.driver).connect(),
    ).rejects.toMatchObject({
      code: "invalid_account",
    });

    const mainnet = createDriver({
      getNetwork: vi
        .fn()
        .mockResolvedValue({ network: "PUBLIC", networkPassphrase: Networks.PUBLIC }),
    });
    await expect(
      new FreighterWalletAdapter(async () => mainnet.driver).connect(),
    ).rejects.toMatchObject({
      code: "wrong_network",
    });
  });

  it("normalizes a rejected wallet request", async () => {
    const { driver } = createDriver({
      connect: vi.fn().mockRejectedValue(new Error("User rejected access")),
    });
    await expect(new FreighterWalletAdapter(async () => driver).connect()).rejects.toEqual(
      expect.objectContaining<Partial<WalletError>>({ code: "user_rejected" }),
    );
  });

  it("reports an unavailable Freighter installation", async () => {
    const adapter = new FreighterWalletAdapter(async () => {
      throw new Error("Freighter is not available");
    });
    await expect(adapter.connect()).rejects.toMatchObject({
      code: "unsupported_wallet",
    });
  });

  it("deduplicates concurrent connect and sign requests", async () => {
    const { driver } = createDriver();
    const adapter = new FreighterWalletAdapter(async () => driver);
    const firstConnect = adapter.connect();
    const secondConnect = adapter.connect();
    expect(firstConnect).toBe(secondConnect);
    await firstConnect;

    const firstSign = adapter.signTransaction("xdr", Networks.TESTNET);
    const secondSign = adapter.signTransaction("xdr", Networks.TESTNET);
    expect(firstSign).toBe(secondSign);
    await expect(firstSign).resolves.toBe("signed-xdr");
    expect(driver.signTransaction).toHaveBeenCalledTimes(1);
  });

  it("publishes account, network, and disconnect changes", async () => {
    const { address, driver, emit } = createDriver();
    const adapter = new FreighterWalletAdapter(async () => driver);
    const listener = vi.fn();
    adapter.subscribe(listener);
    await adapter.connect();
    listener.mockClear();

    emit({ address, networkPassphrase: Networks.PUBLIC });
    emit({ networkPassphrase: Networks.TESTNET });

    expect(listener).toHaveBeenNthCalledWith(1, {
      type: "network_changed",
      network: Networks.PUBLIC,
    });
    expect(listener).toHaveBeenNthCalledWith(2, { type: "disconnected" });
  });

  it("invalidates a connection that resolves after disconnect", async () => {
    let resolveConnection!: (value: { address: string }) => void;
    const pending = new Promise<{ address: string }>((resolve) => {
      resolveConnection = resolve;
    });
    const { address, driver } = createDriver({ connect: vi.fn(() => pending) });
    const adapter = new FreighterWalletAdapter(async () => driver);

    const connection = adapter.connect();
    await adapter.disconnect();
    resolveConnection({ address });

    await expect(connection).rejects.toMatchObject({ code: "wallet_disconnected" });
  });
});
