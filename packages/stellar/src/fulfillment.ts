import { StrKey } from "@stellar/stellar-sdk";

import { hexToBytes32 } from "./escrow-funding";

export interface EncodedAcceptArguments {
  id: Uint8Array;
  supplier: string;
  terms_hash: Uint8Array;
}

export interface EncodedMarkShippedArguments {
  id: Uint8Array;
  supplier: string;
  shipment_hash: Uint8Array;
}

export interface EncodedConfirmDeliveryArguments {
  id: Uint8Array;
  buyer: string;
  delivery_hash: Uint8Array;
}

/**
 * Encodes application intent parameters into typed Soroban accept contract arguments.
 */
export function encodeAcceptArguments(input: {
  escrowKeyHex: string;
  supplierWalletAddress: string;
  termsHashHex: string;
}): EncodedAcceptArguments {
  if (!StrKey.isValidEd25519PublicKey(input.supplierWalletAddress)) {
    throw new Error("Invalid supplier wallet address for accept operation");
  }

  const idBytes = hexToBytes32(input.escrowKeyHex);
  const termsHashBytes = hexToBytes32(input.termsHashHex);

  return {
    id: idBytes,
    supplier: input.supplierWalletAddress,
    terms_hash: termsHashBytes,
  };
}

/**
 * Encodes application intent parameters into typed Soroban mark_shipped contract arguments.
 */
export function encodeMarkShippedArguments(input: {
  escrowKeyHex: string;
  supplierWalletAddress: string;
  shipmentHashHex: string;
}): EncodedMarkShippedArguments {
  if (!StrKey.isValidEd25519PublicKey(input.supplierWalletAddress)) {
    throw new Error("Invalid supplier wallet address for mark_shipped operation");
  }

  const idBytes = hexToBytes32(input.escrowKeyHex);
  const shipmentHashBytes = hexToBytes32(input.shipmentHashHex);

  return {
    id: idBytes,
    supplier: input.supplierWalletAddress,
    shipment_hash: shipmentHashBytes,
  };
}

/**
 * Encodes application intent parameters into typed Soroban confirm_delivery contract arguments.
 */
export function encodeConfirmDeliveryArguments(input: {
  escrowKeyHex: string;
  buyerWalletAddress: string;
  deliveryHashHex: string;
}): EncodedConfirmDeliveryArguments {
  if (!StrKey.isValidEd25519PublicKey(input.buyerWalletAddress)) {
    throw new Error("Invalid buyer wallet address for confirm_delivery operation");
  }

  const idBytes = hexToBytes32(input.escrowKeyHex);
  const deliveryHashBytes = hexToBytes32(input.deliveryHashHex);

  return {
    id: idBytes,
    buyer: input.buyerWalletAddress,
    delivery_hash: deliveryHashBytes,
  };
}
