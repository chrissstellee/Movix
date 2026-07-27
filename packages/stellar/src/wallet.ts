export type WalletConnectionStatus = "disconnected" | "connecting" | "connected";

export interface WalletAccount {
  address: string;
  network: "testnet";
}

export interface WalletAdapter {
  readonly id: string;
  readonly name: string;
  connect(): Promise<WalletAccount>;
  disconnect(): Promise<void>;
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>;
}

export type WalletErrorCode =
  | "unsupported_wallet"
  | "wallet_disconnected"
  | "user_rejected"
  | "wrong_network";
