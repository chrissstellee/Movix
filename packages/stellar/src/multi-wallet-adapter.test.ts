import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const kit = vi.hoisted(() => ({
  authModal: vi.fn(),
  disconnect: vi.fn(),
  fetchAddress: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
  init: vi.fn(),
  on: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock("@creit-tech/stellar-wallets-kit/sdk", () => ({ StellarWalletsKit: kit }));
vi.mock("@creit-tech/stellar-wallets-kit/modules/freighter", () => ({
  FREIGHTER_ID: "freighter",
  FreighterModule: class {
    productId = "freighter";
  },
}));
vi.mock("@creit-tech/stellar-wallets-kit/modules/xbull", () => ({
  xBullModule: class {
    productId = "xbull";
  },
}));
vi.mock("@creit-tech/stellar-wallets-kit/modules/lobstr", () => ({
  LobstrModule: class {
    productId = "lobstr";
  },
}));
vi.mock("@creit-tech/stellar-wallets-kit/modules/hana", () => ({
  HanaModule: class {
    productId = "hana";
  },
}));
vi.mock("@creit-tech/stellar-wallets-kit/types", () => ({
  KitEventType: { STATE_UPDATED: "state_updated" },
  Networks: { TESTNET: "TESTNET" },
}));

import { createMultiWalletDriver } from "./multi-wallet-adapter.js";

describe("createMultiWalletDriver", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    kit.authModal.mockReset().mockResolvedValue({ address: "GACCOUNT" });
    kit.fetchAddress.mockReset();
    kit.getAddress.mockReset();
    kit.init.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the wallet selector before requesting an address", async () => {
    const driver = await createMultiWalletDriver();

    await expect(driver.connect()).resolves.toEqual({ address: "GACCOUNT" });

    expect(kit.authModal).toHaveBeenCalledOnce();
    expect(kit.getAddress).not.toHaveBeenCalled();
    expect(kit.fetchAddress).not.toHaveBeenCalled();
    expect(kit.init).toHaveBeenCalledWith(
      expect.not.objectContaining({ selectedWalletId: "freighter" }),
    );
  });
});
