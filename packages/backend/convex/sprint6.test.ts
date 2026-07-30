/// <reference types="vite/client" />

import { runToCompletion } from "@convex-dev/migrations";
import migrationsComponent from "@convex-dev/migrations/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, components, internal } from "./_generated/api";
import schema from "./schema";

import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

const wallets = {
  importer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  exporter: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  wrongExporter: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCDLM",
  foreign: "GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDWWL",
} as const;

async function createParty(
  t: ReturnType<typeof convexTest>,
  input: {
    suffix: string;
    wallet: string;
    capability: "buyer" | "supplier" | "buyer_supplier";
    verificationStatus?: "unverified" | "verified";
  },
) {
  const now = Date.now();
  const tokenIdentifier = `https://movix.test|sprint6-${input.suffix}`;
  const familyId = `sprint6-family-${input.suffix}`;
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      primaryWallet: input.wallet,
      tokenIdentifier,
      status: "active",
      timezone: "Asia/Manila",
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const walletId = await ctx.db.insert("wallets", {
      userId,
      address: input.wallet,
      network: "testnet",
      verifiedAt: now,
      createdAt: now,
    });
    await ctx.db.insert("authSessionFamilies", {
      familyId,
      userId,
      walletId,
      network: "testnet",
      currentCredentialHash: `sprint6-credential-${input.suffix}`,
      absoluteExpiresAt: now + 600_000,
      createdAt: now,
      updatedAt: now,
    });
    const organizationId = await ctx.db.insert("organizations", {
      legalName: `${input.suffix} Agricultural Trading`,
      tradingName: input.suffix,
      normalizedLegalName: `${input.suffix} agricultural trading`,
      registrationCountry: "PH",
      businessEmail: `${input.suffix}@example.com`,
      capability: input.capability,
      defaultTimezone: "Asia/Manila",
      status: "active",
      verificationStatus: input.verificationStatus ?? "verified",
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
      type: input.capability === "supplier" ? "sales" : "procurement",
      name: `${input.suffix} Owner`,
      email: `${input.suffix}.owner@example.com`,
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const addresses: Record<"registered" | "billing" | "shipping", Id<"addresses">> = {} as Record<
      "registered" | "billing" | "shipping",
      Id<"addresses">
    >;
    for (const type of ["registered", "billing", "shipping"] as const) {
      addresses[type] = await ctx.db.insert("addresses", {
        organizationId,
        type,
        label: type,
        recipientName: `${input.suffix} Agricultural Trading`,
        line1: "100 Trade Avenue",
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
    return { userId, organizationId, contactId, addresses };
  });
  return {
    ...ids,
    authenticated: t.withIdentity({
      subject: `sprint6-${input.suffix}`,
      issuer: "https://movix.test",
      tokenIdentifier,
      session_family_id: familyId,
    }),
  };
}

async function createTradeFixture() {
  const t = convexTest(schema, modules);
  const importer = await createParty(t, {
    suffix: "importer",
    wallet: wallets.importer,
    capability: "buyer",
  });
  const exporter = await createParty(t, {
    suffix: "exporter",
    wallet: wallets.exporter,
    capability: "supplier",
  });
  const wrongExporter = await createParty(t, {
    suffix: "wrong-exporter",
    wallet: wallets.wrongExporter,
    capability: "supplier",
  });
  const foreign = await createParty(t, {
    suffix: "foreign",
    wallet: wallets.foreign,
    capability: "buyer",
  });
  return { t, importer, exporter, wrongExporter, foreign };
}

async function createCompleteV2Draft(fixture: Awaited<ReturnType<typeof createTradeFixture>>) {
  const created = await fixture.importer.authenticated.mutation(api.orderDrafts.create, {
    idempotencyKey: "sprint6-create-v2-draft",
    termsHashVersion: "order-terms-v2",
  });
  await fixture.importer.authenticated.mutation(api.orderDrafts.saveSupplier, {
    orderId: created.orderId,
    expectedVersion: 1n,
    target: { kind: "wallet", walletAddress: wallets.exporter },
  });
  await fixture.importer.authenticated.mutation(api.orderDrafts.saveHeader, {
    orderId: created.orderId,
    expectedVersion: 2n,
    purchaseOrderNumber: "ASEAN-RICE-0001",
    title: "Philippine milled rice import",
    description: "Exact agricultural Trade Order fixture",
    buyerContactId: fixture.importer.contactId,
    billingAddressId: fixture.importer.addresses.billing,
    shippingAddressId: fixture.importer.addresses.shipping,
    orderDate: "2026-07-29",
    issueDate: "2026-07-29",
    requestedDeliveryDate: "2026-09-30",
    supplierAcceptanceDeadline: Date.now() + 86_400_000,
    fundingDeadline: Date.now() + 172_800_000,
    assetKey: "testnet:USDC",
  });
  await fixture.importer.authenticated.mutation(api.orderDrafts.upsertLine, {
    orderId: created.orderId,
    expectedVersion: 3n,
    line: {
      lineNumber: 1n,
      name: "Milled rice",
      category: "rice",
      varietyOrGrade: "5% broken",
      specification: "2026 crop, export quality",
      originCountry: "VN",
      packaging: "50 KG bags",
      quantityCoefficient: 25_000n,
      quantityScale: 0n,
      unitOfMeasure: "KG",
      unitPriceBaseUnits: 650_000n,
      discountKind: "none",
      taxBps: 0n,
      requiresInspection: true,
    },
  });
  await fixture.importer.authenticated.mutation(api.orderDrafts.saveTerms, {
    orderId: created.orderId,
    expectedVersion: 4n,
    deliveryMethod: "ocean freight",
    shippingResponsibility: "exporter",
    freightChargeTreatment: "included",
    inspectionPeriodHours: 72n,
    refundPolicy: "Refund if the accepted specification is not met.",
    shippingTotalBaseUnits: 1_000_000n,
    acceptanceCriteria: "Quantity, grade, and document set must match.",
  });
  const completed = await fixture.importer.authenticated.mutation(
    api.orderDrafts.saveAgriculturalTerms,
    {
      orderId: created.orderId,
      expectedVersion: 5n,
      destinationCountry: "PH",
      shipmentWindow: { from: "2026-08-15", to: "2026-08-31" },
      arrivalWindow: { from: "2026-09-01", to: "2026-09-30" },
      incoterm: { edition: "2020", rule: "CIF", namedPlace: "Port of Manila" },
      requiredDocumentTypes: ["commercial_invoice", "phytosanitary_certificate"],
    },
  );
  return {
    orderId: created.orderId,
    revisionId: created.revisionId,
    revisionVersion: completed.version,
  };
}

describe("Sprint 6 organization verification", () => {
  it("submits evidence, audits internal review, and rejects stale transitions", async () => {
    const t = convexTest(schema, modules);
    const organization = await createParty(t, {
      suffix: "verification",
      wallet: wallets.importer,
      capability: "buyer",
      verificationStatus: "unverified",
    });

    const submitted = await organization.authenticated.mutation(
      api.organizationVerification.submit,
      {
        organizationId: organization.organizationId,
        evidenceDigest: "a".repeat(64),
        evidenceReference: "private://verification/case-001",
        expectedOrganizationVersion: 1n,
      },
    );
    expect(submitted).toMatchObject({
      status: "pending",
      organizationVersion: 2n,
    });
    await expect(
      t.mutation(internal.organizationVerification.review, {
        caseId: submitted.caseId,
        expectedVersion: 0n,
        status: "verified",
        reviewer: "QA Operator",
        correlationId: "sprint6-review-stale",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORGANIZATION_VERIFICATION_STALE" }),
    });
    await expect(
      t.mutation(internal.organizationVerification.review, {
        caseId: submitted.caseId,
        expectedVersion: 1n,
        status: "verified",
        reviewer: "QA Operator",
        correlationId: "sprint6-review-success",
      }),
    ).resolves.toEqual({ status: "verified", caseVersion: 2n });
    await expect(
      t.mutation(internal.organizationVerification.review, {
        caseId: submitted.caseId,
        expectedVersion: 2n,
        status: "action_required",
        reviewer: "QA Operator",
        reasonCode: "DOCUMENT_EXPIRED",
        correlationId: "sprint6-review-reuse",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORGANIZATION_VERIFICATION_INVALID" }),
    });

    const state = await t.run(async (ctx) => ({
      organization: await ctx.db.get("organizations", organization.organizationId),
      verificationCase: await ctx.db.get("organizationVerificationCases", submitted.caseId),
      audits: (await ctx.db.query("auditEvents").take(20)).filter(
        (event) => event.entityId === submitted.caseId,
      ),
    }));
    expect(state.organization).toMatchObject({
      verificationStatus: "verified",
      version: 3n,
    });
    expect(state.verificationCase).toMatchObject({
      status: "verified",
      evidenceDigest: "a".repeat(64),
      reviewedBy: "QA Operator",
      version: 2n,
    });
    expect(state.audits.map((event) => event.action)).toEqual([
      "organization.verification_submitted",
      "organization.verification_verified",
    ]);
    expect(state.audits[1]).toMatchObject({ correlationId: "sprint6-review-success" });
  });

  it("allows an authenticated owner to self-verify only when the development flag is enabled", async () => {
    const t = convexTest(schema, modules);
    const organization = await createParty(t, {
      suffix: "development-verification",
      wallet: wallets.importer,
      capability: "buyer",
      verificationStatus: "unverified",
    });

    await expect(
      organization.authenticated.mutation(api.organizationVerification.verifyForDevelopment, {
        organizationId: organization.organizationId,
        expectedOrganizationVersion: 1n,
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORGANIZATION_VERIFICATION_INVALID" }),
    });

    const previousFlag = process.env.MOVIX_ENABLE_DEVELOPMENT_SELF_VERIFICATION;
    process.env.MOVIX_ENABLE_DEVELOPMENT_SELF_VERIFICATION = "enabled";
    try {
      await expect(
        organization.authenticated.query(api.organizationVerification.developmentOptions, {}),
      ).resolves.toEqual({ selfVerificationAvailable: true });
      const verified = await organization.authenticated.mutation(
        api.organizationVerification.verifyForDevelopment,
        {
          organizationId: organization.organizationId,
          expectedOrganizationVersion: 1n,
        },
      );
      expect(verified).toMatchObject({
        status: "verified",
        organizationVersion: 2n,
        caseId: expect.any(String),
      });

      const state = await t.run(async (ctx) => ({
        organization: await ctx.db.get("organizations", organization.organizationId),
        verificationCase: await ctx.db.get("organizationVerificationCases", verified.caseId),
        audits: (await ctx.db.query("auditEvents").take(20)).filter(
          (event) => event.entityId === verified.caseId,
        ),
      }));
      expect(state.organization).toMatchObject({
        verificationStatus: "verified",
        verificationCaseId: verified.caseId,
        version: 2n,
      });
      expect(state.verificationCase).toMatchObject({
        organizationId: organization.organizationId,
        status: "verified",
        reviewedBy: "Movix development self-verification",
        version: 1n,
      });
      expect(state.audits).toEqual([
        expect.objectContaining({
          action: "organization.verification_development_verified",
        }),
      ]);
    } finally {
      if (previousFlag === undefined) {
        delete process.env.MOVIX_ENABLE_DEVELOPMENT_SELF_VERIFICATION;
      } else {
        process.env.MOVIX_ENABLE_DEVELOPMENT_SELF_VERIFICATION = previousFlag;
      }
    }
  });
});

describe("Sprint 6 development fixtures", () => {
  it("seeds three complete editable Trade Order drafts idempotently through normal APIs", async () => {
    const fixture = await createTradeFixture();
    await fixture.t.run((ctx) =>
      ctx.db.insert("relationships", {
        buyerOrganizationId: fixture.importer.organizationId,
        supplierOrganizationId: fixture.exporter.organizationId,
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1n,
      }),
    );
    const previousFlag = process.env.MOVIX_ENABLE_DEVELOPMENT_FIXTURES;
    process.env.MOVIX_ENABLE_DEVELOPMENT_FIXTURES = "enabled";
    try {
      const args = { batchId: "sprint6-development-fixtures-001" };
      const seeded = await fixture.importer.authenticated.action(
        api.developmentFixtures.seedTradeOrders,
        args,
      );
      expect(seeded.orders).toHaveLength(3);
      expect(seeded.replay).toBe(false);
      const replayed = await fixture.importer.authenticated.action(
        api.developmentFixtures.seedTradeOrders,
        args,
      );
      expect(replayed).toEqual({ ...seeded, replay: true });

      const state = await fixture.t.run(async (ctx) =>
        Promise.all(
          seeded.orders.map(async ({ orderId }) => {
            const order = await ctx.db.get("orders", orderId);
            const revision = order?.currentRevisionId
              ? await ctx.db.get("orderRevisions", order.currentRevisionId)
              : null;
            const lines = revision
              ? await ctx.db
                  .query("orderLines")
                  .withIndex("by_revisionId", (index) => index.eq("revisionId", revision._id))
                  .take(10)
              : [];
            return { order, revision, lines };
          }),
        ),
      );
      expect(state).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            order: expect.objectContaining({
              agreementStatus: "draft",
              supplierOrganizationId: fixture.exporter.organizationId,
              migrationState: "current",
            }),
            revision: expect.objectContaining({
              termsHashVersion: "order-terms-v2",
              destinationCountry: "PH",
            }),
            lines: [expect.objectContaining({ originCountry: expect.any(String) })],
          }),
        ]),
      );
    } finally {
      if (previousFlag === undefined) {
        delete process.env.MOVIX_ENABLE_DEVELOPMENT_FIXTURES;
      } else {
        process.env.MOVIX_ENABLE_DEVELOPMENT_FIXTURES = previousFlag;
      }
    }
  });
});

describe("Sprint 6 intended Exporter invitations", () => {
  it("accepts once and reports duplicate, wrong-org, revoked, and expired states deterministically", async () => {
    const fixture = await createTradeFixture();
    const expiresAt = Date.now() + 86_400_000;
    const issued = await fixture.importer.authenticated.mutation(api.exporterInvitations.issue, {
      intendedExporterOrganizationId: fixture.exporter.organizationId,
      targetEmail: "EXPORTER@example.com",
      expiresAt,
    });

    await expect(
      fixture.importer.authenticated.mutation(api.exporterInvitations.issue, {
        intendedExporterOrganizationId: fixture.exporter.organizationId,
        expiresAt,
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "EXPORTER_INVITATION_DUPLICATE" }),
    });
    await expect(
      fixture.wrongExporter.authenticated.mutation(api.exporterInvitations.accept, {
        token: issued.token,
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "EXPORTER_INVITATION_WRONG_ORGANIZATION" }),
    });
    const accepted = await fixture.exporter.authenticated.mutation(api.exporterInvitations.accept, {
      token: issued.token,
    });
    expect(accepted).toMatchObject({
      invitationId: issued.invitation.invitationId,
      status: "accepted",
      intendedExporterOrganizationId: fixture.exporter.organizationId,
      relationshipId: expect.any(String),
    });
    await expect(
      fixture.exporter.authenticated.mutation(api.exporterInvitations.accept, {
        token: issued.token,
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "EXPORTER_INVITATION_USED" }),
    });

    const revoked = await fixture.importer.authenticated.mutation(api.exporterInvitations.issue, {
      intendedExporterOrganizationId: fixture.exporter.organizationId,
      expiresAt,
    });
    await expect(
      fixture.importer.authenticated.mutation(api.exporterInvitations.revoke, {
        invitationId: revoked.invitation.invitationId,
        expectedVersion: 1n,
      }),
    ).resolves.toMatchObject({ status: "revoked" });
    await expect(
      fixture.exporter.authenticated.mutation(api.exporterInvitations.accept, {
        token: revoked.token,
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "EXPORTER_INVITATION_REVOKED" }),
    });

    const expired = await fixture.importer.authenticated.mutation(api.exporterInvitations.issue, {
      intendedExporterOrganizationId: fixture.exporter.organizationId,
      expiresAt,
    });
    await fixture.t.run((ctx) =>
      ctx.db.patch("exporterInvitations", expired.invitation.invitationId, {
        expiresAt: Date.now() - 1,
      }),
    );
    await expect(
      fixture.exporter.authenticated.query(api.exporterInvitations.getByToken, {
        token: expired.token,
      }),
    ).resolves.toMatchObject({ status: "expired" });
    await expect(
      fixture.exporter.authenticated.mutation(api.exporterInvitations.accept, {
        token: expired.token,
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "EXPORTER_INVITATION_EXPIRED" }),
    });
  });
});

describe("Sprint 6 agricultural terms and material revisions", () => {
  it("serializes a simultaneous material edit and revision issue", async () => {
    const fixture = await createTradeFixture();
    const draft = await createCompleteV2Draft(fixture);
    const results = await Promise.allSettled([
      fixture.importer.authenticated.mutation(api.orders.send, {
        orderId: draft.orderId,
        expectedVersion: draft.revisionVersion,
        idempotencyKey: "sprint6-edit-issue-race",
      }),
      fixture.importer.authenticated.mutation(api.orderDrafts.upsertLine, {
        orderId: draft.orderId,
        expectedVersion: draft.revisionVersion,
        line: {
          lineNumber: 1n,
          name: "Milled rice",
          category: "rice",
          varietyOrGrade: "5% broken",
          specification: "2026 crop, export quality",
          originCountry: "VN",
          packaging: "50 KG bags",
          quantityCoefficient: 30_000n,
          quantityScale: 0n,
          unitOfMeasure: "KG",
          unitPriceBaseUnits: 650_000n,
          discountKind: "none",
          taxBps: 0n,
          requiresInspection: true,
        },
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const state = await fixture.t.run(async (ctx) => ({
      order: await ctx.db.get("orders", draft.orderId),
      revision: await ctx.db.get("orderRevisions", draft.revisionId),
      receipts: await ctx.db
        .query("orderCommandReceipts")
        .withIndex("by_orderId_and_commandType", (index) =>
          index.eq("orderId", draft.orderId).eq("commandType", "send"),
        )
        .collect(),
    }));
    if (state.order?.agreementStatus === "sent") {
      expect(state.revision?.frozenAt).toEqual(expect.any(Number));
      expect(state.receipts).toHaveLength(1);
    } else {
      expect(state.order?.agreementStatus).toBe("draft");
      expect(state.revision?.frozenAt).toBeUndefined();
      expect(state.receipts).toHaveLength(0);
    }
  }, 15_000);

  it("hashes v2 fields and requires the Exporter to accept the material N+1 revision", async () => {
    const fixture = await createTradeFixture();
    const draft = await createCompleteV2Draft(fixture);
    const firstReview = await fixture.importer.authenticated.query(api.orderDrafts.getReview, {
      orderId: draft.orderId,
    });
    expect(firstReview).toMatchObject({
      complete: true,
      blockers: [],
      revision: {
        termsHashVersion: "order-terms-v2",
        destinationCountry: "PH",
        shipmentWindowFrom: "2026-08-15",
        shipmentWindowTo: "2026-08-31",
        arrivalWindowFrom: "2026-09-01",
        arrivalWindowTo: "2026-09-30",
        incotermEdition: "2020",
        incotermRule: "CIF",
        incotermNamedPlace: "Port of Manila",
        requiredDocumentTypes: ["commercial_invoice", "phytosanitary_certificate"],
      },
      lines: [
        expect.objectContaining({
          name: "Milled rice",
          originCountry: "VN",
          quantityCoefficient: 25_000n,
          unitOfMeasure: "KG",
        }),
      ],
      termsHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });

    const sent = await fixture.importer.authenticated.mutation(api.orders.send, {
      orderId: draft.orderId,
      expectedVersion: draft.revisionVersion,
      idempotencyKey: "sprint6-send-revision-1",
    });
    const firstAcceptance = await fixture.exporter.authenticated.mutation(
      api.orderDecisions.accept,
      {
        orderId: draft.orderId,
        revisionId: draft.revisionId,
        expectedOrderVersion: sent.orderVersion,
        expectedRevisionVersion: sent.revisionVersion,
        expectedTermsHash: firstReview.termsHash!,
        idempotencyKey: "sprint6-accept-revision-1",
      },
    );
    const next = await fixture.importer.authenticated.mutation(
      api.orderRevisions.startFromCurrent,
      {
        orderId: draft.orderId,
        expectedOrderVersion: firstAcceptance.orderVersion,
        expectedRevisionId: draft.revisionId,
        idempotencyKey: "sprint6-start-revision-2",
      },
    );
    const invalidated = await fixture.t.run((ctx) => ctx.db.get("orders", draft.orderId));
    expect(invalidated).toMatchObject({
      agreementStatus: "draft",
      currentRevisionId: next.revisionId,
      currentRevisionNumber: 2n,
    });
    expect(invalidated?.acceptedRevisionId).toBeUndefined();
    expect(invalidated?.currentDecisionId).toBeUndefined();

    const materialEdit = await fixture.importer.authenticated.mutation(api.orderDrafts.upsertLine, {
      orderId: draft.orderId,
      expectedVersion: next.revisionVersion,
      line: {
        lineNumber: 1n,
        name: "Milled rice",
        category: "rice",
        varietyOrGrade: "5% broken",
        specification: "2026 crop, export quality",
        originCountry: "VN",
        packaging: "50 KG bags",
        quantityCoefficient: 30_000n,
        quantityScale: 0n,
        unitOfMeasure: "KG",
        unitPriceBaseUnits: 650_000n,
        discountKind: "none",
        taxBps: 0n,
        requiresInspection: true,
      },
    });
    const secondReview = await fixture.importer.authenticated.query(api.orderDrafts.getReview, {
      orderId: draft.orderId,
    });
    expect(secondReview.complete).toBe(true);
    expect(secondReview.termsHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(secondReview.termsHash).not.toBe(firstReview.termsHash);
    const resent = await fixture.importer.authenticated.mutation(api.orders.send, {
      orderId: draft.orderId,
      expectedVersion: materialEdit.version,
      idempotencyKey: "sprint6-send-revision-2",
    });
    await expect(
      fixture.exporter.authenticated.mutation(api.orderDecisions.accept, {
        orderId: draft.orderId,
        revisionId: draft.revisionId,
        expectedOrderVersion: resent.orderVersion,
        expectedRevisionVersion: sent.revisionVersion,
        expectedTermsHash: firstReview.termsHash!,
        idempotencyKey: "sprint6-reuse-revision-1-acceptance",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORDER_REVISION_MISMATCH" }),
    });
    await expect(
      fixture.exporter.authenticated.mutation(api.orderDecisions.accept, {
        orderId: draft.orderId,
        revisionId: next.revisionId,
        expectedOrderVersion: resent.orderVersion,
        expectedRevisionVersion: resent.revisionVersion,
        expectedTermsHash: secondReview.termsHash!,
        idempotencyKey: "sprint6-accept-revision-2",
      }),
    ).resolves.toMatchObject({
      decision: "accepted",
      revisionId: next.revisionId,
    });
  });
});

describe("Sprint 6 migration compatibility", () => {
  it("backfills v1 hash identity and legacy-incomplete state idempotently", async () => {
    const t = convexTest(schema, modules);
    migrationsComponent.register(t);
    let orderId!: Id<"orders">;
    let revisionId!: Id<"orderRevisions">;
    await t.run(async (ctx) => {
      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        primaryWallet: wallets.importer,
        status: "active",
        timezone: "UTC",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      const organizationId = await ctx.db.insert("organizations", {
        legalName: "Legacy Importer",
        capability: "buyer",
        status: "active",
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      orderId = await ctx.db.insert("orders", {
        buyerOrganizationId: organizationId,
        currentRevisionNumber: 1n,
        grandTotalBaseUnits: 100n,
        agreementStatus: "draft",
        fulfillmentStatus: "not_started",
        settlementStatus: "unfunded",
        sortTimestamp: now,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      revisionId = await ctx.db.insert("orderRevisions", {
        orderId,
        revisionNumber: 1n,
        buyerOrganizationId: organizationId,
        buyerLegalNameSnapshot: "Legacy Importer",
        subtotalBaseUnits: 100n,
        discountTotalBaseUnits: 0n,
        taxTotalBaseUnits: 0n,
        shippingTotalBaseUnits: 0n,
        grandTotalBaseUnits: 100n,
        paymentMode: "escrow",
        autoReleasePolicy: "none",
        termsHash: "b".repeat(64),
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      await ctx.db.patch("orders", orderId, { currentRevisionId: revisionId });
    });

    const orderRuns = await Promise.allSettled([
      t.run((ctx) =>
        runToCompletion(ctx, components.migrations, internal.migrations.backfillSprint6Orders),
      ),
      t.run((ctx) =>
        runToCompletion(ctx, components.migrations, internal.migrations.backfillSprint6Orders),
      ),
    ]);
    expect(orderRuns.filter((result) => result.status === "fulfilled").length).toBeGreaterThan(0);
    const revisionRuns = await Promise.allSettled([
      t.run((ctx) =>
        runToCompletion(
          ctx,
          components.migrations,
          internal.migrations.backfillSprint6OrderRevisions,
        ),
      ),
      t.run((ctx) =>
        runToCompletion(
          ctx,
          components.migrations,
          internal.migrations.backfillSprint6OrderRevisions,
        ),
      ),
    ]);
    expect(revisionRuns.filter((result) => result.status === "fulfilled").length).toBeGreaterThan(
      0,
    );
    await t.run(async (ctx) => {
      await runToCompletion(ctx, components.migrations, internal.migrations.backfillSprint6Orders);
      await runToCompletion(
        ctx,
        components.migrations,
        internal.migrations.backfillSprint6OrderRevisions,
      );
    });
    const state = await t.run(async (ctx) => ({
      order: await ctx.db.get("orders", orderId),
      revision: await ctx.db.get("orderRevisions", revisionId),
    }));
    expect(state.order).toMatchObject({
      migrationState: "legacy_incomplete",
      currentRevisionId: revisionId,
      version: 1n,
    });
    expect(state.revision).toMatchObject({
      termsHashVersion: "order-terms-v1",
      migrationState: "legacy_incomplete",
      termsHash: "b".repeat(64),
      version: 1n,
    });
  });

  it("reports an orphan revision once and exposes it in the migration preview", async () => {
    const t = convexTest(schema, modules);
    migrationsComponent.register(t);
    const revisionId = await t.run(async (ctx) => {
      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        primaryWallet: wallets.importer,
        status: "active",
        timezone: "UTC",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      const organizationId = await ctx.db.insert("organizations", {
        legalName: "Orphan Fixture Importer",
        capability: "buyer",
        status: "active",
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      const orderId = await ctx.db.insert("orders", {
        buyerOrganizationId: organizationId,
        currentRevisionNumber: 1n,
        grandTotalBaseUnits: 100n,
        agreementStatus: "draft",
        fulfillmentStatus: "not_started",
        settlementStatus: "unfunded",
        sortTimestamp: now,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      const id = await ctx.db.insert("orderRevisions", {
        orderId,
        revisionNumber: 1n,
        buyerOrganizationId: organizationId,
        buyerLegalNameSnapshot: "Orphan Fixture Importer",
        subtotalBaseUnits: 100n,
        discountTotalBaseUnits: 0n,
        taxTotalBaseUnits: 0n,
        shippingTotalBaseUnits: 0n,
        grandTotalBaseUnits: 100n,
        paymentMode: "escrow",
        autoReleasePolicy: "none",
        termsHash: "c".repeat(64),
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      await ctx.db.delete("orders", orderId);
      return id;
    });

    for (let pass = 0; pass < 2; pass += 1) {
      await t.run((ctx) =>
        runToCompletion(
          ctx,
          components.migrations,
          internal.migrations.backfillSprint6OrderRevisions,
        ),
      );
    }

    const preview = await t.query(internal.migrations.sprint6RevisionMigrationInventory, {
      paginationOpts: { numItems: 20, cursor: null },
    });
    const state = await t.run(async (ctx) => ({
      revision: await ctx.db.get("orderRevisions", revisionId),
      reports: await ctx.db
        .query("migrationFailureReports")
        .withIndex("by_documentId", (index) => index.eq("documentId", revisionId))
        .collect(),
    }));

    expect(preview.page).toContainEqual(
      expect.objectContaining({
        revisionId,
        orderExists: false,
        wouldWrite: false,
        actionableFailure: "ORPHAN_REVISION",
      }),
    );
    expect(state.revision).toMatchObject({
      termsHash: "c".repeat(64),
      version: 1n,
    });
    expect(state.reports).toHaveLength(1);
    expect(state.reports[0]).toMatchObject({
      migration: "backfillSprint6OrderRevisions",
      code: "ORPHAN_REVISION",
    });
  }, 15_000);
});

describe("Sprint 6 shipment and Trade Document tenant isolation", () => {
  it("allows only order participants to enumerate shipment and document metadata", async () => {
    const fixture = await createTradeFixture();
    const ids = await fixture.t.run(async (ctx) => {
      const now = Date.now();
      const orderId = await ctx.db.insert("orders", {
        buyerOrganizationId: fixture.importer.organizationId,
        supplierOrganizationId: fixture.exporter.organizationId,
        currentRevisionNumber: 1n,
        grandTotalBaseUnits: 1_000n,
        agreementStatus: "accepted",
        fulfillmentStatus: "not_started",
        settlementStatus: "unfunded",
        supplierQueueState: "accepted",
        sortTimestamp: now,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      const shipmentId = await ctx.db.insert("shipments", {
        orderId,
        buyerOrganizationId: fixture.importer.organizationId,
        supplierOrganizationId: fixture.exporter.organizationId,
        status: "draft",
        shipmentHash: "c".repeat(64),
        createdByUserId: fixture.exporter.userId,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      await ctx.db.insert("shipmentEvents", {
        shipmentId,
        orderId,
        status: "draft",
        actorOrganizationId: fixture.exporter.organizationId,
        actorUserId: fixture.exporter.userId,
        occurredAt: now,
      });
      await ctx.db.insert("tradeDocuments", {
        orderId,
        importerOrganizationId: fixture.importer.organizationId,
        exporterOrganizationId: fixture.exporter.organizationId,
        documentType: "commercial_invoice",
        visibility: "participants",
        currentVersionNumber: 0n,
        createdByUserId: fixture.exporter.userId,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      await ctx.db.insert("tradeDocuments", {
        orderId,
        importerOrganizationId: fixture.importer.organizationId,
        exporterOrganizationId: fixture.exporter.organizationId,
        documentType: "import_permit",
        visibility: "importer",
        currentVersionNumber: 0n,
        createdByUserId: fixture.importer.userId,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      return { orderId };
    });

    await expect(
      fixture.importer.authenticated.query(api.shipments.get, { orderId: ids.orderId }),
    ).resolves.toMatchObject({
      shipment: { status: "draft", shipmentHash: "c".repeat(64) },
      events: [expect.objectContaining({ status: "draft" })],
    });
    await expect(
      fixture.exporter.authenticated.query(api.tradeDocuments.list, {
        orderId: ids.orderId,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ documentType: "commercial_invoice", versions: [] }),
    ]);
    await expect(
      fixture.importer.authenticated.query(api.tradeDocuments.list, {
        orderId: ids.orderId,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ documentType: "commercial_invoice" }),
      expect.objectContaining({ documentType: "import_permit" }),
    ]);
    await expect(
      fixture.foreign.authenticated.query(api.shipments.get, { orderId: ids.orderId }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "TRADE_DOCUMENT_FORBIDDEN" }),
    });
    await expect(
      fixture.foreign.authenticated.query(api.tradeDocuments.list, {
        orderId: ids.orderId,
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "TRADE_DOCUMENT_FORBIDDEN" }),
    });
  });
});
