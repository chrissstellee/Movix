import {
  WalletError,
  type WalletAccount,
  type WalletAdapter,
  type WalletStateChange,
} from "@repo/stellar/wallet";
import { Networks, StrKey } from "@stellar/stellar-sdk";

/**
 * Multi-wallet adapter wrapping Stellar Wallets Kit with all available wallet modules.
 *
 * Supported wallets:
 * - Freighter
 * - xBull
 * - Lobstr
 * - Hana
 *
 * Only installed/available wallets are displayed in the auth modal.
 */

interface WalletsKitDriver {
  connect(): Promise<{ address: string }>;
  disconnect(): Promise<void>;
  getNetwork(): Promise<{ network: string; networkPassphrase: string }>;
  signTransaction(
    xdr: string,
    options: { address: string; networkPassphrase: string },
  ): Promise<{ signedTxXdr: string }>;
  subscribe(listener: (state: { address?: string; networkPassphrase: string }) => void): () => void;
  selectedWalletName(): string;
}

async function createMultiWalletDriver(): Promise<WalletsKitDriver> {
  if (typeof window === "undefined") {
    throw new WalletError("unsupported_wallet", "Stellar wallets are only available in a browser.");
  }

  const [
    { StellarWalletsKit },
    { FreighterModule, FREIGHTER_ID },
    { KitEventType, Networks: KitNetworks },
  ] = await Promise.all([
    import("@creit-tech/stellar-wallets-kit/sdk"),
    import("@creit-tech/stellar-wallets-kit/modules/freighter"),
    import("@creit-tech/stellar-wallets-kit/types"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modules: any[] = [new FreighterModule()];

  try {
    const { xBullModule } = await import("@creit-tech/stellar-wallets-kit/modules/xbull");
    modules.push(new xBullModule());
  } catch {}

  try {
    const { LobstrModule } = await import("@creit-tech/stellar-wallets-kit/modules/lobstr");
    modules.push(new LobstrModule());
  } catch {}

  try {
    const { HanaModule } = await import("@creit-tech/stellar-wallets-kit/modules/hana");
    modules.push(new HanaModule());
  } catch {}

  StellarWalletsKit.init({
    modules,
    selectedWalletId: FREIGHTER_ID,
    network: KitNetworks.TESTNET,
    authModal: {
      hideUnsupportedWallets: true,
      showInstallLabel: true,
    },
  });

  let selectedName = "Wallet";

  return {
    connect: async () => {
      try {
        const addrObj = await StellarWalletsKit.getAddress();
        if (addrObj?.address) {
          selectedName = "Connected Wallet";
          return addrObj;
        }
      } catch {}
      try {
        const addrObj = await StellarWalletsKit.fetchAddress();
        if (addrObj?.address) {
          selectedName = "Connected Wallet";
          return addrObj;
        }
      } catch {}

      // Fallback to showing auth modal so the user can pick a wallet
      const result = await StellarWalletsKit.authModal();
      selectedName = result.address ? "Connected Wallet" : "Wallet";
      return result;
    },
    disconnect: () => StellarWalletsKit.disconnect(),
    getNetwork: () => StellarWalletsKit.getNetwork(),
    signTransaction: (xdr, options) => StellarWalletsKit.signTransaction(xdr, options),
    subscribe: (listener) =>
      StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => listener(event.payload)),
    selectedWalletName: () => selectedName,
  };
}

function normalizeWalletError(error: unknown): WalletError {
  if (error instanceof WalletError) {
    return error;
  }

  const message = error instanceof Error ? error.message : "The wallet request failed.";
  const normalized = message.toLowerCase();
  const code =
    normalized.includes("reject") || normalized.includes("declin") || normalized.includes("cancel")
      ? "user_rejected"
      : normalized.includes("install") || normalized.includes("not available")
        ? "unsupported_wallet"
        : "wallet_disconnected";

  return new WalletError(code, message, error instanceof Error ? { cause: error } : undefined);
}

function validateAccount(
  address: string,
  network: { network: string; networkPassphrase: string },
): WalletAccount {
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new WalletError("invalid_account", "Wallet did not return a standard Stellar account.");
  }
  if (network.networkPassphrase !== Networks.TESTNET) {
    throw new WalletError("wrong_network", "Switch your wallet to Stellar Testnet and try again.");
  }

  return {
    address,
    network: "testnet",
    networkPassphrase: network.networkPassphrase,
  };
}

export class MultiWalletAdapter implements WalletAdapter {
  readonly id = "stellar-wallets-kit";
  readonly name = "Stellar Wallet";

  private account: WalletAccount | null = null;
  private connectRequest: Promise<WalletAccount> | null = null;
  private driver: WalletsKitDriver | null = null;
  private driverRequest: Promise<WalletsKitDriver> | null = null;
  private generation = 0;
  private listeners = new Set<(event: WalletStateChange) => void>();
  private signRequest: Promise<string> | null = null;
  private unsubscribeDriver: (() => void) | null = null;

  constructor(
    private readonly driverFactory: () => Promise<WalletsKitDriver> = createMultiWalletDriver,
  ) {}

  connect(): Promise<WalletAccount> {
    if (this.connectRequest) {
      return this.connectRequest;
    }

    const generation = this.generation;
    this.connectRequest = this.connectOnce(generation).finally(() => {
      this.connectRequest = null;
    });
    return this.connectRequest;
  }

  async disconnect(): Promise<void> {
    this.generation += 1;
    this.account = null;
    this.unsubscribeDriver?.();
    this.unsubscribeDriver = null;
    const driver = this.driver;
    this.driver = null;
    this.driverRequest = null;
    if (driver) {
      await driver.disconnect().catch(() => undefined);
    }
    this.emit({ type: "disconnected" });
  }

  signTransaction(xdr: string, networkPassphrase: string): Promise<string> {
    if (this.signRequest) {
      return this.signRequest;
    }

    this.signRequest = this.signOnce(xdr, networkPassphrase).finally(() => {
      this.signRequest = null;
    });
    return this.signRequest;
  }

  subscribe(listener: (event: WalletStateChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async connectOnce(generation: number): Promise<WalletAccount> {
    try {
      const driver = await this.getDriver();
      const [{ address }, network] = await Promise.all([driver.connect(), driver.getNetwork()]);
      if (generation !== this.generation) {
        throw new WalletError("wallet_disconnected", "The wallet changed during connection.");
      }

      const account = validateAccount(address, network);
      this.account = account;
      this.unsubscribeDriver ??= driver.subscribe((state) => this.handleDriverState(state));
      this.emit({ type: "account_changed", account });
      return account;
    } catch (error) {
      throw normalizeWalletError(error);
    }
  }

  private emit(event: WalletStateChange) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private async getDriver(): Promise<WalletsKitDriver> {
    if (this.driver) {
      return this.driver;
    }
    this.driverRequest ??= this.driverFactory();
    this.driver = await this.driverRequest;
    return this.driver;
  }

  private handleDriverState(state: { address?: string; networkPassphrase: string }) {
    if (!state.address) {
      this.account = null;
      this.emit({ type: "disconnected" });
      return;
    }
    if (state.networkPassphrase !== Networks.TESTNET) {
      this.account = null;
      this.emit({ type: "network_changed", network: state.networkPassphrase });
      return;
    }

    try {
      const account = validateAccount(state.address, {
        network: "Testnet",
        networkPassphrase: state.networkPassphrase,
      });
      this.account = account;
      this.emit({ type: "account_changed", account });
    } catch {
      this.account = null;
      this.emit({ type: "disconnected" });
    }
  }

  private async signOnce(xdr: string, networkPassphrase: string): Promise<string> {
    if (!this.account || !this.driver) {
      throw new WalletError("wallet_disconnected", "Connect your wallet before signing.");
    }
    if (networkPassphrase !== Networks.TESTNET) {
      throw new WalletError("wrong_network", "Only Stellar Testnet challenges can be signed.");
    }

    try {
      const result = await this.driver.signTransaction(xdr, {
        address: this.account.address,
        networkPassphrase,
      });
      return result.signedTxXdr;
    } catch (error) {
      throw normalizeWalletError(error);
    }
  }
}
