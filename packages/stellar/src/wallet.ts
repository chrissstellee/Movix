export type WalletConnectionStatus = "disconnected" | "connecting" | "connected";

export interface WalletAccount {
  address: string;
  network: "testnet";
  networkPassphrase: string;
}

export type WalletStateChange =
  | { type: "account_changed"; account: WalletAccount }
  | { type: "disconnected" }
  | { type: "network_changed"; network: string };

export interface WalletAdapter {
  readonly id: string;
  readonly name: string;
  connect(): Promise<WalletAccount>;
  disconnect(): Promise<void>;
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>;
  subscribe(listener: (event: WalletStateChange) => void): () => void;
}

export type WalletErrorCode =
  | "unsupported_wallet"
  | "wallet_disconnected"
  | "user_rejected"
  | "wrong_network"
  | "invalid_account"
  | "request_in_progress";

export class WalletError extends Error {
  readonly cause?: unknown;

  constructor(
    readonly code: WalletErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    if (options?.cause) {
      this.cause = options.cause;
    }
    this.name = "WalletError";
  }
}
