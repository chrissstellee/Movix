import { useCallback, useEffect, useState } from "react";
import { Horizon } from "@stellar/stellar-sdk";

export interface TransactionRecoveryState {
  isRecovering: boolean;
  recoveryStatus: "idle" | "checking_rpc" | "reconciled" | "failed" | "unconfirmed";
  message?: string;
}

const TESTNET_HORIZON_URL = "https://horizon-testnet.stellar.org";

/**
 * S8-FL10: Transaction interruption & interrupted state recovery hook.
 * Checks Stellar RPC finality for pending transaction submission hashes upon page reloads.
 */
export function useTransactionRecovery(params: {
  pendingTxHash?: string;
  onReconciled?: (txHash: string) => void;
}) {
  const [state, setState] = useState<TransactionRecoveryState>({
    isRecovering: false,
    recoveryStatus: "idle",
  });

  const checkPendingTransaction = useCallback(
    async (hash: string) => {
      setState({
        isRecovering: true,
        recoveryStatus: "checking_rpc",
        message: "Reconciling transaction with Stellar Testnet ledger...",
      });

      try {
        const server = new Horizon.Server(TESTNET_HORIZON_URL);
        const txResponse = await server.transactions().transaction(hash).call();

        if (txResponse && txResponse.successful) {
          setState({
            isRecovering: false,
            recoveryStatus: "reconciled",
            message: `Transaction ${hash.slice(0, 8)}... confirmed on-chain in ledger #${txResponse.ledger_attr}`,
          });
          params.onReconciled?.(hash);
        } else {
          setState({
            isRecovering: false,
            recoveryStatus: "failed",
            message: "Transaction failed or was rejected by Stellar network.",
          });
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes("404") || errorMessage.includes("not_found")) {
          setState({
            isRecovering: false,
            recoveryStatus: "unconfirmed",
            message: "Transaction hash not found on ledger. Session safe to retry.",
          });
        } else {
          setState({
            isRecovering: false,
            recoveryStatus: "failed",
            message: `RPC query error: ${errorMessage}`,
          });
        }
      }
    },
    [params],
  );

  useEffect(() => {
    if (params.pendingTxHash) {
      void checkPendingTransaction(params.pendingTxHash);
    }
  }, [params.pendingTxHash, checkPendingTransaction]);

  return {
    ...state,
    checkPendingTransaction,
  };
}
