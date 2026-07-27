export type TransactionAction = "fund" | "accept" | "ship" | "release" | "refund" | "cancel";

export type TransactionResult<T = unknown> =
  | {
      status: "submitted";
      action: TransactionAction;
      hash: string;
      submittedAt: number;
    }
  | {
      status: "confirmed";
      action: TransactionAction;
      hash: string;
      ledger: number;
      result: T;
    }
  | {
      status: "failed";
      action: TransactionAction;
      code: string;
      message: string;
      hash?: string;
    };
