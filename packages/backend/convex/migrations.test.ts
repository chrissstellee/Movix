/// <reference types="vite/client" />

import { runToCompletion } from "@convex-dev/migrations";
import migrationsComponent from "@convex-dev/migrations/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { components, internal } from "./_generated/api";
import schema from "./schema";

import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

describe("Sprint 2 migrations", () => {
  it("normalizes only derivable legacy contact and address fields", async () => {
    const t = convexTest(schema, modules);
    migrationsComponent.register(t);
    let contactId: Id<"contacts">;
    let addressId: Id<"addresses">;

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        primaryWallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        status: "active",
        timezone: "UTC",
        createdAt: 1,
        updatedAt: 1,
        version: 1n,
      });
      const organizationId = await ctx.db.insert("organizations", {
        legalName: "Legacy Business",
        capability: "buyer",
        status: "active",
        createdByUserId: userId,
        createdAt: 1,
        updatedAt: 1,
        version: 1n,
      });
      contactId = await ctx.db.insert("contacts", {
        organizationId,
        type: "primary",
        name: "Legacy Owner",
        isPrimary: true,
        createdAt: 1,
        updatedAt: 1,
      });
      addressId = await ctx.db.insert("addresses", {
        organizationId,
        type: "business",
        label: "Business",
        line1: "Unknown legacy line",
        city: "Makati",
        countryCode: "PH",
        createdAt: 1,
        updatedAt: 1,
      });
    });

    await t.run(async (ctx) => {
      await runToCompletion(
        ctx,
        components.migrations,
        internal.migrations.normalizeLegacyContacts,
      );
      await runToCompletion(
        ctx,
        components.migrations,
        internal.migrations.normalizeLegacyAddresses,
      );
    });

    const result = await t.run(async (ctx) => ({
      contact: await ctx.db.get("contacts", contactId),
      address: await ctx.db.get("addresses", addressId),
    }));
    expect(result.contact).toMatchObject({ type: "general", version: 1n });
    expect(result.address).toMatchObject({ type: "registered", version: 1n });
    expect(result.address?.recipientName).toBeUndefined();
  });
});

describe("Sprint 5 supplier queue migration", () => {
  it("backfills a sent frozen order and its exact supplier count once", async () => {
    const t = convexTest(schema, modules);
    migrationsComponent.register(t);
    let orderId: Id<"orders">;
    let supplierOrganizationId: Id<"organizations">;
    await t.run(async (ctx) => {
      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        primaryWallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        status: "active",
        timezone: "UTC",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      const buyerOrganizationId = await ctx.db.insert("organizations", {
        legalName: "Migration Buyer",
        capability: "buyer",
        status: "active",
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      supplierOrganizationId = await ctx.db.insert("organizations", {
        legalName: "Migration Supplier",
        capability: "supplier",
        status: "active",
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      orderId = await ctx.db.insert("orders", {
        buyerOrganizationId,
        supplierOrganizationId,
        currentRevisionNumber: 1n,
        grandTotalBaseUnits: 100n,
        agreementStatus: "sent",
        fulfillmentStatus: "not_started",
        settlementStatus: "unfunded",
        sortTimestamp: now,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      const revisionId = await ctx.db.insert("orderRevisions", {
        orderId,
        revisionNumber: 1n,
        buyerOrganizationId,
        supplierOrganizationId,
        buyerLegalNameSnapshot: "Migration Buyer",
        subtotalBaseUnits: 100n,
        discountTotalBaseUnits: 0n,
        taxTotalBaseUnits: 0n,
        shippingTotalBaseUnits: 0n,
        grandTotalBaseUnits: 100n,
        paymentMode: "escrow",
        autoReleasePolicy: "none",
        termsHash: "a".repeat(64),
        frozenAt: now,
        supplierAcceptanceDeadline: now + 60_000,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      await ctx.db.patch("orders", orderId, { currentRevisionId: revisionId });
    });
    await t.run(async (ctx) => {
      await runToCompletion(
        ctx,
        components.migrations,
        internal.migrations.backfillSupplierQueueState,
      );
    });
    const state = await t.run(async (ctx) => ({
      order: await ctx.db.get("orders", orderId),
      counts: await ctx.db
        .query("supplierOrderCounts")
        .withIndex("by_supplierOrganizationId", (index) =>
          index.eq("supplierOrganizationId", supplierOrganizationId),
        )
        .unique(),
    }));
    expect(state.order?.supplierQueueState).toBe("requires_decision");
    expect(state.counts).toMatchObject({
      requiresDecisionCount: 1n,
      expiredCount: 0n,
      acceptedCount: 0n,
      rejectedCount: 0n,
    });
  });

  it("aborts rather than manufacturing identity for a legacy accepted order", async () => {
    const t = convexTest(schema, modules);
    migrationsComponent.register(t);
    await t.run(async (ctx) => {
      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        primaryWallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        status: "active",
        timezone: "UTC",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      const buyerOrganizationId = await ctx.db.insert("organizations", {
        legalName: "Legacy Buyer",
        capability: "buyer",
        status: "active",
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      const supplierOrganizationId = await ctx.db.insert("organizations", {
        legalName: "Legacy Supplier",
        capability: "supplier",
        status: "active",
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      const orderId = await ctx.db.insert("orders", {
        buyerOrganizationId,
        supplierOrganizationId,
        currentRevisionNumber: 1n,
        grandTotalBaseUnits: 100n,
        agreementStatus: "accepted",
        fulfillmentStatus: "not_started",
        settlementStatus: "unfunded",
        sortTimestamp: now,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      const revisionId = await ctx.db.insert("orderRevisions", {
        orderId,
        revisionNumber: 1n,
        buyerOrganizationId,
        supplierOrganizationId,
        buyerLegalNameSnapshot: "Legacy Buyer",
        subtotalBaseUnits: 100n,
        discountTotalBaseUnits: 0n,
        taxTotalBaseUnits: 0n,
        shippingTotalBaseUnits: 0n,
        grandTotalBaseUnits: 100n,
        paymentMode: "escrow",
        autoReleasePolicy: "none",
        termsHash: "b".repeat(64),
        frozenAt: now,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      await ctx.db.patch("orders", orderId, { currentRevisionId: revisionId });
    });
    await expect(
      t.run(async (ctx) => {
        await runToCompletion(
          ctx,
          components.migrations,
          internal.migrations.backfillSupplierQueueState,
        );
      }),
    ).rejects.toThrow(/SPRINT5_MIGRATION_ABORT_MISSING_DECISION_IDENTITY/u);
  });
});
