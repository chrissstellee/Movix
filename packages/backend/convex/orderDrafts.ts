import {
  calculateOrderLine,
  calculateOrderTotals,
  normalizePurchaseOrderNumber,
  type OrderDiscount,
} from "@repo/domain";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { businessError } from "./lib/errors";
import { resolveOrderAsset } from "./lib/orderAssets";
import { requireBuyerCapability, requireBuyerOrder } from "./lib/orderAuthorization";
import { adjustBuyerCounts } from "./lib/orderCounts";
import { getOrderBlockers, hashOrderTermsV1 } from "./lib/orderTerms";
import {
  draftMutationResultValidator,
  draftProjectionValidator,
  orderLineInputValidator,
  reviewProjectionValidator,
  supplierTargetValidator,
} from "./orderValidators";
import { resolveSupplierTarget } from "./supplierDirectory";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type DraftCtx = QueryCtx | MutationCtx;

function boundedText(value: string, minimum: number, maximum: number, field: string): string {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (
    normalized.length < minimum ||
    normalized.length > maximum ||
    /[\p{Cc}\p{Cf}]/u.test(normalized)
  ) {
    throw businessError("ORDER_INVALID", { fields: { [field]: "Invalid value." } });
  }
  return normalized;
}

function optionalText(
  value: string | undefined,
  maximum: number,
  field: string,
): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  return boundedText(value, 1, maximum, field);
}

function snapshotContact(contact: Doc<"contacts">): Record<string, string | null> {
  return {
    name: contact.name,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    jobTitle: contact.jobTitle ?? null,
    department: contact.department ?? null,
  };
}

function snapshotAddress(address: Doc<"addresses">): Record<string, string | null> {
  return {
    label: address.label,
    recipientName: address.recipientName ?? null,
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city,
    region: address.region ?? null,
    postalCode: address.postalCode ?? null,
    countryCode: address.countryCode,
    deliveryInstructions: address.deliveryInstructions ?? null,
  };
}

async function loadDraftRecords(ctx: DraftCtx, orderId: Id<"orders">) {
  const authorized = await requireBuyerOrder(ctx, orderId);
  if (!authorized.order.currentRevisionId) {
    throw businessError("ORDER_NOT_FOUND");
  }
  const revision = await ctx.db.get("orderRevisions", authorized.order.currentRevisionId);
  if (!revision || revision.orderId !== orderId) {
    throw businessError("ORDER_NOT_FOUND");
  }
  const lines = await ctx.db
    .query("orderLines")
    .withIndex("by_revisionId", (index) => index.eq("revisionId", revision._id))
    .take(101);
  return { ...authorized, revision, lines };
}

async function requireMutableDraft(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  expectedVersion: bigint,
) {
  const records = await loadDraftRecords(ctx, orderId);
  if (records.order.agreementStatus !== "draft" || records.revision.frozenAt !== undefined) {
    throw businessError("ORDER_IMMUTABLE");
  }
  if (records.revision.version !== expectedVersion) {
    throw businessError("ORDER_STALE");
  }
  return records;
}

function publicLine(line: Doc<"orderLines">) {
  return {
    id: line._id,
    lineNumber: line.lineNumber,
    name: line.name,
    ...(line.sku ? { sku: line.sku } : {}),
    ...(line.supplierSku ? { supplierSku: line.supplierSku } : {}),
    ...(line.description ? { description: line.description } : {}),
    quantityCoefficient: line.quantityCoefficient,
    quantityScale: line.quantityScale,
    unitOfMeasure: line.unitOfMeasure,
    unitPriceBaseUnits: line.unitPriceBaseUnits,
    discountKind: line.discountKind,
    ...(line.discountBaseUnitsInput !== undefined
      ? { discountBaseUnitsInput: line.discountBaseUnitsInput }
      : {}),
    ...(line.discountBps !== undefined ? { discountBps: line.discountBps } : {}),
    taxBps: line.taxBps,
    ...(line.taxCode ? { taxCode: line.taxCode } : {}),
    requiresInspection: line.requiresInspection,
    grossBaseUnits: line.grossBaseUnits,
    discountBaseUnits: line.discountBaseUnits,
    taxBaseUnits: line.taxBaseUnits,
    lineTotalBaseUnits: line.lineTotalBaseUnits,
  };
}

function publicRevision(revision: Doc<"orderRevisions">) {
  const asset =
    revision.assetKey &&
    revision.assetCode &&
    revision.assetContractId &&
    revision.assetDecimals !== undefined
      ? {
          key: revision.assetKey,
          code: revision.assetCode,
          issuer: revision.assetIssuer ?? null,
          contractId: revision.assetContractId,
          decimals: revision.assetDecimals,
          network: "testnet" as const,
        }
      : undefined;
  return {
    id: revision._id,
    version: revision.version,
    revisionNumber: revision.revisionNumber,
    buyerLegalName: revision.buyerLegalNameSnapshot,
    ...(revision.buyerTradingNameSnapshot
      ? { buyerTradingName: revision.buyerTradingNameSnapshot }
      : {}),
    ...(revision.supplierOrganizationId
      ? { supplierOrganizationId: revision.supplierOrganizationId }
      : {}),
    ...(revision.supplierLegalNameSnapshot
      ? { supplierLegalName: revision.supplierLegalNameSnapshot }
      : {}),
    ...(revision.supplierTradingNameSnapshot
      ? { supplierTradingName: revision.supplierTradingNameSnapshot }
      : {}),
    ...(revision.buyerContactSnapshot ? { buyerContact: revision.buyerContactSnapshot } : {}),
    ...(revision.supplierContactSnapshot
      ? { supplierContact: revision.supplierContactSnapshot }
      : {}),
    ...(revision.billingAddressSnapshot ? { billingAddress: revision.billingAddressSnapshot } : {}),
    ...(revision.shippingAddressSnapshot
      ? { shippingAddress: revision.shippingAddressSnapshot }
      : {}),
    ...(revision.purchaseOrderNumber ? { purchaseOrderNumber: revision.purchaseOrderNumber } : {}),
    ...(revision.title ? { title: revision.title } : {}),
    ...(revision.description ? { description: revision.description } : {}),
    ...(revision.buyerReference ? { buyerReference: revision.buyerReference } : {}),
    ...(revision.supplierReference ? { supplierReference: revision.supplierReference } : {}),
    ...(revision.costCenter ? { costCenter: revision.costCenter } : {}),
    ...(revision.projectCode ? { projectCode: revision.projectCode } : {}),
    ...(revision.timezone ? { timezone: revision.timezone } : {}),
    ...(revision.orderDate ? { orderDate: revision.orderDate } : {}),
    ...(revision.issueDate ? { issueDate: revision.issueDate } : {}),
    ...(revision.requestedDeliveryDate
      ? { requestedDeliveryDate: revision.requestedDeliveryDate }
      : {}),
    ...(revision.supplierAcceptanceDeadline !== undefined
      ? { supplierAcceptanceDeadline: revision.supplierAcceptanceDeadline }
      : {}),
    ...(revision.fundingDeadline !== undefined
      ? { fundingDeadline: revision.fundingDeadline }
      : {}),
    ...(asset ? { asset } : {}),
    ...(revision.deliveryMethod ? { deliveryMethod: revision.deliveryMethod } : {}),
    ...(revision.shippingResponsibility
      ? { shippingResponsibility: revision.shippingResponsibility }
      : {}),
    ...(revision.freightChargeTreatment
      ? { freightChargeTreatment: revision.freightChargeTreatment }
      : {}),
    ...(revision.inspectionPeriodHours !== undefined
      ? { inspectionPeriodHours: revision.inspectionPeriodHours }
      : {}),
    ...(revision.refundPolicy ? { refundPolicy: revision.refundPolicy } : {}),
    ...(revision.deliveryWindow ? { deliveryWindow: revision.deliveryWindow } : {}),
    ...(revision.incoterm ? { incoterm: revision.incoterm } : {}),
    ...(revision.namedLocation ? { namedLocation: revision.namedLocation } : {}),
    ...(revision.handlingInstructions
      ? { handlingInstructions: revision.handlingInstructions }
      : {}),
    ...(revision.acceptanceCriteria ? { acceptanceCriteria: revision.acceptanceCriteria } : {}),
    ...(revision.warrantyText ? { warrantyText: revision.warrantyText } : {}),
    ...(revision.returnTerms ? { returnTerms: revision.returnTerms } : {}),
    ...(revision.sharedNotes ? { sharedNotes: revision.sharedNotes } : {}),
    ...(revision.buyerInternalNotes ? { buyerInternalNotes: revision.buyerInternalNotes } : {}),
    totals: {
      subtotalBaseUnits: revision.subtotalBaseUnits,
      discountTotalBaseUnits: revision.discountTotalBaseUnits,
      taxTotalBaseUnits: revision.taxTotalBaseUnits,
      shippingTotalBaseUnits: revision.shippingTotalBaseUnits,
      grandTotalBaseUnits: revision.grandTotalBaseUnits,
    },
    ...(revision.frozenAt !== undefined ? { frozenAt: revision.frozenAt } : {}),
  };
}

function projection(records: Awaited<ReturnType<typeof loadDraftRecords>>) {
  return {
    order: {
      id: records.order._id,
      agreementStatus: records.order.agreementStatus,
      fulfillmentStatus: records.order.fulfillmentStatus,
      settlementStatus: records.order.settlementStatus,
      version: records.order.version,
    },
    revision: publicRevision(records.revision),
    lines: records.lines.sort((a, b) => Number(a.lineNumber - b.lineNumber)).map(publicLine),
  };
}

async function recalculateRevision(
  ctx: MutationCtx,
  revision: Doc<"orderRevisions">,
  shippingTotalBaseUnits = revision.shippingTotalBaseUnits,
) {
  const lines = await ctx.db
    .query("orderLines")
    .withIndex("by_revisionId", (index) => index.eq("revisionId", revision._id))
    .take(101);
  let totals;
  try {
    totals =
      lines.length === 0
        ? {
            subtotalBaseUnits: 0n,
            discountTotalBaseUnits: 0n,
            taxTotalBaseUnits: 0n,
            shippingTotalBaseUnits,
            grandTotalBaseUnits: 0n,
          }
        : calculateOrderTotals(
            lines.map((line) => ({
              grossBaseUnits: line.grossBaseUnits,
              discountBaseUnits: line.discountBaseUnits,
              taxBaseUnits: line.taxBaseUnits,
              lineTotalBaseUnits: line.lineTotalBaseUnits,
            })),
            shippingTotalBaseUnits,
          );
  } catch (error) {
    const code =
      error instanceof Error && error.message === "AMOUNT_OVERFLOW"
        ? "AMOUNT_OVERFLOW"
        : "AMOUNT_INVALID";
    throw businessError(code);
  }
  return { lines, totals };
}

export const create = mutation({
  args: { idempotencyKey: v.string() },
  returns: v.object({
    orderId: v.id("orders"),
    revisionId: v.id("orderRevisions"),
    version: v.int64(),
    replay: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (args.idempotencyKey.length < 8 || args.idempotencyKey.length > 120) {
      throw businessError("ORDER_INVALID");
    }
    const buyer = await requireBuyerCapability(ctx, "order:draft");
    const prior = await ctx.db
      .query("orderCommandReceipts")
      .withIndex("by_buyer_command_idempotencyKey", (index) =>
        index
          .eq("buyerOrganizationId", buyer.organization._id)
          .eq("commandType", "create")
          .eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (prior?.resultRevisionId) {
      const revision = await ctx.db.get("orderRevisions", prior.resultRevisionId);
      if (!revision || prior.requestFingerprint !== "create:v1") {
        throw businessError("IDEMPOTENCY_CONFLICT");
      }
      return {
        orderId: prior.orderId,
        revisionId: revision._id,
        version: revision.version,
        replay: true,
      };
    }

    const now = Date.now();
    const orderId = await ctx.db.insert("orders", {
      buyerOrganizationId: buyer.organization._id,
      currentRevisionNumber: 1n,
      grandTotalBaseUnits: 0n,
      agreementStatus: "draft",
      fulfillmentStatus: "not_started",
      settlementStatus: "unfunded",
      supplierQueueState: "not_queued",
      sortTimestamp: now,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const revisionId = await ctx.db.insert("orderRevisions", {
      orderId,
      revisionNumber: 1n,
      buyerOrganizationId: buyer.organization._id,
      buyerLegalNameSnapshot: buyer.organization.legalName,
      ...(buyer.organization.tradingName
        ? { buyerTradingNameSnapshot: buyer.organization.tradingName }
        : {}),
      paymentMode: "escrow",
      autoReleasePolicy: "none",
      subtotalBaseUnits: 0n,
      discountTotalBaseUnits: 0n,
      taxTotalBaseUnits: 0n,
      shippingTotalBaseUnits: 0n,
      grandTotalBaseUnits: 0n,
      createdByUserId: buyer.principal.user._id,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    await ctx.db.patch("orders", orderId, { currentRevisionId: revisionId });
    await ctx.db.insert("orderCommandReceipts", {
      buyerOrganizationId: buyer.organization._id,
      orderId,
      commandType: "create",
      idempotencyKey: args.idempotencyKey,
      requestFingerprint: "create:v1",
      resultRevisionId: revisionId,
      resultAgreementStatus: "draft",
      createdAt: now,
    });
    await adjustBuyerCounts(ctx, buyer.organization._id, { draft: 1n });
    await ctx.db.insert("auditEvents", {
      entityType: "order",
      entityId: orderId,
      organizationId: buyer.organization._id,
      actorUserId: buyer.principal.user._id,
      action: "order.draft_created",
      correlationId: args.idempotencyKey,
      changedFields: ["agreementStatus"],
      occurredAt: now,
    });
    return { orderId, revisionId, version: 1n, replay: false };
  },
});

export const get = query({
  args: { orderId: v.id("orders") },
  returns: draftProjectionValidator,
  handler: async (ctx, args) => projection(await loadDraftRecords(ctx, args.orderId)),
});

export const saveSupplier = mutation({
  args: {
    orderId: v.id("orders"),
    expectedVersion: v.int64(),
    target: supplierTargetValidator,
  },
  returns: draftMutationResultValidator,
  handler: async (ctx, args) => {
    const records = await requireMutableDraft(ctx, args.orderId, args.expectedVersion);
    if (!["owner", "admin", "procurement"].includes(records.membership.role)) {
      throw businessError("ORGANIZATION_FORBIDDEN");
    }
    const resolved = await resolveSupplierTarget(ctx, records.organization._id, args.target);
    const now = Date.now();
    let relationship = resolved.relationship;
    if (!relationship) {
      const relationshipId = await ctx.db.insert("relationships", {
        buyerOrganizationId: records.organization._id,
        supplierOrganizationId: resolved.supplier._id,
        status: "active",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
      relationship = await ctx.db.get("relationships", relationshipId);
    }
    await ctx.db.patch("orderRevisions", records.revision._id, {
      supplierOrganizationId: resolved.supplier._id,
      relationshipId: relationship!._id,
      supplierLegalNameSnapshot: resolved.supplier.legalName,
      supplierTradingNameSnapshot: resolved.supplier.tradingName,
      supplierContactSnapshot: snapshotContact(resolved.primaryContact),
      shippingAddressSnapshot:
        records.revision.shippingAddressSnapshot ?? snapshotAddress(resolved.registeredAddress),
      updatedAt: now,
      version: records.revision.version + 1n,
    });
    await ctx.db.patch("orders", records.order._id, {
      supplierOrganizationId: resolved.supplier._id,
      relationshipId: relationship!._id,
      supplierNameSnapshot: resolved.supplier.tradingName ?? resolved.supplier.legalName,
      updatedAt: now,
      sortTimestamp: now,
    });
    return {
      orderId: records.order._id,
      revisionId: records.revision._id,
      version: records.revision.version + 1n,
      totals: publicRevision(records.revision).totals,
    };
  },
});

export const saveHeader = mutation({
  args: {
    orderId: v.id("orders"),
    expectedVersion: v.int64(),
    purchaseOrderNumber: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    buyerReference: v.optional(v.string()),
    supplierReference: v.optional(v.string()),
    costCenter: v.optional(v.string()),
    projectCode: v.optional(v.string()),
    buyerContactId: v.id("contacts"),
    billingAddressId: v.id("addresses"),
    shippingAddressId: v.id("addresses"),
    orderDate: v.string(),
    issueDate: v.string(),
    requestedDeliveryDate: v.string(),
    supplierAcceptanceDeadline: v.number(),
    fundingDeadline: v.number(),
    validUntil: v.optional(v.number()),
    assetKey: v.union(v.literal("testnet:XLM"), v.literal("testnet:USDC")),
    buyerInternalNotes: v.optional(v.string()),
  },
  returns: draftMutationResultValidator,
  handler: async (ctx, args) => {
    const records = await requireMutableDraft(ctx, args.orderId, args.expectedVersion);
    if (!["owner", "admin", "procurement"].includes(records.membership.role)) {
      throw businessError("ORGANIZATION_FORBIDDEN");
    }
    let po;
    try {
      po = normalizePurchaseOrderNumber(args.purchaseOrderNumber);
    } catch {
      throw businessError("ORDER_INVALID", {
        fields: { purchaseOrderNumber: "Enter a valid purchase order number." },
      });
    }
    const duplicate = await ctx.db
      .query("orders")
      .withIndex("by_buyer_and_normalizedPurchaseOrderNumber", (index) =>
        index
          .eq("buyerOrganizationId", records.organization._id)
          .eq("normalizedPurchaseOrderNumber", po.comparison),
      )
      .unique();
    if (duplicate && duplicate._id !== records.order._id) {
      throw businessError("PO_NUMBER_DUPLICATE", {
        fields: { purchaseOrderNumber: "Already used by this buyer." },
      });
    }
    const [contact, billingAddress, shippingAddress] = await Promise.all([
      ctx.db.get("contacts", args.buyerContactId),
      ctx.db.get("addresses", args.billingAddressId),
      ctx.db.get("addresses", args.shippingAddressId),
    ]);
    if (
      !contact ||
      contact.organizationId !== records.organization._id ||
      !billingAddress ||
      billingAddress.organizationId !== records.organization._id ||
      !shippingAddress ||
      shippingAddress.organizationId !== records.organization._id
    ) {
      throw businessError("ORDER_INVALID");
    }
    const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
    if (
      !datePattern.test(args.orderDate) ||
      !datePattern.test(args.issueDate) ||
      !datePattern.test(args.requestedDeliveryDate) ||
      args.requestedDeliveryDate < args.issueDate ||
      args.supplierAcceptanceDeadline > args.fundingDeadline
    ) {
      throw businessError("ORDER_INVALID", {
        fields: { dates: "Review the order dates and deadlines." },
      });
    }
    const asset = resolveOrderAsset(args.assetKey);
    const now = Date.now();
    const title = boundedText(args.title, 2, 160, "title");
    const description = optionalText(args.description, 2_000, "description");
    const buyerInternalNotes = optionalText(args.buyerInternalNotes, 2_000, "buyerInternalNotes");
    await ctx.db.patch("orderRevisions", records.revision._id, {
      purchaseOrderNumber: po.display,
      title,
      description,
      buyerReference: optionalText(args.buyerReference, 120, "buyerReference"),
      supplierReference: optionalText(args.supplierReference, 120, "supplierReference"),
      costCenter: optionalText(args.costCenter, 120, "costCenter"),
      projectCode: optionalText(args.projectCode, 120, "projectCode"),
      timezone: records.organization.defaultTimezone ?? records.principal.user.timezone,
      buyerContactSnapshot: snapshotContact(contact),
      billingAddressSnapshot: snapshotAddress(billingAddress),
      shippingAddressSnapshot: snapshotAddress(shippingAddress),
      orderDate: args.orderDate,
      issueDate: args.issueDate,
      requestedDeliveryDate: args.requestedDeliveryDate,
      supplierAcceptanceDeadline: args.supplierAcceptanceDeadline,
      fundingDeadline: args.fundingDeadline,
      validUntil: args.validUntil,
      assetKey: asset.key,
      assetCode: asset.code,
      assetIssuer: asset.issuer ?? undefined,
      assetContractId: asset.contractId,
      assetDecimals: asset.decimals,
      buyerInternalNotes,
      updatedAt: now,
      version: records.revision.version + 1n,
    });
    await ctx.db.patch("orders", records.order._id, {
      purchaseOrderNumber: po.display,
      normalizedPurchaseOrderNumber: po.comparison,
      title,
      assetKey: asset.key,
      assetCode: asset.code,
      issueDate: args.issueDate,
      updatedAt: now,
      sortTimestamp: now,
    });
    return {
      orderId: records.order._id,
      revisionId: records.revision._id,
      version: records.revision.version + 1n,
      totals: publicRevision(records.revision).totals,
    };
  },
});

export const upsertLine = mutation({
  args: {
    orderId: v.id("orders"),
    expectedVersion: v.int64(),
    line: orderLineInputValidator,
  },
  returns: draftMutationResultValidator,
  handler: async (ctx, args) => {
    const records = await requireMutableDraft(ctx, args.orderId, args.expectedVersion);
    if (!["owner", "admin", "procurement"].includes(records.membership.role)) {
      throw businessError("ORGANIZATION_FORBIDDEN");
    }
    if (args.line.lineNumber <= 0n || args.line.lineNumber > 100n) {
      throw businessError("ORDER_INVALID", {
        fields: { lineNumber: "Use a line number from 1 to 100." },
      });
    }
    let discount: OrderDiscount;
    if (args.line.discountKind === "fixed") {
      if (args.line.discountBaseUnits === undefined) {
        throw businessError("AMOUNT_INVALID");
      }
      discount = { kind: "fixed", baseUnits: args.line.discountBaseUnits };
    } else if (args.line.discountKind === "rate") {
      if (args.line.discountBps === undefined) {
        throw businessError("AMOUNT_INVALID");
      }
      discount = { kind: "rate", bps: args.line.discountBps };
    } else {
      discount = { kind: "none" };
    }
    let amounts;
    try {
      amounts = calculateOrderLine({
        quantityCoefficient: args.line.quantityCoefficient,
        quantityScale: Number(args.line.quantityScale),
        unitPriceBaseUnits: args.line.unitPriceBaseUnits,
        discount,
        taxBps: args.line.taxBps,
      });
    } catch (error) {
      throw businessError(
        error instanceof Error && error.message === "AMOUNT_OVERFLOW"
          ? "AMOUNT_OVERFLOW"
          : "AMOUNT_INVALID",
      );
    }
    const existing = await ctx.db
      .query("orderLines")
      .withIndex("by_revisionId_lineNumber", (index) =>
        index.eq("revisionId", records.revision._id).eq("lineNumber", args.line.lineNumber),
      )
      .unique();
    const now = Date.now();
    const values = {
      lineNumber: args.line.lineNumber,
      name: boundedText(args.line.name, 1, 160, "lineName"),
      sku: optionalText(args.line.sku, 120, "sku"),
      supplierSku: optionalText(args.line.supplierSku, 120, "supplierSku"),
      description: optionalText(args.line.description, 2_000, "lineDescription"),
      category: optionalText(args.line.category, 120, "category"),
      manufacturer: optionalText(args.line.manufacturer, 120, "manufacturer"),
      brand: optionalText(args.line.brand, 120, "brand"),
      origin: optionalText(args.line.origin, 120, "origin"),
      quantityCoefficient: args.line.quantityCoefficient,
      quantityScale: args.line.quantityScale,
      unitOfMeasure: boundedText(args.line.unitOfMeasure, 1, 40, "unitOfMeasure"),
      unitPriceBaseUnits: args.line.unitPriceBaseUnits,
      discountKind: args.line.discountKind,
      discountBaseUnitsInput: args.line.discountBaseUnits,
      discountBps: args.line.discountBps,
      taxBps: args.line.taxBps,
      taxCode: optionalText(args.line.taxCode, 40, "taxCode"),
      requiresInspection: args.line.requiresInspection,
      ...amounts,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch("orderLines", existing._id, {
        ...values,
        version: existing.version + 1n,
      });
    } else {
      const count = records.lines.length;
      if (count >= 100) throw businessError("ORDER_INVALID");
      await ctx.db.insert("orderLines", {
        revisionId: records.revision._id,
        ...values,
        createdAt: now,
        version: 1n,
      });
    }
    const recalculated = await recalculateRevision(ctx, records.revision);
    const nextVersion = records.revision.version + 1n;
    await ctx.db.patch("orderRevisions", records.revision._id, {
      ...recalculated.totals,
      updatedAt: now,
      version: nextVersion,
    });
    await ctx.db.patch("orders", records.order._id, {
      grandTotalBaseUnits: recalculated.totals.grandTotalBaseUnits,
      updatedAt: now,
      sortTimestamp: now,
    });
    return {
      orderId: records.order._id,
      revisionId: records.revision._id,
      version: nextVersion,
      totals: recalculated.totals,
    };
  },
});

export const saveTerms = mutation({
  args: {
    orderId: v.id("orders"),
    expectedVersion: v.int64(),
    deliveryMethod: v.string(),
    shippingResponsibility: v.string(),
    freightChargeTreatment: v.string(),
    inspectionPeriodHours: v.int64(),
    refundPolicy: v.string(),
    shippingTotalBaseUnits: v.int64(),
    deliveryWindow: v.optional(v.string()),
    incoterm: v.optional(v.string()),
    namedLocation: v.optional(v.string()),
    handlingInstructions: v.optional(v.string()),
    acceptanceCriteria: v.optional(v.string()),
    warrantyText: v.optional(v.string()),
    returnTerms: v.optional(v.string()),
    sharedNotes: v.optional(v.string()),
  },
  returns: draftMutationResultValidator,
  handler: async (ctx, args) => {
    const records = await requireMutableDraft(ctx, args.orderId, args.expectedVersion);
    if (!["owner", "admin", "procurement"].includes(records.membership.role)) {
      throw businessError("ORGANIZATION_FORBIDDEN");
    }
    if (args.inspectionPeriodHours < 0n || args.inspectionPeriodHours > 8_760n) {
      throw businessError("ORDER_INVALID");
    }
    const recalculated = await recalculateRevision(
      ctx,
      records.revision,
      args.shippingTotalBaseUnits,
    );
    const now = Date.now();
    const nextVersion = records.revision.version + 1n;
    await ctx.db.patch("orderRevisions", records.revision._id, {
      deliveryMethod: boundedText(args.deliveryMethod, 1, 120, "deliveryMethod"),
      shippingResponsibility: boundedText(
        args.shippingResponsibility,
        1,
        120,
        "shippingResponsibility",
      ),
      freightChargeTreatment: boundedText(
        args.freightChargeTreatment,
        1,
        120,
        "freightChargeTreatment",
      ),
      inspectionPeriodHours: args.inspectionPeriodHours,
      refundPolicy: boundedText(args.refundPolicy, 1, 2_000, "refundPolicy"),
      deliveryWindow: optionalText(args.deliveryWindow, 240, "deliveryWindow"),
      incoterm: optionalText(args.incoterm, 40, "incoterm"),
      namedLocation: optionalText(args.namedLocation, 160, "namedLocation"),
      handlingInstructions: optionalText(args.handlingInstructions, 2_000, "handlingInstructions"),
      acceptanceCriteria: optionalText(args.acceptanceCriteria, 2_000, "acceptanceCriteria"),
      warrantyText: optionalText(args.warrantyText, 2_000, "warrantyText"),
      returnTerms: optionalText(args.returnTerms, 2_000, "returnTerms"),
      sharedNotes: optionalText(args.sharedNotes, 2_000, "sharedNotes"),
      ...recalculated.totals,
      updatedAt: now,
      version: nextVersion,
    });
    await ctx.db.patch("orders", records.order._id, {
      grandTotalBaseUnits: recalculated.totals.grandTotalBaseUnits,
      updatedAt: now,
      sortTimestamp: now,
    });
    return {
      orderId: records.order._id,
      revisionId: records.revision._id,
      version: nextVersion,
      totals: recalculated.totals,
    };
  },
});

export const removeLine = mutation({
  args: {
    orderId: v.id("orders"),
    lineId: v.id("orderLines"),
    expectedVersion: v.int64(),
  },
  returns: draftMutationResultValidator,
  handler: async (ctx, args) => {
    const records = await requireMutableDraft(ctx, args.orderId, args.expectedVersion);
    if (!["owner", "admin", "procurement"].includes(records.membership.role)) {
      throw businessError("ORGANIZATION_FORBIDDEN");
    }
    const line = await ctx.db.get("orderLines", args.lineId);
    if (!line || line.revisionId !== records.revision._id) {
      throw businessError("ORDER_NOT_FOUND");
    }
    await ctx.db.delete("orderLines", line._id);
    const recalculated = await recalculateRevision(ctx, records.revision);
    const now = Date.now();
    const nextVersion = records.revision.version + 1n;
    await ctx.db.patch("orderRevisions", records.revision._id, {
      ...recalculated.totals,
      updatedAt: now,
      version: nextVersion,
    });
    await ctx.db.patch("orders", records.order._id, {
      grandTotalBaseUnits: recalculated.totals.grandTotalBaseUnits,
      updatedAt: now,
      sortTimestamp: now,
    });
    return {
      orderId: records.order._id,
      revisionId: records.revision._id,
      version: nextVersion,
      totals: recalculated.totals,
    };
  },
});

export const reorderLines = mutation({
  args: {
    orderId: v.id("orders"),
    expectedVersion: v.int64(),
    lineIds: v.array(v.id("orderLines")),
  },
  returns: draftMutationResultValidator,
  handler: async (ctx, args) => {
    const records = await requireMutableDraft(ctx, args.orderId, args.expectedVersion);
    if (!["owner", "admin", "procurement"].includes(records.membership.role)) {
      throw businessError("ORGANIZATION_FORBIDDEN");
    }
    if (
      args.lineIds.length !== records.lines.length ||
      args.lineIds.length > 100 ||
      new Set(args.lineIds).size !== args.lineIds.length ||
      args.lineIds.some((id) => !records.lines.some((line) => line._id === id))
    ) {
      throw businessError("ORDER_INVALID");
    }
    const now = Date.now();
    for (let index = 0; index < args.lineIds.length; index += 1) {
      const line = records.lines.find((candidate) => candidate._id === args.lineIds[index])!;
      await ctx.db.patch("orderLines", line._id, {
        lineNumber: BigInt(index + 1),
        updatedAt: now,
        version: line.version + 1n,
      });
    }
    const nextVersion = records.revision.version + 1n;
    await ctx.db.patch("orderRevisions", records.revision._id, {
      updatedAt: now,
      version: nextVersion,
    });
    await ctx.db.patch("orders", records.order._id, {
      updatedAt: now,
      sortTimestamp: now,
    });
    return {
      orderId: records.order._id,
      revisionId: records.revision._id,
      version: nextVersion,
      totals: publicRevision(records.revision).totals,
    };
  },
});

export const getReview = query({
  args: { orderId: v.id("orders") },
  returns: reviewProjectionValidator,
  handler: async (ctx, args) => {
    const records = await loadDraftRecords(ctx, args.orderId);
    const blockers = getOrderBlockers(records.revision, records.lines);
    const termsHash =
      blockers.length === 0 ? await hashOrderTermsV1(records.revision, records.lines) : undefined;
    return {
      complete: blockers.length === 0,
      blockers,
      order: { id: records.order._id, agreementStatus: records.order.agreementStatus },
      revision: publicRevision(records.revision),
      lines: records.lines.sort((a, b) => Number(a.lineNumber - b.lineNumber)).map(publicLine),
      totals: publicRevision(records.revision).totals,
      ...(termsHash ? { termsHash } : {}),
    };
  },
});

export { loadDraftRecords, publicLine, publicRevision };
