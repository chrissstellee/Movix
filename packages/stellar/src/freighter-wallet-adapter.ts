import {
  WalletError,
  type WalletAccount,
  type WalletAdapter,
  type WalletStateChange,
} from "@repo/stellar/wallet";
import { Networks, StrKey } from "@stellar/stellar-sdk";

export interface FreighterDriver {
  connect(): Promise<{ address: string }>;
  disconnect(): Promise<void>;
  getNetwork(): Promise<{ network: string; networkPassphrase: string }>;
  signTransaction(
    xdr: string,
    options: { address: string; networkPassphrase: string },
  ): Promise<{ signedTxXdr: string }>;
  subscribe(listener: (state: { address?: string; networkPassphrase: string }) => void): () => void;
}

async function createWalletsKitDriver(): Promise<FreighterDriver> {
  if (typeof window === "undefined") {
    throw new WalletError("unsupported_wallet", "Freighter is only available in a browser.");
  }

  const [{ StellarWalletsKit }, { FreighterModule, FREIGHTER_ID }, { KitEventType, Networks }] =
    await Promise.all([
      import("@creit-tech/stellar-wallets-kit/sdk"),
      import("@creit-tech/stellar-wallets-kit/modules/freighter"),
      import("@creit-tech/stellar-wallets-kit/types"),
    ]);

  const freighter = new FreighterModule();
  if (!(await freighter.isAvailable())) {
    throw new WalletError(
      "unsupported_wallet",
      "Freighter is not installed or is unavailable in this browser.",
    );
  }

  StellarWalletsKit.init({
    modules: [freighter],
    selectedWalletId: FREIGHTER_ID,
    network: Networks.TESTNET,
    authModal: {
      hideUnsupportedWallets: true,
      showInstallLabel: true,
    },
  });

  return {
    connect: () => StellarWalletsKit.authModal(),
    disconnect: () => StellarWalletsKit.disconnect(),
    getNetwork: () => StellarWalletsKit.getNetwork(),
    signTransaction: (xdr, options) => StellarWalletsKit.signTransaction(xdr, options),
    subscribe: (listener) =>
      StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => listener(event.payload)),
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
    throw new WalletError(
      "invalid_account",
      "Freighter did not return a standard Stellar account.",
    );
  }
  if (network.networkPassphrase !== Networks.TESTNET) {
    throw new WalletError("wrong_network", "Switch Freighter to Stellar Testnet and try again.");
  }

  return {
    address,
    network: "testnet",
    networkPassphrase: network.networkPassphrase,
  };
}

export class FreighterWalletAdapter implements WalletAdapter {
  readonly id = "freighter";
  readonly name = "Freighter";

  private account: WalletAccount | null = null;
  private connectRequest: Promise<WalletAccount> | null = null;
  private driver: FreighterDriver | null = null;
  private driverRequest: Promise<FreighterDriver> | null = null;
  private generation = 0;
  private listeners = new Set<(event: WalletStateChange) => void>();
  private signRequest: Promise<string> | null = null;
  private unsubscribeDriver: (() => void) | null = null;

  constructor(
    private readonly driverFactory: () => Promise<FreighterDriver> = createWalletsKitDriver,
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

  private async getDriver(): Promise<FreighterDriver> {
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
      throw new WalletError("wallet_disconnected", "Connect Freighter before signing.");
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
