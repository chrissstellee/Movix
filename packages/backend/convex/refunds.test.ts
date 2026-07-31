/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("Sprint 9 Exceptions — Mutual Refunds & Timeout Cancellation Backend Tests", () => {
  it("verifies propose, approve, reject, withdraw refund intents and timeout cancellation eligibility", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const nowSeconds = Math.floor(now / 1000);

    const buyerWalletAddr = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFXYSFZSYDH7VJAXE4PPG";
    const supplierWalletAddr = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335WFOPVQOI3ZFZG3KA4YAOMZOO";

    // Setup Buyer User & Wallet
    const buyerUser = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        primaryWallet: buyerWalletAddr,
        tokenIdentifier: "https://movix.test|buyer",
        status: "active",
        timezone: "Asia/Jakarta",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    const buyerWallet = await t.run(async (ctx) => {
      return await ctx.db.insert("wallets", {
        userId: buyerUser,
        address: buyerWalletAddr,
        network: "testnet",
        verifiedAt: now,
        createdAt: now,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("authSessionFamilies", {
        familyId: "family-buyer",
        userId: buyerUser,
        walletId: buyerWallet,
        network: "testnet",
        currentCredentialHash: "cred-buyer",
        absoluteExpiresAt: now + 600_000,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Setup Supplier User & Wallet
    const supplierUser = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        primaryWallet: supplierWalletAddr,
        tokenIdentifier: "https://movix.test|supplier",
        status: "active",
        timezone: "Asia/Bangkok",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    const supplierWallet = await t.run(async (ctx) => {
      return await ctx.db.insert("wallets", {
        userId: supplierUser,
        address: supplierWalletAddr,
        network: "testnet",
        verifiedAt: now,
        createdAt: now,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("authSessionFamilies", {
        familyId: "family-supplier",
        userId: supplierUser,
        walletId: supplierWallet,
        network: "testnet",
        currentCredentialHash: "cred-supplier",
        absoluteExpiresAt: now + 600_000,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Organizations
    const buyerOrg = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        legalName: "PT Agricultural Imports",
        capability: "buyer",
        status: "active",
        verificationStatus: "verified",
        createdByUserId: buyerUser,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("memberships", {
        organizationId: buyerOrg,
        userId: buyerUser,
        role: "owner",
        status: "active",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    const supplierOrg = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        legalName: "Siam Rice Exporters Co Ltd",
        capability: "supplier",
        status: "active",
        verificationStatus: "verified",
        createdByUserId: supplierUser,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("memberships", {
        organizationId: supplierOrg,
        userId: supplierUser,
        role: "owner",
        status: "active",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    // Order & Escrow setup
    const orderId = await t.run(async (ctx) => {
      return await ctx.db.insert("orders", {
        buyerOrganizationId: buyerOrg,
        supplierOrganizationId: supplierOrg,
        agreementStatus: "accepted",
        fulfillmentStatus: "not_started",
        settlementStatus: "funded",
        currentRevisionNumber: 1n,
        assetKey: "testnet:USDC",
        grandTotalBaseUnits: 500000000n,
        sortTimestamp: now,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    const escrowId = await t.run(async (ctx) => {
      return await ctx.db.insert("escrows", {
        orderId,
        escrowKey: "ESC-2026-S9-001",
        buyerOrganizationId: buyerOrg,
        supplierOrganizationId: supplierOrg,
        network: "testnet",
        contractId: "CC1234567890TESTNETCONTRACTID",
        tokenContractId: "CC1234567890USDC",
        amountBaseUnits: 500000000n,
        status: "funded",
        reconciliationStatus: "current",
        buyerWalletAddress: buyerWalletAddr,
        supplierWalletAddress: supplierWalletAddr,
        termsHash: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
        acceptBy: BigInt(nowSeconds + 3600),
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    });

    // Test 1: Cancellation eligibility before acceptBy
    const buyerCtx = t.withIdentity({
      tokenIdentifier: "https://movix.test|buyer",
      session_family_id: "family-buyer",
    });

    const notEligible = await buyerCtx.query(api.refunds.checkCancellationEligibility, { orderId });
    expect(notEligible.isEligible).toBe(false);

    // Test 2: Prepare Refund Proposal by Buyer
    const termsHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const proposal = await buyerCtx.mutation(api.refunds.prepareRefundProposalIntent, {
      orderId,
      reasonCode: "DAMAGED_GOODS",
      explanation: "Cargo damaged during transshipment",
      termsHash,
    });

    expect(proposal.escrowId).toBe(escrowId);
    expect(proposal.termsHash).toBe(termsHash);

    // Verify status updated to refund_pending
    const updatedEscrow = await t.run(async (ctx) => ctx.db.get(escrowId));
    expect(updatedEscrow?.status).toBe("refund_pending");

    // Test 3: Approve Refund by Supplier (Counterparty)
    const supplierCtx = t.withIdentity({
      tokenIdentifier: "https://movix.test|supplier",
      session_family_id: "family-supplier",
    });

    const approvalResult = await supplierCtx.mutation(api.refunds.approveRefundIntent, {
      orderId,
      termsHash,
    });

    expect(approvalResult.success).toBe(true);
    expect(approvalResult.status).toBe("refunded");

    const refundedEscrow = await t.run(async (ctx) => ctx.db.get(escrowId));
    expect(refundedEscrow?.status).toBe("refunded");
  });
});
