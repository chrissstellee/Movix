import { Buffer } from "buffer";

import { Networks } from "@stellar/stellar-sdk";

import { decodeEscrowContractError, ESCROW_CONTRACT_ERRORS } from "./contract-errors";
import { createTestnetEscrowClient, type EscrowContractClient } from "./contracts";
import { MultiWalletAdapter } from "./multi-wallet-adapter";
import { WalletError } from "./wallet";

const VERIFIED_TESTNET_CONTRACT_ID = "CCEECHOGV6MXZANAOLJNDMA2GPEBDETPNWUR4XDEW32KHJUYN3V5ZAP5";

export interface SorobanSubmitResult {
  success: boolean;
  transactionHash?: string;
  ledger?: number;
  error?: string;
}

/** Converts a hex string (with optional 0x prefix) to a Buffer for Soroban BytesN<32> arguments. */
function hexToBuffer(hex: string): Buffer {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Buffer.from(clean, "hex");
}

/** User-facing error messages keyed by contract error name. */
const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  InvalidConfig: "Escrow contract is misconfigured.",
  UnsupportedAsset: "This token is not supported by the escrow contract.",
  InvalidAmount: "The escrow amount is invalid.",
  SameParty: "Buyer and supplier wallets must be different.",
  EscrowExists: "An escrow with this ID already exists on-chain.",
  EscrowNotFound: "Escrow not found on-chain. It may have already been settled.",
  InvalidTransition: "This action is not valid for the current escrow state.",
  ArithmeticFailure: "Arithmetic overflow in contract calculation.",
  FeeTooHigh: "The fee exceeds the maximum allowed by the contract.",
  InvalidDeadline: "The acceptance deadline is invalid.",
  AcceptanceExpired: "The escrow acceptance deadline has expired.",
  CancellationTooEarly: "Cannot cancel: the acceptance deadline has not passed yet.",
  TermsMismatch: "Terms hash does not match the on-chain escrow.",
  UnauthorizedParty: "Your wallet is not authorized for this escrow action.",
  SamePartyApproval: "The same party cannot both propose and approve a refund.",
  RefundTermsMismatch: "Refund terms hash does not match the pending proposal.",
  RefundProposerMismatch: "Only the original proposer can withdraw a refund.",
  InvariantViolation: "Contract invariant violation — please contact support.",
  InvalidHash: "A hash argument is invalid.",
  NotInitialized: "The escrow contract has not been initialized.",
};

/** Formats any error into a user-friendly message string. */
function formatSubmitError(err: unknown): string {
  if (err instanceof WalletError) {
    switch (err.code) {
      case "user_rejected":
        return "Transaction signing was rejected in your wallet.";
      case "unsupported_wallet":
        return "Freighter wallet is not installed or unavailable.";
      case "wrong_network":
        return "Switch Freighter to Stellar Testnet and try again.";
      case "wallet_disconnected":
        return "Wallet disconnected. Please reconnect and try again.";
      default:
        return err.message;
    }
  }

  // Try to decode a Soroban contract error
  const contractError = decodeEscrowContractError(err);
  if (contractError) {
    return CONTRACT_ERROR_MESSAGES[contractError.name] ?? `Contract error: ${contractError.name}`;
  }

  if (err instanceof Error) {
    const msg = err.message;

    // Simulation failures
    if (msg.includes("simulation") || msg.includes("Simulation")) {
      return `Transaction simulation failed: ${msg}`;
    }

    // Check for contract error names embedded in generic error messages
    for (const entry of ESCROW_CONTRACT_ERRORS) {
      if (msg.includes(entry.name)) {
        return CONTRACT_ERROR_MESSAGES[entry.name] ?? `Contract error: ${entry.name}`;
      }
    }

    return msg;
  }

  return "An unexpected error occurred during the transaction.";
}

/**
 * Creates a Freighter-backed signing client and executes the given contract
 * interaction, returning a standardised result with the real tx hash.
 */
async function withSigningClient(
  signerAddress: string,
  contractId: string | undefined,
  fn: (client: EscrowContractClient) => Promise<{ sendTransactionResponse?: { hash: string } }>,
): Promise<SorobanSubmitResult> {
  try {
    const adapter = new MultiWalletAdapter();
    const account = await adapter.connect();

    if (account.address !== signerAddress) {
      return {
        success: false,
        error:
          `Connected wallet (${account.address.slice(0, 6)}…${account.address.slice(-4)}) ` +
          `does not match the expected signer (${signerAddress.slice(0, 6)}…${signerAddress.slice(-4)}). ` +
          `Switch to the correct account in Freighter.`,
      };
    }

    const client = createTestnetEscrowClient({
      contractId: contractId ?? VERIFIED_TESTNET_CONTRACT_ID,
      publicKey: account.address,
      signTransaction: async (tx: string, opts?: { networkPassphrase?: string }) => {
        const signedXdr = await adapter.signTransaction(
          tx,
          opts?.networkPassphrase ?? Networks.TESTNET,
        );
        return { signedTxXdr: signedXdr };
      },
    });

    const sentTx = await fn(client);
    const txHash = sentTx.sendTransactionResponse?.hash;

    if (!txHash) {
      return {
        success: false,
        error: "Transaction was submitted but no hash was returned by the network.",
      };
    }

    return {
      success: true,
      transactionHash: txHash,
    };
  } catch (err) {
    return {
      success: false,
      error: formatSubmitError(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Action-specific submission functions
// ---------------------------------------------------------------------------

/** Escrow funding: invokes `create_and_fund` on the Soroban escrow contract. */
export async function submitCreateAndFund(params: {
  signerAddress: string;
  escrowIdHex: string;
  buyerWallet: string;
  supplierWallet: string;
  tokenContractId: string;
  amountBaseUnits: bigint;
  feeBps: number;
  acceptBySeconds: bigint;
  termsHashHex: string;
  contractId?: string;
}): Promise<SorobanSubmitResult> {
  return withSigningClient(params.signerAddress, params.contractId, async (client) => {
    const assembled = await client.createAndFund({
      id: hexToBuffer(params.escrowIdHex),
      buyer: params.buyerWallet,
      supplier: params.supplierWallet,
      token: params.tokenContractId,
      amount: params.amountBaseUnits,
      fee_bps: params.feeBps,
      accept_by: params.acceptBySeconds,
      terms_hash: hexToBuffer(params.termsHashHex),
    });
    return assembled.signAndSend();
  });
}

/** Escrow activation: invokes `accept` on the Soroban escrow contract. */
export async function submitAcceptEscrow(params: {
  signerAddress: string;
  escrowIdHex: string;
  supplierWallet: string;
  termsHashHex: string;
  contractId?: string;
}): Promise<SorobanSubmitResult> {
  return withSigningClient(params.signerAddress, params.contractId, async (client) => {
    const assembled = await client.activateEscrow({
      id: hexToBuffer(params.escrowIdHex),
      supplier: params.supplierWallet,
      terms_hash: hexToBuffer(params.termsHashHex),
    });
    return assembled.signAndSend();
  });
}

/** Shipment recording: invokes `mark_shipped` on the Soroban escrow contract. */
export async function submitMarkShipped(params: {
  signerAddress: string;
  escrowIdHex: string;
  supplierWallet: string;
  shipmentHashHex: string;
  contractId?: string;
}): Promise<SorobanSubmitResult> {
  return withSigningClient(params.signerAddress, params.contractId, async (client) => {
    const assembled = await client.markShipped({
      id: hexToBuffer(params.escrowIdHex),
      supplier: params.supplierWallet,
      shipment_hash: hexToBuffer(params.shipmentHashHex),
    });
    return assembled.signAndSend();
  });
}

/** Delivery confirmation and payout release: invokes `confirm_delivery`. */
export async function submitConfirmDelivery(params: {
  signerAddress: string;
  escrowIdHex: string;
  buyerWallet: string;
  deliveryHashHex: string;
  contractId?: string;
}): Promise<SorobanSubmitResult> {
  return withSigningClient(params.signerAddress, params.contractId, async (client) => {
    const assembled = await client.confirmDelivery({
      id: hexToBuffer(params.escrowIdHex),
      buyer: params.buyerWallet,
      delivery_hash: hexToBuffer(params.deliveryHashHex),
    });
    return assembled.signAndSend();
  });
}

/** Propose a mutual refund: invokes `propose_refund`. */
export async function submitProposeRefund(params: {
  signerAddress: string;
  escrowIdHex: string;
  proposerWallet: string;
  refundTermsHashHex: string;
  contractId?: string;
}): Promise<SorobanSubmitResult> {
  return withSigningClient(params.signerAddress, params.contractId, async (client) => {
    const assembled = await client.proposeRefund({
      id: hexToBuffer(params.escrowIdHex),
      proposer: params.proposerWallet,
      refund_terms_hash: hexToBuffer(params.refundTermsHashHex),
    });
    return assembled.signAndSend();
  });
}

/** Approve a pending mutual refund: invokes `approve_refund`. */
export async function submitApproveRefund(params: {
  signerAddress: string;
  escrowIdHex: string;
  approverWallet: string;
  refundTermsHashHex: string;
  contractId?: string;
}): Promise<SorobanSubmitResult> {
  return withSigningClient(params.signerAddress, params.contractId, async (client) => {
    const assembled = await client.approveRefund({
      id: hexToBuffer(params.escrowIdHex),
      approver: params.approverWallet,
      refund_terms_hash: hexToBuffer(params.refundTermsHashHex),
    });
    return assembled.signAndSend();
  });
}

/** Reject a pending mutual refund: invokes `reject_refund`. */
export async function submitRejectRefund(params: {
  signerAddress: string;
  escrowIdHex: string;
  approverWallet: string;
  refundTermsHashHex: string;
  contractId?: string;
}): Promise<SorobanSubmitResult> {
  return withSigningClient(params.signerAddress, params.contractId, async (client) => {
    const assembled = await client.rejectRefund({
      id: hexToBuffer(params.escrowIdHex),
      approver: params.approverWallet,
      refund_terms_hash: hexToBuffer(params.refundTermsHashHex),
    });
    return assembled.signAndSend();
  });
}

/** Withdraw a pending refund proposal: invokes `withdraw_refund`. */
export async function submitWithdrawRefund(params: {
  signerAddress: string;
  escrowIdHex: string;
  proposerWallet: string;
  refundTermsHashHex: string;
  contractId?: string;
}): Promise<SorobanSubmitResult> {
  return withSigningClient(params.signerAddress, params.contractId, async (client) => {
    const assembled = await client.withdrawRefund({
      id: hexToBuffer(params.escrowIdHex),
      proposer: params.proposerWallet,
      refund_terms_hash: hexToBuffer(params.refundTermsHashHex),
    });
    return assembled.signAndSend();
  });
}

/** Cancel an unaccepted escrow after deadline: invokes `cancel_unaccepted`. */
export async function submitCancelUnaccepted(params: {
  signerAddress: string;
  escrowIdHex: string;
  buyerWallet: string;
  contractId?: string;
}): Promise<SorobanSubmitResult> {
  return withSigningClient(params.signerAddress, params.contractId, async (client) => {
    const assembled = await client.cancelUnaccepted({
      id: hexToBuffer(params.escrowIdHex),
      buyer: params.buyerWallet,
    });
    return assembled.signAndSend();
  });
}
