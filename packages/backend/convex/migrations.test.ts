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
