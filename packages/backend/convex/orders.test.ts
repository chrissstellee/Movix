/// <reference types="vite/client" />

import { testnetUsdc } from "@repo/domain/fixtures";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const resolveExact = makeFunctionReference<"query">("supplierDirectory:resolveExact");
const createDraft = makeFunctionReference<"mutation">("orderDrafts:create");
const getDraft = makeFunctionReference<"query">("orderDrafts:get");
const saveSupplier = makeFunctionReference<"mutation">("orderDrafts:saveSupplier");
const saveHeader = makeFunctionReference<"mutation">("orderDrafts:saveHeader");
const saveTerms = makeFunctionReference<"mutation">("orderDrafts:saveTerms");
const upsertLine = makeFunctionReference<"mutation">("orderDrafts:upsertLine");
const getReview = makeFunctionReference<"query">("orderDrafts:getReview");
const send = makeFunctionReference<"mutation">("orders:send");
const getById = makeFunctionReference<"query">("orders:getById");
const listBuyerOrders = makeFunctionReference<"query">("orders:listBuyerOrders");
const cancel = makeFunctionReference<"mutation">("orders:cancel");
const getBuyerSummary = makeFunctionReference<"query">("orderDashboard:getBuyerSummary");

const buyerWallet = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const supplierWallet = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const foreignWallet = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCDLM";

async function createParty(
  t: ReturnType<typeof convexTest>,
  input: {
    suffix: string;
    wallet: string;
    capability: "buyer" | "supplier";
    role?: "owner" | "viewer";
  },
) {
  const now = Date.now();
  const tokenIdentifier = `https://movix.test|${input.suffix}`;
  const familyPublicId = `family-${input.suffix}`;
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
      familyId: familyPublicId,
      userId,
      walletId,
      network: "testnet",
      currentCredentialHash: `credential-${input.suffix}`,
      absoluteExpiresAt: now + 600_000,
      createdAt: now,
      updatedAt: now,
    });
    const organizationId = await ctx.db.insert("organizations", {
      legalName: `${input.suffix} Incorporated`,
      tradingName: input.suffix,
      normalizedLegalName: `${input.suffix} incorporated`,
      registrationCountry: "PH",
      businessEmail: `${input.suffix}@example.com`,
      capability: input.capability,
      defaultTimezone: "Asia/Manila",
      status: "active",
      verificationStatus: "verified",
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
      role: input.role ?? "owner",
      status: "active",
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const contactId = await ctx.db.insert("contacts", {
      organizationId,
      type: input.capability === "buyer" ? "procurement" : "sales",
      name: `${input.suffix} Contact`,
      email: `${input.suffix}.contact@example.com`,
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const addresses: Record<string, string> = {};
    for (const type of ["registered", "billing", "shipping"] as const) {
      addresses[type] = await ctx.db.insert("addresses", {
        organizationId,
        type,
        label: type,
        recipientName: `${input.suffix} Incorporated`,
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
    return { userId, organizationId, contactId, addresses };
  });
  return {
    ...ids,
    authenticated: t.withIdentity({
      subject: input.suffix,
      issuer: "https://movix.test",
      tokenIdentifier,
      session_family_id: familyPublicId,
    }),
  };
}

async function createFixture() {
  const t = convexTest(schema, modules);
  const buyer = await createParty(t, { suffix: "buyer", wallet: buyerWallet, capability: "buyer" });
  const supplier = await createParty(t, {
    suffix: "supplier",
    wallet: supplierWallet,
    capability: "supplier",
  });
  const foreign = await createParty(t, {
    suffix: "foreign",
    wallet: foreignWallet,
    capability: "buyer",
  });
  return { t, buyer, supplier, foreign };
}

async function completeDraft(fixture: Awaited<ReturnType<typeof createFixture>>) {
  const { buyer } = fixture;
  const created = await buyer.authenticated.mutation(createDraft, {
    idempotencyKey: "create-order-0001",
  });
  await buyer.authenticated.mutation(saveSupplier, {
    orderId: created.orderId,
    expectedVersion: 1n,
    target: { kind: "wallet", walletAddress: supplierWallet },
  });
  await buyer.authenticated.mutation(saveHeader, {
    orderId: created.orderId,
    expectedVersion: 2n,
    purchaseOrderNumber: " MOVIX-PO-0001 ",
    title: "Machine parts",
    description: "Two-line fixture",
    buyerContactId: buyer.contactId,
    billingAddressId: buyer.addresses.billing,
    shippingAddressId: buyer.addresses.shipping,
    orderDate: "2026-07-28",
    issueDate: "2026-07-28",
    requestedDeliveryDate: "2026-08-31",
    supplierAcceptanceDeadline: Date.now() + 86_400_000,
    fundingDeadline: Date.now() + 172_800_000,
    assetKey: "testnet:USDC",
    buyerInternalNotes: "Buyer only",
  });
  await buyer.authenticated.mutation(upsertLine, {
    orderId: created.orderId,
    expectedVersion: 3n,
    line: {
      lineNumber: 1n,
      name: "Machine bolt",
      quantityCoefficient: 2n,
      quantityScale: 0n,
      unitOfMeasure: "each",
      unitPriceBaseUnits: 125_000_000n,
      discountKind: "fixed",
      discountBaseUnits: 25_000_000n,
      taxBps: 1_200n,
      requiresInspection: true,
    },
  });
  await buyer.authenticated.mutation(upsertLine, {
    orderId: created.orderId,
    expectedVersion: 4n,
    line: {
      lineNumber: 2n,
      name: "Machine nut",
      quantityCoefficient: 3n,
      quantityScale: 0n,
      unitOfMeasure: "each",
      unitPriceBaseUnits: 72_500_000n,
      discountKind: "rate",
      discountBps: 500n,
      taxBps: 0n,
      requiresInspection: false,
    },
  });
  await buyer.authenticated.mutation(saveTerms, {
    orderId: created.orderId,
    expectedVersion: 5n,
    deliveryMethod: "courier",
    shippingResponsibility: "buyer",
    freightChargeTreatment: "separate",
    inspectionPeriodHours: 48n,
    refundPolicy: "Full refund before supplier acceptance.",
    shippingTotalBaseUnits: 5_000_000n,
  });
  return { orderId: created.orderId, revisionId: created.revisionId, version: 6n };
}

describe("Sprint 4 buyer procurement", () => {
  it("creates one recoverable draft and rejects stale/self-dealing writes", async () => {
    const fixture = await createFixture();
    const first = await fixture.buyer.authenticated.mutation(createDraft, {
      idempotencyKey: "create-order-idempotent",
    });
    await expect(
      fixture.buyer.authenticated.mutation(createDraft, {
        idempotencyKey: "create-order-idempotent",
      }),
    ).resolves.toMatchObject({
      orderId: first.orderId,
      revisionId: first.revisionId,
      version: first.version,
      replay: true,
    });
    await expect(
      fixture.buyer.authenticated.query(getDraft, { orderId: first.orderId }),
    ).resolves.toMatchObject({
      order: { agreementStatus: "draft" },
      revision: { version: 1n },
      lines: [],
    });
    await expect(
      fixture.buyer.authenticated.mutation(saveSupplier, {
        orderId: first.orderId,
        expectedVersion: 0n,
        target: { kind: "wallet", walletAddress: supplierWallet },
      }),
    ).rejects.toMatchObject({ data: expect.objectContaining({ code: "ORDER_STALE" }) });
    await expect(
      fixture.buyer.authenticated.query(resolveExact, {
        target: { kind: "wallet", walletAddress: buyerWallet },
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "SELF_DEALING_NOT_ALLOWED" }),
    });
  });

  it("reviews and atomically sends one immutable revision with one side-effect set", async () => {
    const fixture = await createFixture();
    const draft = await completeDraft(fixture);
    await expect(
      fixture.buyer.authenticated.query(getReview, { orderId: draft.orderId }),
    ).resolves.toMatchObject({
      complete: true,
      blockers: [],
      totals: { grandTotalBaseUnits: 463_625_000n },
      termsHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });

    const args = {
      orderId: draft.orderId,
      expectedVersion: draft.version,
      idempotencyKey: "send-order-0001",
    };
    const [first, replay] = await Promise.all([
      fixture.buyer.authenticated.mutation(send, args),
      fixture.buyer.authenticated.mutation(send, args),
    ]);
    expect([first.replay, replay.replay].sort()).toEqual([false, true]);
    expect(replay).toMatchObject({
      orderId: first.orderId,
      revisionId: first.revisionId,
      agreementStatus: "sent",
    });

    await expect(
      fixture.buyer.authenticated.mutation(upsertLine, {
        orderId: draft.orderId,
        expectedVersion: first.revisionVersion,
        line: {
          lineNumber: 3n,
          name: "Late line",
          quantityCoefficient: 1n,
          quantityScale: 0n,
          unitOfMeasure: "each",
          unitPriceBaseUnits: 1n,
          discountKind: "none",
          taxBps: 0n,
          requiresInspection: false,
        },
      }),
    ).rejects.toMatchObject({ data: expect.objectContaining({ code: "ORDER_IMMUTABLE" }) });

    const counts = await fixture.t.run(async (ctx) => ({
      receipts: (await ctx.db.query("orderCommandReceipts").take(20)).filter(
        (row) => row.commandType === "send",
      ).length,
      notifications: (await ctx.db.query("notifications").take(20)).length,
      sendAudits: (await ctx.db.query("auditEvents").take(20)).filter(
        (row) => row.action === "order.sent",
      ).length,
    }));
    expect(counts).toEqual({ receipts: 1, notifications: 1, sendAudits: 1 });
  });

  it("lists, summarizes, details, and cancels an eligible sent order", async () => {
    const fixture = await createFixture();
    const draft = await completeDraft(fixture);
    const sent = await fixture.buyer.authenticated.mutation(send, {
      orderId: draft.orderId,
      expectedVersion: draft.version,
      idempotencyKey: "send-order-list",
    });

    await expect(
      fixture.buyer.authenticated.query(listBuyerOrders, {
        paginationOpts: { numItems: 20, cursor: null },
      }),
    ).resolves.toMatchObject({
      page: [
        expect.objectContaining({
          purchaseOrderNumber: "MOVIX-PO-0001",
          agreementStatus: "sent",
          grandTotalBaseUnits: 463_625_000n,
        }),
      ],
    });
    await expect(fixture.buyer.authenticated.query(getBuyerSummary, {})).resolves.toMatchObject({
      counts: { draft: 0n, sent: 1n },
      recent: [expect.objectContaining({ orderId: draft.orderId })],
      canCreate: true,
    });
    const detail = await fixture.buyer.authenticated.query(getById, { orderId: draft.orderId });
    expect(detail).toMatchObject({
      order: { agreementStatus: "sent", version: sent.orderVersion },
      revision: { buyerInternalNotes: "Buyer only" },
      lines: expect.arrayContaining([expect.objectContaining({ lineNumber: 1n })]),
    });
    await expect(
      fixture.foreign.authenticated.query(getById, { orderId: draft.orderId }),
    ).rejects.toMatchObject({ data: expect.objectContaining({ code: "ORDER_NOT_FOUND" }) });

    await expect(
      fixture.buyer.authenticated.mutation(cancel, {
        orderId: draft.orderId,
        expectedVersion: sent.orderVersion,
        idempotencyKey: "cancel-order-0001",
        reasonCode: "no_longer_needed",
        reasonDetails: "Project scope changed.",
      }),
    ).resolves.toMatchObject({ agreementStatus: "cancelled", replay: false });
    await expect(
      fixture.buyer.authenticated.mutation(cancel, {
        orderId: draft.orderId,
        expectedVersion: sent.orderVersion,
        idempotencyKey: "cancel-order-0001",
        reasonCode: "no_longer_needed",
        reasonDetails: "Project scope changed.",
      }),
    ).resolves.toMatchObject({ agreementStatus: "cancelled", replay: true });
  });

  it("blocks incomplete sends and viewer draft creation without partial writes", async () => {
    const fixture = await createFixture();
    const created = await fixture.buyer.authenticated.mutation(createDraft, {
      idempotencyKey: "incomplete-create",
    });
    await expect(
      fixture.buyer.authenticated.mutation(send, {
        orderId: created.orderId,
        expectedVersion: 1n,
        idempotencyKey: "incomplete-send",
      }),
    ).rejects.toMatchObject({ data: expect.objectContaining({ code: "ORDER_INVALID" }) });
    const viewer = await createParty(fixture.t, {
      suffix: "viewer",
      wallet: "GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDWWL",
      capability: "buyer",
      role: "viewer",
    });
    await expect(
      viewer.authenticated.mutation(createDraft, { idempotencyKey: "viewer-create" }),
    ).rejects.toMatchObject({ data: expect.objectContaining({ code: "ORGANIZATION_FORBIDDEN" }) });

    const state = await fixture.t.run(async (ctx) => {
      const order = await ctx.db.get("orders", created.orderId);
      return {
        agreementStatus: order?.agreementStatus,
        sendReceipts: (await ctx.db.query("orderCommandReceipts").take(20)).filter(
          (row) => row.commandType === "send",
        ).length,
      };
    });
    expect(state).toEqual({ agreementStatus: "draft", sendReceipts: 0 });
    expect(testnetUsdc.decimals).toBe(7);
  });
});
