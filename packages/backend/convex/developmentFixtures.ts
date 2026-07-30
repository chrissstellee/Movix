import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action, env, internalQuery, query } from "./_generated/server";
import { businessError } from "./lib/errors";
import { requireBuyerCapability } from "./lib/orderAuthorization";

import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

const DAY = 86_400_000;
const enabled = () => env.MOVIX_ENABLE_DEVELOPMENT_FIXTURES === "enabled";

type SeedContext = {
  relationshipId: Id<"relationships">;
  buyerContactId: Id<"contacts">;
  billingAddressId: Id<"addresses">;
  shippingAddressId: Id<"addresses">;
};

type SeedResult = {
  orders: Array<{ orderId: Id<"orders">; purchaseOrderNumber: string }>;
  replay: boolean;
};

type CreatedDraft = {
  orderId: Id<"orders">;
  revisionId: Id<"orderRevisions">;
  version: bigint;
  replay: boolean;
};

const seedContextValidator = v.object({
  relationshipId: v.id("relationships"),
  buyerContactId: v.id("contacts"),
  billingAddressId: v.id("addresses"),
  shippingAddressId: v.id("addresses"),
});

async function resolveSeedContext(ctx: QueryCtx): Promise<SeedContext> {
  const buyer = await requireBuyerCapability(ctx, "order:draft");
  const relationship = (
    await ctx.db
      .query("relationships")
      .withIndex("by_buyerOrganizationId", (index) =>
        index.eq("buyerOrganizationId", buyer.organization._id),
      )
      .take(100)
  ).find(
    (candidate) => candidate.status === "active" && candidate.supplierOrganizationId !== undefined,
  );
  const registeredAddress = buyer.addresses.find((address) => address.type === "registered");
  const billingAddress =
    buyer.addresses.find((address) => address.type === "billing" && address.isDefault) ??
    buyer.addresses.find((address) => address.type === "billing") ??
    registeredAddress;
  const shippingAddress =
    buyer.addresses.find((address) => address.type === "shipping" && address.isDefault) ??
    buyer.addresses.find((address) => address.type === "shipping") ??
    registeredAddress;

  if (!relationship || !buyer.primaryContact || !billingAddress || !shippingAddress) {
    throw businessError("ORDER_INVALID", {
      fields: {
        developmentFixtures:
          "Complete the Importer profile and create or accept an active Exporter relationship first.",
      },
    });
  }
  return {
    relationshipId: relationship._id,
    buyerContactId: buyer.primaryContact._id,
    billingAddressId: billingAddress._id,
    shippingAddressId: shippingAddress._id,
  };
}

export const options = query({
  args: {},
  returns: v.object({
    available: v.boolean(),
    blocker: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    if (!enabled()) return { available: false };
    try {
      await resolveSeedContext(ctx);
      return { available: true };
    } catch {
      return {
        available: false,
        blocker:
          "Complete the Importer profile and create or accept an active Exporter relationship first.",
      };
    }
  },
});

export const prepare = internalQuery({
  args: {},
  returns: seedContextValidator,
  handler: resolveSeedContext,
});

const presets = [
  {
    title: "Vietnamese milled rice import",
    description: "Development fixture for an ASEAN rice shipment.",
    commodity: "Milled rice",
    category: "Rice",
    varietyOrGrade: "5% broken",
    specification: "Export quality, current crop",
    originCountry: "VN",
    packaging: "50 KG bags",
    quantityCoefficient: 25_000n,
    unitOfMeasure: "KG",
    unitPriceBaseUnits: 650_000n,
    incotermRule: "CIF",
    namedPlace: "Port of Manila",
  },
  {
    title: "Philippine green coffee beans",
    description: "Development fixture for an inspected coffee shipment.",
    commodity: "Arabica green coffee beans",
    category: "Coffee",
    varietyOrGrade: "Specialty grade",
    specification: "Moisture content at or below 12.5%",
    originCountry: "PH",
    packaging: "60 KG jute bags",
    quantityCoefficient: 8_000n,
    unitOfMeasure: "KG",
    unitPriceBaseUnits: 2_400_000n,
    incotermRule: "FOB",
    namedPlace: "Port of Davao",
  },
  {
    title: "Indonesian coconut oil supply",
    description: "Development fixture for a packaged coconut oil shipment.",
    commodity: "Refined coconut oil",
    category: "Edible oils",
    varietyOrGrade: "Food grade",
    specification: "RBD coconut oil suitable for food manufacturing",
    originCountry: "ID",
    packaging: "200 L food-grade drums",
    quantityCoefficient: 12_000n,
    unitOfMeasure: "L",
    unitPriceBaseUnits: 1_150_000n,
    incotermRule: "CFR",
    namedPlace: "Port of Cebu",
  },
] as const;

function dateAfter(now: number, days: number): string {
  return new Date(now + days * DAY).toISOString().slice(0, 10);
}

export const seedTradeOrders = action({
  args: { batchId: v.string() },
  returns: v.object({
    orders: v.array(
      v.object({
        orderId: v.id("orders"),
        purchaseOrderNumber: v.string(),
      }),
    ),
    replay: v.boolean(),
  }),
  handler: async (ctx, args): Promise<SeedResult> => {
    if (!enabled()) {
      throw businessError("ORGANIZATION_FORBIDDEN");
    }
    if (!/^[a-z0-9][a-z0-9-]{7,63}$/u.test(args.batchId)) {
      throw businessError("ORDER_INVALID", {
        fields: { batchId: "Use a lowercase development batch identifier." },
      });
    }

    const prepared: SeedContext = await ctx.runQuery(internal.developmentFixtures.prepare, {});
    const now = Date.now();
    const orderDate = dateAfter(now, 0);
    const poToken = args.batchId.replaceAll("-", "").slice(-10).toUpperCase();
    const orders: Array<{ orderId: Id<"orders">; purchaseOrderNumber: string }> = [];
    let wrote = false;

    for (const [index, preset] of presets.entries()) {
      const purchaseOrderNumber = `DEMO-${poToken}-${index + 1}`;
      const created: CreatedDraft = await ctx.runMutation(api.orderDrafts.create, {
        idempotencyKey: `development-fixture:${args.batchId}:${index + 1}`,
        termsHashVersion: "order-terms-v2",
      });
      wrote ||= !created.replay;
      let draft = await ctx.runQuery(api.orderDrafts.get, { orderId: created.orderId });

      if (!draft.revision.supplierOrganizationId) {
        await ctx.runMutation(api.orderDrafts.saveSupplier, {
          orderId: created.orderId,
          expectedVersion: draft.revision.version,
          target: { kind: "relationship", relationshipId: prepared.relationshipId },
        });
        wrote = true;
        draft = await ctx.runQuery(api.orderDrafts.get, { orderId: created.orderId });
      }
      if (!draft.revision.purchaseOrderNumber) {
        await ctx.runMutation(api.orderDrafts.saveHeader, {
          orderId: created.orderId,
          expectedVersion: draft.revision.version,
          purchaseOrderNumber,
          title: preset.title,
          description: preset.description,
          buyerReference: "Development sample data",
          projectCode: "SPRINT-06-DEMO",
          buyerContactId: prepared.buyerContactId,
          billingAddressId: prepared.billingAddressId,
          shippingAddressId: prepared.shippingAddressId,
          orderDate,
          issueDate: orderDate,
          requestedDeliveryDate: dateAfter(now, 45),
          supplierAcceptanceDeadline: now + 7 * DAY,
          fundingDeadline: now + 14 * DAY,
          validUntil: now + 15 * DAY,
          assetKey: "testnet:USDC",
          buyerInternalNotes: "Generated for development testing; safe to edit or cancel.",
        });
        wrote = true;
        draft = await ctx.runQuery(api.orderDrafts.get, { orderId: created.orderId });
      }
      if (draft.lines.length === 0) {
        await ctx.runMutation(api.orderDrafts.upsertLine, {
          orderId: created.orderId,
          expectedVersion: draft.revision.version,
          line: {
            lineNumber: 1n,
            name: preset.commodity,
            category: preset.category,
            varietyOrGrade: preset.varietyOrGrade,
            specification: preset.specification,
            originCountry: preset.originCountry,
            packaging: preset.packaging,
            quantityCoefficient: preset.quantityCoefficient,
            quantityScale: 0n,
            unitOfMeasure: preset.unitOfMeasure,
            unitPriceBaseUnits: preset.unitPriceBaseUnits,
            discountKind: "none",
            taxBps: 0n,
            requiresInspection: true,
          },
        });
        wrote = true;
        draft = await ctx.runQuery(api.orderDrafts.get, { orderId: created.orderId });
      }
      if (!draft.revision.deliveryMethod) {
        await ctx.runMutation(api.orderDrafts.saveTerms, {
          orderId: created.orderId,
          expectedVersion: draft.revision.version,
          deliveryMethod: "Ocean freight",
          shippingResponsibility: "Exporter",
          freightChargeTreatment: "Included in order total",
          inspectionPeriodHours: 72n,
          refundPolicy: "Refund if the accepted quantity, grade, or specification is not met.",
          shippingTotalBaseUnits: 1_000_000n,
          handlingInstructions: "Keep dry and protect packaging from contamination.",
          acceptanceCriteria: "Quantity, grade, specification, and required documents must match.",
        });
        wrote = true;
        draft = await ctx.runQuery(api.orderDrafts.get, { orderId: created.orderId });
      }
      if (!draft.revision.destinationCountry) {
        await ctx.runMutation(api.orderDrafts.saveAgriculturalTerms, {
          orderId: created.orderId,
          expectedVersion: draft.revision.version,
          destinationCountry: "PH",
          shipmentWindow: { from: dateAfter(now, 14), to: dateAfter(now, 21) },
          arrivalWindow: { from: dateAfter(now, 25), to: dateAfter(now, 40) },
          incoterm: {
            edition: "2020",
            rule: preset.incotermRule,
            namedPlace: preset.namedPlace,
          },
          requiredDocumentTypes: [
            "commercial_invoice",
            "packing_list",
            "phytosanitary_certificate",
          ],
        });
        wrote = true;
      }
      orders.push({ orderId: created.orderId, purchaseOrderNumber });
    }

    return { orders, replay: !wrote };
  },
});
