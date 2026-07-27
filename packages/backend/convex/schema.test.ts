/// <reference types="vite/client" />

import { FIXED_NOW, testnetUsdc } from "@repo/domain/fixtures";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("Movix schema", () => {
  it("accepts a representative buyer-to-escrow record set", async () => {
    const t = convexTest(schema, modules);

    const result = await t.run(async (ctx) => {
      const buyerUserId = await ctx.db.insert("users", {
        primaryWallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        status: "active",
        timezone: "UTC",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        version: 1n,
      });
      const supplierUserId = await ctx.db.insert("users", {
        primaryWallet: testnetUsdc.issuer,
        status: "active",
        timezone: "UTC",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        version: 1n,
      });
      const buyerOrganizationId = await ctx.db.insert("organizations", {
        legalName: "Buyer Fixture Ltd.",
        capability: "buyer",
        status: "active",
        createdByUserId: buyerUserId,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        version: 1n,
      });
      const supplierOrganizationId = await ctx.db.insert("organizations", {
        legalName: "Supplier Fixture Ltd.",
        capability: "supplier",
        status: "active",
        createdByUserId: supplierUserId,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        version: 1n,
      });
      const orderId = await ctx.db.insert("orders", {
        buyerOrganizationId,
        supplierOrganizationId,
        purchaseOrderNumber: "MOVIX-PO-0001",
        agreementStatus: "accepted",
        fulfillmentStatus: "not_started",
        settlementStatus: "funded",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        version: 1n,
      });
      const escrowId = await ctx.db.insert("escrows", {
        orderId,
        escrowKey: "escrow-0001",
        buyerOrganizationId,
        supplierOrganizationId,
        network: "testnet",
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        tokenContractId: testnetUsdc.contractId,
        amountBaseUnits: 467_500_000n,
        status: "funded",
        reconciliationStatus: "current",
        confirmedLedger: 1n,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        version: 1n,
      });

      return { buyerOrganizationId, supplierOrganizationId, orderId, escrowId };
    });

    expect(result.buyerOrganizationId).not.toBe(result.supplierOrganizationId);
    expect(result.orderId).toBeTruthy();
    expect(result.escrowId).toBeTruthy();
  });

  it("rejects an invalid status at runtime", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.run(async (ctx) => {
        await ctx.db.insert("users", {
          primaryWallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
          status: "unknown" as never,
          timezone: "UTC",
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
          version: 1n,
        });
      }),
    ).rejects.toThrow();
  });

  it("accepts a versioned Sprint 2 onboarding draft and canonical business records", async () => {
    const t = convexTest(schema, modules);

    const result = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        primaryWallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        status: "active",
        timezone: "Asia/Manila",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        version: 1n,
      });
      const draftId = await ctx.db.insert("businessOnboardingDrafts", {
        userId,
        identity: {
          legalName: "Acme Supply Co.",
          registrationCountry: "PH",
          businessEmail: "owner@example.com",
          capability: "buyer_supplier",
          defaultTimezone: "Asia/Manila",
        },
        currentStep: "contact",
        completedSteps: ["identity"],
        sameBillingAsRegistered: true,
        sameShippingAsRegistered: true,
        status: "draft",
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        version: 1n,
      });
      const organizationId = await ctx.db.insert("organizations", {
        legalName: "Acme Supply Co.",
        normalizedLegalName: "acme supply co.",
        registrationCountry: "PH",
        businessEmail: "owner@example.com",
        capability: "buyer_supplier",
        defaultTimezone: "Asia/Manila",
        status: "active",
        verificationStatus: "unverified",
        createdByUserId: userId,
        profileAttestationVersion: "business-profile-v1",
        profileAttestedByUserId: userId,
        profileAttestedAt: FIXED_NOW,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        version: 1n,
      });
      const addressId = await ctx.db.insert("addresses", {
        organizationId,
        type: "registered",
        label: "Registered",
        recipientName: "Acme Supply Co.",
        line1: "123 Main Street",
        city: "Makati",
        region: "Metro Manila",
        postalCode: "1200",
        countryCode: "PH",
        isDefault: true,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        version: 1n,
      });
      return { draftId, organizationId, addressId };
    });

    expect(result.draftId).toBeTruthy();
    expect(result.organizationId).toBeTruthy();
    expect(result.addressId).toBeTruthy();
  });
});
