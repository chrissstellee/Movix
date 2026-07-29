/// <reference types="vite/client" />

import { testnetUsdc } from "@repo/domain/fixtures";
import { convexTest } from "convex-test";
import { makeFunctionReference, type FunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";

import schema from "./schema";

import type { Id } from "./_generated/dataModel";

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
const getSupplierSummary = makeFunctionReference<"query">("supplierOrders:getSummary");
const listSupplierOrders = makeFunctionReference<"query">("supplierOrders:list");
const acceptOrder = makeFunctionReference<"mutation">("orderDecisions:accept");
const rejectOrder = makeFunctionReference<"mutation">("orderDecisions:reject");
const startRevision = makeFunctionReference<"mutation">("orderRevisions:startFromCurrent");
const getOrderDetail = makeFunctionReference<"query">("orderDetails:get");
const listTimeline = makeFunctionReference<"query">("orderTimeline:list");
const listNotifications = makeFunctionReference<"query">("notifications:listCurrentOrganization");
const markNotificationRead = makeFunctionReference<"mutation">("notifications:markRead");
const expireDecision = makeFunctionReference<"mutation", { orderId: string; revisionId: string }>(
  "supplierOrderDeadlines:expire",
) as unknown as FunctionReference<"mutation", "internal", { orderId: string; revisionId: string }>;

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

async function createOrganizationMember(
  t: ReturnType<typeof convexTest>,
  input: {
    organizationId: Id<"organizations">;
    suffix: string;
    wallet: string;
    role: "admin" | "procurement" | "finance" | "operations" | "viewer";
  },
) {
  const now = Date.now();
  const tokenIdentifier = `https://movix.test|${input.suffix}`;
  const familyPublicId = `family-${input.suffix}`;
  await t.run(async (ctx) => {
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
    await ctx.db.insert("memberships", {
      userId,
      organizationId: input.organizationId,
      role: input.role,
      status: "active",
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
  });
  return t.withIdentity({
    subject: input.suffix,
    issuer: "https://movix.test",
    tokenIdentifier,
    session_family_id: familyPublicId,
  });
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
    acceptanceCriteria: "All parts match the approved specification.",
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
      revision: {
        buyerLegalName: "buyer Incorporated",
        supplierLegalName: "supplier Incorporated",
        buyerContact: {
          name: "buyer Contact",
          email: "buyer.contact@example.com",
        },
        supplierContact: {
          name: "supplier Contact",
          email: "supplier.contact@example.com",
        },
        billingAddress: {
          line1: "123 Main Street",
          city: "Makati",
          countryCode: "PH",
        },
        shippingAddress: {
          line1: "123 Main Street",
          city: "Makati",
          countryCode: "PH",
        },
        acceptanceCriteria: "All parts match the approved specification.",
      },
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
    await expect(
      fixture.buyer.authenticated.query(listTimeline, {
        orderId: draft.orderId,
        paginationOpts: { numItems: 20, cursor: null },
      }),
    ).resolves.toMatchObject({
      page: [
        expect.objectContaining({
          events: expect.arrayContaining([expect.objectContaining({ type: "order_cancelled" })]),
        }),
      ],
    });
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

describe("Sprint 5 supplier acceptance", () => {
  it("accepts atomically, replays the stored result, and starts revision N+1", async () => {
    const fixture = await createFixture();
    const draft = await completeDraft(fixture);
    const review = await fixture.buyer.authenticated.query(getReview, {
      orderId: draft.orderId,
    });
    const sent = await fixture.buyer.authenticated.mutation(send, {
      orderId: draft.orderId,
      expectedVersion: draft.version,
      idempotencyKey: "s5-send-accept",
    });

    await expect(
      fixture.supplier.authenticated.query(getSupplierSummary, {}),
    ).resolves.toMatchObject({
      counts: { requiresDecision: 1n, accepted: 0n },
      recentIncoming: [
        expect.objectContaining({
          orderId: draft.orderId,
          revisionNumber: 1n,
          supplierQueueState: "requires_decision",
        }),
      ],
    });
    await expect(
      fixture.supplier.authenticated.query(listSupplierOrders, {
        paginationOpts: { numItems: 20, cursor: null },
        queueState: "requires_decision",
      }),
    ).resolves.toMatchObject({
      page: [expect.objectContaining({ orderId: draft.orderId, buyerName: "buyer" })],
    });
    const supplierDetail = await fixture.supplier.authenticated.query(getOrderDetail, {
      orderId: draft.orderId,
    });
    expect(supplierDetail).toMatchObject({
      viewerSide: "supplier",
      canDecide: true,
      revision: {
        revisionNumber: 1n,
        termsHash: review.termsHash,
      },
      offChainNotice: expect.stringContaining("moves no funds"),
    });
    expect(supplierDetail.revision).not.toHaveProperty("buyerInternalNotes");
    expect(supplierDetail.revision).not.toHaveProperty("costCenter");
    expect(supplierDetail.revision).not.toHaveProperty("projectCode");

    const decisionArgs = {
      orderId: draft.orderId,
      revisionId: draft.revisionId,
      expectedOrderVersion: sent.orderVersion,
      expectedRevisionVersion: sent.revisionVersion,
      expectedTermsHash: review.termsHash!,
      idempotencyKey: "s5-accept-0001",
    };
    const accepted = await fixture.supplier.authenticated.mutation(acceptOrder, decisionArgs);
    expect(accepted).toMatchObject({
      decision: "accepted",
      agreementStatus: "accepted",
      replay: false,
    });
    await expect(
      fixture.supplier.authenticated.mutation(acceptOrder, decisionArgs),
    ).resolves.toEqual({ ...accepted, replay: true });
    await expect(
      fixture.supplier.authenticated.mutation(acceptOrder, {
        ...decisionArgs,
        expectedTermsHash: "f".repeat(64),
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "IDEMPOTENCY_CONFLICT" }),
    });
    await expect(
      fixture.supplier.authenticated.query(getSupplierSummary, {}),
    ).resolves.toMatchObject({
      counts: { requiresDecision: 0n, accepted: 1n },
      recentIncoming: [],
    });
    await expect(
      fixture.buyer.authenticated.query(getOrderDetail, { orderId: draft.orderId }),
    ).resolves.toMatchObject({
      viewerSide: "buyer",
      order: { fundingEligible: true },
      decision: { decision: "accepted", termsHash: review.termsHash },
    });
    const notificationPage = await fixture.buyer.authenticated.query(listNotifications, {
      paginationOpts: { numItems: 20, cursor: null },
      status: "unread",
    });
    const acceptedNotification = notificationPage.page.find(
      (item: { eventType: string }) => item.eventType === "order.accepted",
    );
    expect(acceptedNotification).toMatchObject({
      entityId: draft.orderId,
      actionUrl: `/orders/${draft.orderId}`,
    });
    await expect(
      fixture.buyer.authenticated.mutation(markNotificationRead, {
        notificationId: acceptedNotification!.id,
      }),
    ).resolves.toMatchObject({ status: "read" });

    const next = await fixture.buyer.authenticated.mutation(startRevision, {
      orderId: draft.orderId,
      expectedOrderVersion: accepted.orderVersion,
      expectedRevisionId: draft.revisionId,
      idempotencyKey: "s5-revision-0001",
    });
    expect(next).toMatchObject({
      agreementStatus: "draft",
      revisionVersion: 1n,
      replay: false,
    });
    const nextDraft = await fixture.buyer.authenticated.query(getDraft, {
      orderId: draft.orderId,
    });
    expect(nextDraft).toMatchObject({
      order: { agreementStatus: "draft" },
      revision: {
        id: next.revisionId,
        revisionNumber: 2n,
      },
      lines: [
        expect.objectContaining({ lineNumber: 1n }),
        expect.objectContaining({ lineNumber: 2n }),
      ],
    });
    const immutableHistory = await fixture.t.run(async (ctx) => ({
      decisions: await ctx.db
        .query("orderRevisionDecisions")
        .withIndex("by_revisionId", (index) => index.eq("revisionId", draft.revisionId))
        .take(2),
      oldRevision: await ctx.db.get("orderRevisions", draft.revisionId),
    }));
    expect(immutableHistory.decisions).toHaveLength(1);
    expect(immutableHistory.oldRevision?.supersededAt).toEqual(expect.any(Number));
    await expect(
      fixture.supplier.authenticated.query(getOrderDetail, { orderId: draft.orderId }),
    ).resolves.toMatchObject({
      viewerSide: "supplier",
      order: { agreementStatus: "draft", fundingEligible: false },
      revision: { revisionNumber: 1n, termsHash: review.termsHash },
      decision: { decision: "accepted" },
      canDecide: false,
    });
    await expect(
      fixture.buyer.authenticated.query(listTimeline, {
        orderId: draft.orderId,
        paginationOpts: { numItems: 20, cursor: null },
      }),
    ).resolves.toMatchObject({
      page: [
        expect.objectContaining({
          revisionNumber: 2n,
          events: [expect.objectContaining({ type: "revision_started" })],
        }),
        expect.objectContaining({
          revisionNumber: 1n,
          decision: expect.objectContaining({ decision: "accepted" }),
          events: expect.arrayContaining([
            expect.objectContaining({ type: "revision_sent" }),
            expect.objectContaining({ type: "revision_accepted" }),
            expect.objectContaining({ type: "revision_superseded" }),
          ]),
        }),
      ],
    });
    const revisionTwoReview = await fixture.buyer.authenticated.query(getReview, {
      orderId: draft.orderId,
    });
    expect(revisionTwoReview.termsHash).not.toBe(review.termsHash);
    const revisionTwoSent = await fixture.buyer.authenticated.mutation(send, {
      orderId: draft.orderId,
      expectedVersion: 1n,
      idempotencyKey: "s5-send-revision-0002",
    });
    const revisionTwoAccepted = await fixture.supplier.authenticated.mutation(acceptOrder, {
      orderId: draft.orderId,
      revisionId: next.revisionId,
      expectedOrderVersion: revisionTwoSent.orderVersion,
      expectedRevisionVersion: revisionTwoSent.revisionVersion,
      expectedTermsHash: revisionTwoReview.termsHash!,
      idempotencyKey: "s5-accept-revision-0002",
    });
    expect(revisionTwoAccepted).toMatchObject({
      decision: "accepted",
      revisionId: next.revisionId,
    });
    await expect(
      fixture.buyer.authenticated.query(getOrderDetail, { orderId: draft.orderId }),
    ).resolves.toMatchObject({
      order: { fundingEligible: true },
      revision: { revisionNumber: 2n },
      decision: { decision: "accepted", revisionNumber: 2n },
    });
    const decisions = await fixture.t.run((ctx) =>
      ctx.db
        .query("orderRevisionDecisions")
        .withIndex("by_orderId_and_decidedAt", (index) => index.eq("orderId", draft.orderId))
        .take(3),
    );
    expect(decisions.map((decision) => decision.revisionNumber).sort()).toEqual([1n, 2n]);
    await fixture.t.run((ctx) =>
      ctx.db.patch("orders", draft.orderId, { settlementStatus: "funded" }),
    );
    await expect(
      fixture.buyer.authenticated.mutation(startRevision, {
        orderId: draft.orderId,
        expectedOrderVersion: revisionTwoAccepted.orderVersion,
        expectedRevisionId: next.revisionId,
        idempotencyKey: "s5-revision-funded-denied",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORDER_CANNOT_REVISE" }),
    });
  });

  it("rejects with a canonical private note and never leaks it to side effects", async () => {
    const fixture = await createFixture();
    const draft = await completeDraft(fixture);
    const review = await fixture.buyer.authenticated.query(getReview, {
      orderId: draft.orderId,
    });
    const sent = await fixture.buyer.authenticated.mutation(send, {
      orderId: draft.orderId,
      expectedVersion: draft.version,
      idempotencyKey: "s5-send-reject",
    });
    const rejected = await fixture.supplier.authenticated.mutation(rejectOrder, {
      orderId: draft.orderId,
      revisionId: draft.revisionId,
      expectedOrderVersion: sent.orderVersion,
      expectedRevisionVersion: sent.revisionVersion,
      expectedTermsHash: review.termsHash!,
      idempotencyKey: "s5-reject-0001",
      reasonCode: "commercial_terms",
      reasonNote: "  Net   60 is not supported.  ",
    });
    expect(rejected).toMatchObject({ decision: "rejected", replay: false });
    const state = await fixture.t.run(async (ctx) => {
      const [decision] = await ctx.db
        .query("orderRevisionDecisions")
        .withIndex("by_revisionId", (index) => index.eq("revisionId", draft.revisionId))
        .take(2);
      return {
        decision,
        notifications: await ctx.db.query("notifications").take(20),
        audits: await ctx.db.query("auditEvents").take(20),
        receipts: await ctx.db.query("orderDecisionReceipts").take(20),
      };
    });
    expect(state.decision?.reasonNote).toBe("Net 60 is not supported.");
    expect(JSON.stringify(state.notifications)).not.toContain("Net 60");
    expect(JSON.stringify(state.audits)).not.toContain("Net 60");
    expect(
      state.receipts.some((receipt) =>
        Object.values(receipt).some((value) => String(value).includes("Net 60")),
      ),
    ).toBe(false);
    await expect(
      fixture.buyer.authenticated.mutation(startRevision, {
        orderId: draft.orderId,
        expectedOrderVersion: rejected.orderVersion,
        expectedRevisionId: draft.revisionId,
        idempotencyKey: "s5-rejected-revision",
      }),
    ).resolves.toMatchObject({
      agreementStatus: "draft",
      revisionVersion: 1n,
    });
  });

  it("expires only the matching undecided revision and remains retry-safe", async () => {
    const fixture = await createFixture();
    const draft = await completeDraft(fixture);
    const review = await fixture.buyer.authenticated.query(getReview, {
      orderId: draft.orderId,
    });
    const sent = await fixture.buyer.authenticated.mutation(send, {
      orderId: draft.orderId,
      expectedVersion: draft.version,
      idempotencyKey: "s5-send-expired",
    });
    await fixture.t.run(async (ctx) => {
      await ctx.db.patch("orderRevisions", draft.revisionId, {
        supplierAcceptanceDeadline: Date.now() - 1,
      });
    });
    await fixture.t.mutation(expireDecision, {
      orderId: draft.orderId,
      revisionId: draft.revisionId,
    });
    await fixture.t.mutation(expireDecision, {
      orderId: draft.orderId,
      revisionId: draft.revisionId,
    });
    await expect(
      fixture.supplier.authenticated.query(getSupplierSummary, {}),
    ).resolves.toMatchObject({
      counts: { requiresDecision: 0n, expired: 1n },
    });
    await expect(
      fixture.supplier.authenticated.mutation(acceptOrder, {
        orderId: draft.orderId,
        revisionId: draft.revisionId,
        expectedOrderVersion: sent.orderVersion + 1n,
        expectedRevisionVersion: sent.revisionVersion,
        expectedTermsHash: review.termsHash!,
        idempotencyKey: "s5-accept-expired",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORDER_DECISION_EXPIRED" }),
    });
    const state = await fixture.t.run(async (ctx) => {
      const order = await ctx.db.get("orders", draft.orderId);
      const expiryAudits = (await ctx.db.query("auditEvents").take(50)).filter(
        (item) => item.action === "order.decision_expired",
      );
      return { order, expiryAudits };
    });
    expect(state.order).toMatchObject({
      agreementStatus: "sent",
      supplierQueueState: "expired",
      decisionWindowExpiredAt: expect.any(Number),
    });
    expect(state.expiryAudits).toHaveLength(1);
  });

  it("permits decision roles, keeps finance/viewer read-only, and hides foreign orders", async () => {
    const fixture = await createFixture();
    const draft = await completeDraft(fixture);
    const review = await fixture.buyer.authenticated.query(getReview, {
      orderId: draft.orderId,
    });
    const sent = await fixture.buyer.authenticated.mutation(send, {
      orderId: draft.orderId,
      expectedVersion: draft.version,
      idempotencyKey: "s5-send-role-matrix",
    });
    const operations = await createOrganizationMember(fixture.t, {
      organizationId: fixture.supplier.organizationId,
      suffix: "supplier-operations",
      wallet: "GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDWWL",
      role: "operations",
    });
    const finance = await createOrganizationMember(fixture.t, {
      organizationId: fixture.supplier.organizationId,
      suffix: "supplier-finance",
      wallet: "GEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEBAX",
      role: "finance",
    });
    const viewer = await createOrganizationMember(fixture.t, {
      organizationId: fixture.supplier.organizationId,
      suffix: "supplier-viewer",
      wallet: "GFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF3K",
      role: "viewer",
    });
    await expect(finance.query(getOrderDetail, { orderId: draft.orderId })).resolves.toMatchObject({
      viewerSide: "supplier",
      canDecide: false,
    });
    await expect(viewer.query(getOrderDetail, { orderId: draft.orderId })).resolves.toMatchObject({
      viewerSide: "supplier",
      canDecide: false,
    });
    await expect(
      viewer.mutation(acceptOrder, {
        orderId: draft.orderId,
        revisionId: draft.revisionId,
        expectedOrderVersion: sent.orderVersion,
        expectedRevisionVersion: sent.revisionVersion,
        expectedTermsHash: review.termsHash!,
        idempotencyKey: "s5-viewer-denied",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORDER_DECISION_FORBIDDEN" }),
    });
    await expect(
      operations.mutation(acceptOrder, {
        orderId: draft.orderId,
        revisionId: draft.revisionId,
        expectedOrderVersion: sent.orderVersion,
        expectedRevisionVersion: sent.revisionVersion,
        expectedTermsHash: review.termsHash!,
        idempotencyKey: "s5-operations-accept",
      }),
    ).resolves.toMatchObject({ decision: "accepted" });
    const foreignSupplier = await createParty(fixture.t, {
      suffix: "foreign-supplier",
      wallet: "GCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCDG",
      capability: "supplier",
    });
    await expect(
      foreignSupplier.authenticated.query(getOrderDetail, { orderId: draft.orderId }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORDER_NOT_FOUND" }),
    });
  });

  it("serializes accept-versus-reject to one immutable side-effect set", async () => {
    const fixture = await createFixture();
    const draft = await completeDraft(fixture);
    const review = await fixture.buyer.authenticated.query(getReview, {
      orderId: draft.orderId,
    });
    const sent = await fixture.buyer.authenticated.mutation(send, {
      orderId: draft.orderId,
      expectedVersion: draft.version,
      idempotencyKey: "s5-send-race",
    });
    const common = {
      orderId: draft.orderId,
      revisionId: draft.revisionId,
      expectedOrderVersion: sent.orderVersion,
      expectedRevisionVersion: sent.revisionVersion,
      expectedTermsHash: review.termsHash!,
    };
    const results = await Promise.allSettled([
      fixture.supplier.authenticated.mutation(acceptOrder, {
        ...common,
        idempotencyKey: "s5-race-accept",
      }),
      fixture.supplier.authenticated.mutation(rejectOrder, {
        ...common,
        idempotencyKey: "s5-race-reject",
        reasonCode: "other",
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const sideEffects = await fixture.t.run(async (ctx) => ({
      decisions: (await ctx.db.query("orderRevisionDecisions").take(20)).length,
      decisionReceipts: (await ctx.db.query("orderDecisionReceipts").take(20)).length,
      decisionNotifications: (await ctx.db.query("notifications").take(20)).filter(
        (item) => item.eventType === "order.accepted" || item.eventType === "order.rejected",
      ).length,
      decisionAudits: (await ctx.db.query("auditEvents").take(50)).filter(
        (item) => item.action === "order.accepted" || item.action === "order.rejected",
      ).length,
    }));
    expect(sideEffects).toEqual({
      decisions: 1,
      decisionReceipts: 1,
      decisionNotifications: 1,
      decisionAudits: 1,
    });
  });

  it("rejects stale, mismatched, unfrozen, and cancelled decision targets without writes", async () => {
    const staleFixture = await createFixture();
    const staleDraft = await completeDraft(staleFixture);
    const staleReview = await staleFixture.buyer.authenticated.query(getReview, {
      orderId: staleDraft.orderId,
    });
    const staleSent = await staleFixture.buyer.authenticated.mutation(send, {
      orderId: staleDraft.orderId,
      expectedVersion: staleDraft.version,
      idempotencyKey: "s5-guard-send-stale",
    });
    await expect(
      staleFixture.supplier.authenticated.mutation(acceptOrder, {
        orderId: staleDraft.orderId,
        revisionId: staleDraft.revisionId,
        expectedOrderVersion: staleSent.orderVersion - 1n,
        expectedRevisionVersion: staleSent.revisionVersion,
        expectedTermsHash: staleReview.termsHash!,
        idempotencyKey: "s5-guard-stale-order",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORDER_STALE" }),
    });
    await expect(
      staleFixture.supplier.authenticated.mutation(acceptOrder, {
        orderId: staleDraft.orderId,
        revisionId: staleDraft.revisionId,
        expectedOrderVersion: staleSent.orderVersion,
        expectedRevisionVersion: staleSent.revisionVersion - 1n,
        expectedTermsHash: staleReview.termsHash!,
        idempotencyKey: "s5-guard-stale-revision",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORDER_STALE" }),
    });
    await expect(
      staleFixture.supplier.authenticated.mutation(acceptOrder, {
        orderId: staleDraft.orderId,
        revisionId: staleDraft.revisionId,
        expectedOrderVersion: staleSent.orderVersion,
        expectedRevisionVersion: staleSent.revisionVersion,
        expectedTermsHash: "0".repeat(64),
        idempotencyKey: "s5-guard-wrong-hash",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORDER_TERMS_HASH_MISMATCH" }),
    });
    const otherDraft = await staleFixture.buyer.authenticated.mutation(createDraft, {
      idempotencyKey: "s5-guard-other-revision",
    });
    await expect(
      staleFixture.supplier.authenticated.mutation(acceptOrder, {
        orderId: staleDraft.orderId,
        revisionId: otherDraft.revisionId,
        expectedOrderVersion: staleSent.orderVersion,
        expectedRevisionVersion: otherDraft.version,
        expectedTermsHash: staleReview.termsHash!,
        idempotencyKey: "s5-guard-wrong-revision",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORDER_REVISION_MISMATCH" }),
    });

    const unfrozenFixture = await createFixture();
    const unfrozenDraft = await completeDraft(unfrozenFixture);
    const unfrozenReview = await unfrozenFixture.buyer.authenticated.query(getReview, {
      orderId: unfrozenDraft.orderId,
    });
    const unfrozenSent = await unfrozenFixture.buyer.authenticated.mutation(send, {
      orderId: unfrozenDraft.orderId,
      expectedVersion: unfrozenDraft.version,
      idempotencyKey: "s5-guard-send-unfrozen",
    });
    await unfrozenFixture.t.run((ctx) =>
      ctx.db.patch("orderRevisions", unfrozenDraft.revisionId, { frozenAt: undefined }),
    );
    await expect(
      unfrozenFixture.supplier.authenticated.mutation(acceptOrder, {
        orderId: unfrozenDraft.orderId,
        revisionId: unfrozenDraft.revisionId,
        expectedOrderVersion: unfrozenSent.orderVersion,
        expectedRevisionVersion: unfrozenSent.revisionVersion,
        expectedTermsHash: unfrozenReview.termsHash!,
        idempotencyKey: "s5-guard-unfrozen",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORDER_NOT_AWAITING_DECISION" }),
    });

    const cancelledFixture = await createFixture();
    const cancelledDraft = await completeDraft(cancelledFixture);
    const cancelledReview = await cancelledFixture.buyer.authenticated.query(getReview, {
      orderId: cancelledDraft.orderId,
    });
    const cancelledSent = await cancelledFixture.buyer.authenticated.mutation(send, {
      orderId: cancelledDraft.orderId,
      expectedVersion: cancelledDraft.version,
      idempotencyKey: "s5-guard-send-cancelled",
    });
    const cancelled = await cancelledFixture.buyer.authenticated.mutation(cancel, {
      orderId: cancelledDraft.orderId,
      expectedVersion: cancelledSent.orderVersion,
      idempotencyKey: "s5-guard-cancel",
      reasonCode: "no_longer_needed",
    });
    await expect(
      cancelledFixture.supplier.authenticated.mutation(acceptOrder, {
        orderId: cancelledDraft.orderId,
        revisionId: cancelledDraft.revisionId,
        expectedOrderVersion: cancelled.orderVersion,
        expectedRevisionVersion: cancelledSent.revisionVersion,
        expectedTermsHash: cancelledReview.termsHash!,
        idempotencyKey: "s5-guard-cancelled",
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: "ORDER_NOT_AWAITING_DECISION" }),
    });
    for (const fixture of [staleFixture, unfrozenFixture, cancelledFixture]) {
      const sideEffects = await fixture.t.run(async (ctx) => ({
        decisions: (await ctx.db.query("orderRevisionDecisions").take(5)).length,
        receipts: (await ctx.db.query("orderDecisionReceipts").take(5)).length,
      }));
      expect(sideEffects).toEqual({ decisions: 0, receipts: 0 });
    }
  });
});
