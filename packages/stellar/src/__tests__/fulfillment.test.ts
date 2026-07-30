import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import {
  computeDeliveryHash,
  computeShipmentHash,
  DeliveryConfirmation,
  encodeAcceptArguments,
  encodeConfirmDeliveryArguments,
  encodeMarkShippedArguments,
  ShipmentEvidence,
} from "../index.js";

const VALID_SUPPLIER = Keypair.random().publicKey();
const VALID_BUYER = Keypair.random().publicKey();
const TEST_ESCROW_KEY = "11".repeat(32);
const TEST_TERMS_HASH = "22".repeat(32);

describe("Fulfillment Hashes & Contract Arguments", () => {
  describe("computeShipmentHash", () => {
    const validEvidence: ShipmentEvidence = {
      orderId: "order_123",
      revisionId: "rev_456",
      carrierName: "ASEAN Cargo Lines",
      trackingOrDocumentNumber: "BL-987654321",
      phytosanitaryCertNumber: "PHYTO-MY-2026-001",
      portOfLoading: "Port Klang, Malaysia",
      portOfDischarge: "Tanjung Priok, Jakarta",
      shippedDate: "2026-08-01",
      vesselOrFlightId: "MV OCEAN STAR V.12",
    };

    it("produces deterministic 32-byte SHA-256 hash", () => {
      const result1 = computeShipmentHash(validEvidence);
      const result2 = computeShipmentHash(validEvidence);

      expect(result1.hashHex).toEqual(result2.hashHex);
      expect(result1.hashBytes.length).toBe(32);
      expect(result1.hashHex.length).toBe(64);
    });

    it("guarantees canonical JSON key sorting independence", () => {
      // Reordered keys in JavaScript object
      const reorderedEvidence: ShipmentEvidence = {
        vesselOrFlightId: "MV OCEAN STAR V.12",
        shippedDate: "2026-08-01",
        portOfDischarge: "Tanjung Priok, Jakarta",
        portOfLoading: "Port Klang, Malaysia",
        phytosanitaryCertNumber: "PHYTO-MY-2026-001",
        trackingOrDocumentNumber: "BL-987654321",
        carrierName: "ASEAN Cargo Lines",
        revisionId: "rev_456",
        orderId: "order_123",
      };

      const result1 = computeShipmentHash(validEvidence);
      const result2 = computeShipmentHash(reorderedEvidence);

      expect(result1.hashHex).toEqual(result2.hashHex);
    });

    it("throws error when required fields are missing", () => {
      const invalidEvidence = { ...validEvidence, carrierName: "" };
      expect(() => computeShipmentHash(invalidEvidence)).toThrow(
        "carrierName and trackingOrDocumentNumber are required",
      );
    });
  });

  describe("computeDeliveryHash", () => {
    const validConfirmation: DeliveryConfirmation = {
      orderId: "order_123",
      revisionId: "rev_456",
      receivedDate: "2026-08-05",
      receivingLocation: "Jakarta Main Distribution Hub",
      inspectionCertificateNumber: "INSP-ID-2026-99",
      inspectionResult: "accepted_full",
      inspectorName: "Budi Santoso",
      notes: "Grade A Palm Oil delivered in optimal condition",
    };

    it("produces deterministic 32-byte SHA-256 hash", () => {
      const result1 = computeDeliveryHash(validConfirmation);
      const result2 = computeDeliveryHash(validConfirmation);

      expect(result1.hashHex).toEqual(result2.hashHex);
      expect(result1.hashBytes.length).toBe(32);
      expect(result1.hashHex.length).toBe(64);
    });

    it("throws error when required fields are missing", () => {
      const invalidConfirmation = { ...validConfirmation, receivingLocation: "" };
      expect(() => computeDeliveryHash(invalidConfirmation)).toThrow(
        "receivedDate and receivingLocation are required",
      );
    });
  });

  describe("encodeAcceptArguments", () => {
    it("encodes valid accept parameters into Uint8Array & Stellar address", () => {
      const encoded = encodeAcceptArguments({
        escrowKeyHex: TEST_ESCROW_KEY,
        supplierWalletAddress: VALID_SUPPLIER,
        termsHashHex: TEST_TERMS_HASH,
      });

      expect(encoded.supplier).toBe(VALID_SUPPLIER);
      expect(encoded.id.length).toBe(32);
      expect(encoded.terms_hash.length).toBe(32);
    });

    it("fails on invalid supplier address", () => {
      expect(() =>
        encodeAcceptArguments({
          escrowKeyHex: TEST_ESCROW_KEY,
          supplierWalletAddress: "INVALID_ADDRESS",
          termsHashHex: TEST_TERMS_HASH,
        }),
      ).toThrow("Invalid supplier wallet address");
    });
  });

  describe("encodeMarkShippedArguments", () => {
    it("encodes valid mark_shipped parameters", () => {
      const shipmentHashHex = "33".repeat(32);
      const encoded = encodeMarkShippedArguments({
        escrowKeyHex: TEST_ESCROW_KEY,
        supplierWalletAddress: VALID_SUPPLIER,
        shipmentHashHex,
      });

      expect(encoded.supplier).toBe(VALID_SUPPLIER);
      expect(encoded.id.length).toBe(32);
      expect(encoded.shipment_hash.length).toBe(32);
    });
  });

  describe("encodeConfirmDeliveryArguments", () => {
    it("encodes valid confirm_delivery parameters", () => {
      const deliveryHashHex = "44".repeat(32);
      const encoded = encodeConfirmDeliveryArguments({
        escrowKeyHex: TEST_ESCROW_KEY,
        buyerWalletAddress: VALID_BUYER,
        deliveryHashHex,
      });

      expect(encoded.buyer).toBe(VALID_BUYER);
      expect(encoded.id.length).toBe(32);
      expect(encoded.delivery_hash.length).toBe(32);
    });
  });
});
