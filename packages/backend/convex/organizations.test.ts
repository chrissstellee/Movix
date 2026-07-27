/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const currentContext = makeFunctionReference<"query">("organizations:currentContext");
const getBusinessSettings = makeFunctionReference<"query">("organizations:getBusinessSettings");
const updateProfile = makeFunctionReference<"mutation">("organizations:updateProfile");
const updatePrimaryContact = makeFunctionReference<"mutation">(
  "organizations:updatePrimaryContact",
);
const updateAddress = makeFunctionReference<"mutation">("organizations:updateAddress");

async function createOrganizationFixture() {
  const t = convexTest(schema, modules);
  const now = 1_800_000_000_000;
  const tokenIdentifier = "https://movix.test|business-owner";
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      primaryWallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      tokenIdentifier,
      status: "active",
      timezone: "Asia/Manila",
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const walletId = await ctx.db.insert("wallets", {
      userId,
      address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      network: "testnet",
      verifiedAt: now,
      createdAt: now,
    });
    await ctx.db.insert("authSessionFamilies", {
      familyId: "business-family",
      userId,
      walletId,
      network: "testnet",
      currentCredentialHash: "business-credential",
      absoluteExpiresAt: now + 600_000,
      createdAt: now,
      updatedAt: now,
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
      profileAttestedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    await ctx.db.insert("memberships", {
      userId,
      organizationId,
      role: "owner",
      status: "active",
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const contactId = await ctx.db.insert("contacts", {
      organizationId,
      type: "general",
      name: "Alex Owner",
      email: "alex@example.com",
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
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
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    for (const type of ["billing", "shipping"] as const) {
      await ctx.db.insert("addresses", {
        organizationId,
        type,
        label: type === "billing" ? "Billing" : "Shipping",
        recipientName: "Acme Supply Co.",
        line1: "123 Main Street",
        city: "Makati",
        region: "Metro Manila",
        postalCode: "1200",
        countryCode: "PH",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    }
    return { userId, organizationId, contactId, addressId };
  });
  const authenticated = t.withIdentity({
    subject: "business-owner",
    issuer: "https://movix.test",
    tokenIdentifier,
    session_family_id: "business-family",
  });
  return { t, authenticated, ...ids };
}

describe("organization context and settings", () => {
  it("derives a commercially ready dual-capability context from membership", async () => {
    const { authenticated } = await createOrganizationFixture();

    await expect(authenticated.query(currentContext, {})).resolves.toMatchObject({
      kind: "ready",
      organization: { legalName: "Acme Supply Co.", capability: "buyer_supplier" },
      membership: { role: "owner", status: "active" },
      allowedViews: ["buyer", "supplier"],
      profileReadiness: {
        organizationUsable: true,
        buyerReady: true,
        supplierReady: true,
        missing: [],
      },
    });
  });

  it("returns an explicit state instead of selecting among active organizations", async () => {
    const { t, authenticated, userId } = await createOrganizationFixture();
    await t.run(async (ctx) => {
      const organizationId = await ctx.db.insert("organizations", {
        legalName: "Second Organization",
        capability: "supplier",
        status: "active",
        createdByUserId: userId,
        createdAt: 1_800_000_000_000,
        updatedAt: 1_800_000_000_000,
        version: 1n,
      });
      await ctx.db.insert("memberships", {
        userId,
        organizationId,
        role: "owner",
        status: "active",
        acceptedAt: 1_800_000_000_000,
        createdAt: 1_800_000_000_000,
        updatedAt: 1_800_000_000_000,
        version: 1n,
      });
    });

    await expect(authenticated.query(currentContext, {})).resolves.toMatchObject({
      kind: "multiple",
    });
  });

  it("applies versioned profile, contact, and address edits with one audit each", async () => {
    const { t, authenticated, organizationId, contactId, addressId } =
      await createOrganizationFixture();

    await expect(
      authenticated.mutation(updateProfile, {
        organizationId,
        expectedVersion: 1n,
        patch: { tradingName: "Acme" },
        requestId: "profile-1",
      }),
    ).resolves.toMatchObject({ updated: true, version: 2n });
    await expect(
      authenticated.mutation(updateProfile, {
        organizationId,
        expectedVersion: 1n,
        patch: { tradingName: "Old Acme" },
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "PROFILE_STALE" }),
    });
    await expect(
      authenticated.mutation(updatePrimaryContact, {
        organizationId,
        contactId,
        expectedVersion: 1n,
        patch: { jobTitle: "Managing Director" },
      }),
    ).resolves.toMatchObject({ updated: true, version: 2n });
    await expect(
      authenticated.mutation(updateAddress, {
        organizationId,
        addressId,
        expectedVersion: 1n,
        patch: { line2: "Suite 5" },
      }),
    ).resolves.toMatchObject({ updated: true, version: 2n });

    await expect(
      authenticated.query(getBusinessSettings, { organizationId }),
    ).resolves.toMatchObject({
      organization: { tradingName: "Acme", version: 2n },
      primaryContact: { jobTitle: "Managing Director", version: 2n },
      addresses: expect.arrayContaining([
        expect.objectContaining({ type: "registered", line2: "Suite 5", version: 2n }),
      ]),
    });
    await expect(
      t.run(async (ctx) => (await ctx.db.query("auditEvents").take(10)).length),
    ).resolves.toBe(3);
  });

  it("denies a foreign organization without revealing its child records", async () => {
    const { t, authenticated, userId } = await createOrganizationFixture();
    const foreignOrganizationId = await t.run(async (ctx) =>
      ctx.db.insert("organizations", {
        legalName: "Foreign Org",
        capability: "supplier",
        status: "active",
        createdByUserId: userId,
        createdAt: 1_800_000_000_000,
        updatedAt: 1_800_000_000_000,
        version: 1n,
      }),
    );

    await expect(
      authenticated.query(getBusinessSettings, { organizationId: foreignOrganizationId }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORGANIZATION_FORBIDDEN" }),
    });
  });
});
