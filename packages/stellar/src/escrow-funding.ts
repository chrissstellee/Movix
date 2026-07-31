import { Buffer } from "buffer";

import { hash, StrKey } from "@stellar/stellar-sdk";

export interface DerivedEscrowKey {
  keyBytes: Uint8Array;
  keyHex: string;
}

export interface EscrowFundingIntentInput {
  verifiedContractId: string;
  orderId: string;
  acceptedRevisionId: string;
  buyerWalletAddress: string;
  supplierWalletAddress: string;
  tokenContractId: string;
  grandTotalBaseUnits: bigint | number;
  fundingDeadlineMs: number;
  termsHashHex: string;
}

export interface EncodedContractFundingArguments {
  id: Uint8Array;
  buyer: string;
  supplier: string;
  token: string;
  amount: bigint;
  fee_bps: number;
  accept_by: bigint;
  terms_hash: Uint8Array;
}

/**
 * Derives the deterministic 32-byte Escrow ID key from network, contract, order, and revision.
 * Formula: SHA-256("movix:escrow:v1\0testnet\0{verifiedContractId}\0{orderId}\0{acceptedRevisionId}")
 */
export function deriveEscrowKey(params: {
  verifiedContractId: string;
  orderId: string;
  acceptedRevisionId: string;
}): DerivedEscrowKey {
  if (!StrKey.isValidContract(params.verifiedContractId)) {
    throw new Error("Invalid verifiedContractId for escrow key derivation");
  }
  if (!params.orderId || !params.acceptedRevisionId) {
    throw new Error("orderId and acceptedRevisionId are required for escrow key derivation");
  }

  const rawString = `movix:escrow:v1\0testnet\0${params.verifiedContractId}\0${params.orderId}\0${params.acceptedRevisionId}`;
  const digest = hash(Buffer.from(rawString, "utf-8"));

  return {
    keyBytes: new Uint8Array(digest),
    keyHex: digest.toString("hex"),
  };
}

/**
 * Converts a 64-character hex terms hash to a 32-byte Uint8Array.
 */
export function hexToBytes32(hexString: string): Uint8Array {
  const cleanHex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;
  if (!/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
    throw new Error("Terms hash must be a 64-character hex string");
  }
  return new Uint8Array(Buffer.from(cleanHex, "hex"));
}

/**
 * Converts milliseconds timestamp to whole Unix seconds for contract accept_by deadline.
 */
export function fundingDeadlineSeconds(msTimestamp: number): bigint {
  if (msTimestamp <= 0) {
    throw new Error("Invalid funding deadline timestamp");
  }
  return BigInt(Math.floor(msTimestamp / 1000));
}

/**
 * Encodes application intent parameters into typed Soroban escrow v1 contract arguments.
 */
export function encodeEscrowFundingArguments(
  input: EscrowFundingIntentInput,
): EncodedContractFundingArguments {
  const { keyBytes } = deriveEscrowKey({
    verifiedContractId: input.verifiedContractId,
    orderId: input.orderId,
    acceptedRevisionId: input.acceptedRevisionId,
  });

  const amountBig = BigInt(input.grandTotalBaseUnits);
  if (amountBig <= 0n) {
    throw new Error("Funding amount must be greater than zero");
  }

  const acceptByBig = fundingDeadlineSeconds(input.fundingDeadlineMs);
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  if (acceptByBig <= nowSeconds) {
    throw new Error("Funding deadline is in the past");
  }

  const termsHashBytes = hexToBytes32(input.termsHashHex);

  return {
    id: keyBytes,
    buyer: input.buyerWalletAddress,
    supplier: input.supplierWalletAddress,
    token: input.tokenContractId,
    amount: amountBig,
    fee_bps: 0,
    accept_by: acceptByBig,
    terms_hash: termsHashBytes,
  };
}
