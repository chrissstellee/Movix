import type { TransactionResult } from "./transactions.js";

export interface EscrowContractClient {
  getConfig(): Promise<unknown>;
  submit(method: string, args: readonly unknown[]): Promise<TransactionResult>;
}

export const ESCROW_BINDINGS_DESTINATION = "generated/escrow" as const;
