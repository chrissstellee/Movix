/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const getDraft = makeFunctionReference<"query">("onboarding:getDraft");
const saveDraft = makeFunctionReference<"mutation">("onboarding:saveDraft");
const complete = makeFunctionReference<"mutation">("onboarding:complete");

async function createAuthenticatedTest(suffix = "a") {
  const t = convexTest(schema, modules);
  const now = 1_800_000_000_000;
  const tokenIdentifier = `https://movix.test|user-${suffix}`;
  const familyPublicId = `family-${suffix}`;
  await t.run(async (ctx) => {
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
      familyId: familyPublicId,
      userId,
      walletId,
      network: "testnet",
      currentCredentialHash: `credential-${suffix}`,
      absoluteExpiresAt: now + 600_000,
      createdAt: now,
      updatedAt: now,
    });
  });
  return {
    t,
    authenticated: t.withIdentity({
      subject: `user-${suffix}`,
      issuer: "https://movix.test",
      tokenIdentifier,
      session_family_id: familyPublicId,
    }),
  };
}

const identityPatch = {
  identity: {
    legalName: "Acme Supply Co.",
    tradingName: null,
    entityType: "corporation",
    registrationNumber: null,
    taxId: null,
    industry: null,
    website: "https://example.com",
    businessPhone: "+639171234567",
    registrationCountry: "PH",
    businessEmail: "Owner@EXAMPLE.COM",
    capability: "buyer_supplier",
    defaultTimezone: "Asia/Manila",
  },
} as const;

describe("business onboarding", () => {
  it("saves, resumes, and rejects stale draft writes", async () => {
    const { authenticated } = await createAuthenticatedTest();

    await expect(authenticated.query(getDraft, {})).resolves.toMatchObject({
      kind: "blank",
      version: 0n,
      currentStep: "identity",
    });
    await expect(
      authenticated.mutation(saveDraft, {
        expectedVersion: 0n,
        step: "identity",
        patch: identityPatch,
      }),
    ).resolves.toMatchObject({
      kind: "draft",
      version: 1n,
      currentStep: "contact",
      completedSteps: ["identity"],
    });
    await expect(authenticated.query(getDraft, {})).resolves.toMatchObject({
      kind: "draft",
      version: 1n,
      identity: {
        legalName: "Acme Supply Co.",
        businessEmail: "Owner@example.com",
      },
    });
    await expect(
      authenticated.mutation(saveDraft, {
        expectedVersion: 0n,
        step: "identity",
        patch: identityPatch,
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "DRAFT_STALE" }),
    });

    await expect(
      authenticated.mutation(saveDraft, {
        expectedVersion: 1n,
        step: "contact",
        patch: {
          contact: {
            type: "general",
            name: "Chris Owner",
            email: "chris@example.com",
            phone: "0917 123 4567",
            jobTitle: "Owner",
            department: null,
          },
        },
      }),
    ).resolves.toMatchObject({
      kind: "draft",
      version: 2n,
      contact: { phone: "+639171234567" },
    });
  });

  it("identifies an invalid contact field without echoing its value", async () => {
    const { authenticated } = await createAuthenticatedTest("contact-error");
    await authenticated.mutation(saveDraft, {
      expectedVersion: 0n,
      step: "identity",
      patch: identityPatch,
    });

    await expect(
      authenticated.mutation(saveDraft, {
        expectedVersion: 1n,
        step: "contact",
        patch: {
          contact: {
            type: "general",
            name: "Chris Owner",
            email: "chris@example.com",
            phone: "123",
            jobTitle: null,
            department: null,
          },
        },
      }),
    ).rejects.toMatchObject({
      data: {
        code: "DRAFT_INVALID",
        fields: {
          contactPhone: "Enter a valid phone number for PH.",
        },
      },
    });
  });

  it.each([
    [
      "businessEmail",
      { businessEmail: "owner@localhost" },
      "Enter a valid business email address.",
    ],
    ["website", { website: "example.com" }, "Enter a complete http:// or https:// website URL."],
    [
      "businessPhone",
      { businessPhone: "123" },
      "Enter a valid phone number for the registration country.",
    ],
  ] as const)(
    "identifies an invalid identity %s without echoing its value",
    async (field, identityOverride, message) => {
      const { authenticated } = await createAuthenticatedTest(`identity-${field}`);

      await expect(
        authenticated.mutation(saveDraft, {
          expectedVersion: 0n,
          step: "identity",
          patch: {
            identity: {
              ...identityPatch.identity,
              ...identityOverride,
            },
          },
        }),
      ).rejects.toMatchObject({
        data: {
          code: "DRAFT_INVALID",
          fields: { [field]: message },
        },
      });
    },
  );

  it("atomically completes one organization and returns the same result for a retry", async () => {
    const { t, authenticated } = await createAuthenticatedTest();
    await authenticated.mutation(saveDraft, {
      expectedVersion: 0n,
      step: "identity",
      patch: identityPatch,
    });
    await authenticated.mutation(saveDraft, {
      expectedVersion: 1n,
      step: "contact",
      patch: {
        contact: {
          type: "general",
          name: "Alex Owner",
          email: "alex@example.com",
          phone: null,
          jobTitle: "Owner",
          department: null,
        },
      },
    });
    await authenticated.mutation(saveDraft, {
      expectedVersion: 2n,
      step: "address",
      patch: {
        address: {
          registeredAddress: {
            recipientName: "Acme Supply Co.",
            line1: "123 Main Street",
            line2: null,
            city: "Makati",
            region: "Metro Manila",
            postalCode: "1200",
            countryCode: "PH",
            deliveryInstructions: null,
          },
          sameBillingAsRegistered: true,
          sameShippingAsRegistered: true,
          billingAddress: null,
          shippingAddress: null,
        },
      },
    });
    await authenticated.mutation(saveDraft, {
      expectedVersion: 3n,
      step: "preferences",
      patch: {
        preferences: { capability: "buyer_supplier", defaultTimezone: "Asia/Manila" },
      },
    });

    const args = {
      expectedDraftVersion: 4n,
      completionKey: "completion-key-0001",
      attestationVersion: "business-profile-v1",
    };
    const [first, concurrentRetry] = await Promise.all([
      authenticated.mutation(complete, args),
      authenticated.mutation(complete, args),
    ]);
    expect(concurrentRetry).toEqual(first);
    await expect(authenticated.mutation(complete, args)).resolves.toEqual(first);
    await expect(
      authenticated.mutation(complete, { ...args, completionKey: "different-key" }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ONBOARDING_ALREADY_COMPLETED" }),
    });

    const counts = await t.run(async (ctx) => ({
      organizations: (await ctx.db.query("organizations").take(10)).length,
      memberships: (await ctx.db.query("memberships").take(10)).length,
      contacts: (await ctx.db.query("contacts").take(10)).length,
      addresses: (await ctx.db.query("addresses").take(10)).length,
      audits: (await ctx.db.query("auditEvents").take(10)).length,
    }));
    expect(counts).toEqual({
      organizations: 1,
      memberships: 1,
      contacts: 1,
      addresses: 3,
      audits: 2,
    });
  });

  it("never exposes one user's draft to another authenticated user", async () => {
    const { t, authenticated } = await createAuthenticatedTest("owner");
    await authenticated.mutation(saveDraft, {
      expectedVersion: 0n,
      step: "identity",
      patch: identityPatch,
    });

    const now = 1_800_000_000_000;
    const tokenIdentifier = "https://movix.test|user-other";
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        primaryWallet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        tokenIdentifier,
        status: "active",
        timezone: "UTC",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      const walletId = await ctx.db.insert("wallets", {
        userId,
        address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        network: "testnet",
        verifiedAt: now,
        createdAt: now,
      });
      await ctx.db.insert("authSessionFamilies", {
        familyId: "family-other",
        userId,
        walletId,
        network: "testnet",
        currentCredentialHash: "credential-other",
        absoluteExpiresAt: now + 600_000,
        createdAt: now,
        updatedAt: now,
      });
    });
    const other = t.withIdentity({
      subject: "user-other",
      issuer: "https://movix.test",
      tokenIdentifier,
      session_family_id: "family-other",
    });
    await expect(other.query(getDraft, {})).resolves.toMatchObject({ kind: "blank" });
  });
});
