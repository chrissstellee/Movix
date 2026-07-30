/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("Escrow Fulfillment Authorization & State Machine Tests", () => {
  it("verifies prepareAcceptIntent, recordShipmentIntent, and confirmDeliveryIntent state transition guards", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const importerWalletAddr = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFXYSFZSYDH7VJAXE4PPG";
    const exporterWalletAddr = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335WFOPVQOI3ZFZG3KA4YAOMZOO";

    // 1. Setup Importer User, Wallet, Session Family
    const importerUser = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        primaryWallet: importerWalletAddr,
        tokenIdentifier: "https://movix.test|importer",
        status: "active",
        timezone: "Asia/Jakarta",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    const importerWallet = await t.run(async (ctx) => {
      return await ctx.db.insert("wallets", {
        userId: importerUser,
        address: importerWalletAddr,
        network: "testnet",
        verifiedAt: now,
        createdAt: now,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("authSessionFamilies", {
        familyId: "family-importer",
        userId: importerUser,
        walletId: importerWallet,
        network: "testnet",
        currentCredentialHash: "cred-importer",
        absoluteExpiresAt: now + 600_000,
        createdAt: now,
        updatedAt: now,
      });
    });

    // 2. Setup Exporter User, Wallet, Session Family
    const exporterUser = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        primaryWallet: exporterWalletAddr,
        tokenIdentifier: "https://movix.test|exporter",
        status: "active",
        timezone: "Asia/Kuala_Lumpur",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    const exporterWallet = await t.run(async (ctx) => {
      return await ctx.db.insert("wallets", {
        userId: exporterUser,
        address: exporterWalletAddr,
        network: "testnet",
        verifiedAt: now,
        createdAt: now,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("authSessionFamilies", {
        familyId: "family-exporter",
        userId: exporterUser,
        walletId: exporterWallet,
        network: "testnet",
        currentCredentialHash: "cred-exporter",
        absoluteExpiresAt: now + 600_000,
        createdAt: now,
        updatedAt: now,
      });
    });

    // 3. Setup Organizations & Memberships
    const importerOrg = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        legalName: "PT Importir Nusantara",
        capability: "buyer",
        status: "active",
        verificationStatus: "verified",
        createdByUserId: importerUser,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    const exporterOrg = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        legalName: "ASEAN Exporter Sdn Bhd",
        capability: "supplier",
        status: "active",
        verificationStatus: "verified",
        createdByUserId: exporterUser,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("memberships", {
        organizationId: importerOrg,
        userId: importerUser,
        role: "owner",
        status: "active",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });

      await ctx.db.insert("memberships", {
        organizationId: exporterOrg,
        userId: exporterUser,
        role: "owner",
        status: "active",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    // 4. Setup Order & Revision & Escrow
    const orderId = await t.run(async (ctx) => {
      return await ctx.db.insert("orders", {
        buyerOrganizationId: importerOrg,
        supplierOrganizationId: exporterOrg,
        agreementStatus: "accepted",
        settlementStatus: "funded",
        fulfillmentStatus: "not_started",
        currentRevisionNumber: 1n,
        assetKey: "testnet:USDC",
        grandTotalBaseUnits: 500000000n,
        sortTimestamp: now,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    const revisionId = await t.run(async (ctx) => {
      return await ctx.db.insert("orderRevisions", {
        orderId,
        revisionNumber: 1n,
        buyerOrganizationId: importerOrg,
        supplierOrganizationId: exporterOrg,
        buyerLegalNameSnapshot: "PT Importir Nusantara",
        buyerWalletAddressSnapshot: importerWalletAddr,
        supplierLegalNameSnapshot: "ASEAN Exporter Sdn Bhd",
        supplierWalletAddressSnapshot: exporterWalletAddr,
        subtotalBaseUnits: 500000000n,
        discountTotalBaseUnits: 0n,
        taxTotalBaseUnits: 0n,
        shippingTotalBaseUnits: 0n,
        grandTotalBaseUnits: 500000000n,
        paymentMode: "escrow",
        autoReleasePolicy: "none",
        termsHash: "a".repeat(64),
        termsHashVersion: "order-terms-v2",
        createdByUserId: importerUser,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(orderId, { acceptedRevisionId: revisionId });
    });

    const escrowId = await t.run(async (ctx) => {
      return await ctx.db.insert("escrows", {
        orderId,
        escrowKey: "b".repeat(64),
        buyerOrganizationId: importerOrg,
        supplierOrganizationId: exporterOrg,
        network: "testnet",
        contractId: "CCEECHOGV6MXZANAOLJNDMA2GPEBDETPNWUR4XDEW32KHJUYN3V5ZAP5",
        tokenContractId: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
        amountBaseUnits: 500000000n,
        status: "funded",
        reconciliationStatus: "current",
        buyerWalletAddress: importerWalletAddr,
        supplierWalletAddress: exporterWalletAddr,
        termsHash: "a".repeat(64),
        acceptBy: BigInt(Math.floor(now / 1000) + 86400),
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    // 5. Importer trying to accept escrow should fail (must be Exporter)
    const asImporter = t.withIdentity({
      tokenIdentifier: "https://movix.test|importer",
      session_family_id: "family-importer",
    });
    await expect(
      asImporter.mutation(api.escrowFulfillment.prepareAcceptIntent, { orderId })
    ).rejects.toThrow("ORGANIZATION_FORBIDDEN");

    // 6. Exporter accepting escrow succeeds
    const asExporter = t.withIdentity({
      tokenIdentifier: "https://movix.test|exporter",
      session_family_id: "family-exporter",
    });
    const acceptIntent = await asExporter.mutation(api.escrowFulfillment.prepareAcceptIntent, { orderId });
    expect(acceptIntent.escrowKey).toBe("b".repeat(64));
    expect(acceptIntent.supplierWalletAddress).toBe(exporterWalletAddr);

    // 7. Exporter trying to record shipment before on-chain status moves to 'accepted' should fail
    await expect(
      asExporter.mutation(api.escrowFulfillment.recordShipmentIntent, {
        orderId,
        carrierName: "ASEAN Freight",
        trackingOrDocumentNumber: "AWB-12345",
        portOfLoading: "Port Klang",
        portOfDischarge: "Jakarta",
        shippedDate: "2026-08-01",
      })
    ).rejects.toThrow("expected accepted before recording shipment");

    // Move escrow status to 'accepted'
    await t.run(async (ctx) => {
      await ctx.db.patch(escrowId, { status: "accepted" });
    });

    // 8. Exporter records shipment intent succeeds
    const shipmentIntent = await asExporter.mutation(api.escrowFulfillment.recordShipmentIntent, {
      orderId,
      carrierName: "ASEAN Freight",
      trackingOrDocumentNumber: "AWB-12345",
      portOfLoading: "Port Klang",
      portOfDischarge: "Jakarta",
      shippedDate: "2026-08-01",
    });
    expect(shipmentIntent.shipmentHash.length).toBe(64);

    // 9. Importer trying to confirm delivery before status moves to 'shipped' should fail
    await expect(
      asImporter.mutation(api.escrowFulfillment.confirmDeliveryIntent, {
        orderId,
        receivedDate: "2026-08-05",
        receivingLocation: "Warehouse A, Jakarta",
        inspectionResult: "accepted_full",
        inspectorName: "Budi",
      })
    ).rejects.toThrow("expected shipped before confirming delivery");

    // Move escrow status to 'shipped'
    await t.run(async (ctx) => {
      await ctx.db.patch(escrowId, { status: "shipped" });
    });

    // 10. Importer confirms delivery succeeds
    const deliveryIntent = await asImporter.mutation(api.escrowFulfillment.confirmDeliveryIntent, {
      orderId,
      receivedDate: "2026-08-05",
      receivingLocation: "Warehouse A, Jakarta",
      inspectionResult: "accepted_full",
      inspectorName: "Budi",
    });
    expect(deliveryIntent.deliveryHash.length).toBe(64);
    expect(deliveryIntent.buyerWalletAddress).toBe(importerWalletAddr);
  });
});
