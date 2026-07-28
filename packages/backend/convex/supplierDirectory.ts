import { computeProfileReadiness } from "@repo/domain";

import { query } from "./_generated/server";
import { businessError } from "./lib/errors";
import { requireBuyerCapability } from "./lib/orderAuthorization";
import { supplierSummaryValidator, supplierTargetValidator } from "./orderValidators";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type SupplierCtx = QueryCtx | MutationCtx;
export type SupplierTarget =
  | { kind: "wallet"; walletAddress: string }
  | { kind: "relationship"; relationshipId: Id<"relationships"> };

export async function resolveSupplierTarget(
  ctx: SupplierCtx,
  buyerOrganizationId: Id<"organizations">,
  target: SupplierTarget,
) {
  let supplierOrganizationId: Id<"organizations"> | undefined;
  let walletAddress = "";
  let relationship =
    target.kind === "relationship"
      ? await ctx.db.get("relationships", target.relationshipId)
      : null;

  if (target.kind === "relationship") {
    if (
      !relationship ||
      relationship.buyerOrganizationId !== buyerOrganizationId ||
      relationship.status !== "active" ||
      !relationship.supplierOrganizationId
    ) {
      throw businessError("SUPPLIER_INELIGIBLE");
    }
    supplierOrganizationId = relationship.supplierOrganizationId;
    const supplier = await ctx.db.get("organizations", supplierOrganizationId);
    if (supplier) {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (query) => query.eq("userId", supplier.createdByUserId))
        .first();
      walletAddress = wallet?.address ?? "";
    }
  } else {
    const exactWallet = target.walletAddress.normalize("NFKC").trim().toUpperCase();
    const wallets = await ctx.db
      .query("wallets")
      .withIndex("by_address_and_network", (query) =>
        query.eq("address", exactWallet).eq("network", "testnet"),
      )
      .take(2);
    if (wallets.length !== 1) {
      throw businessError("SUPPLIER_NOT_RESOLVED");
    }
    walletAddress = exactWallet;
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_status", (query) =>
        query.eq("userId", wallets[0]!.userId).eq("status", "active"),
      )
      .take(10);
    if (memberships.some((membership) => membership.organizationId === buyerOrganizationId)) {
      throw businessError("SELF_DEALING_NOT_ALLOWED");
    }
    const candidates = [];
    for (const membership of memberships) {
      const organization = await ctx.db.get("organizations", membership.organizationId);
      if (
        organization?.status === "active" &&
        (organization.capability === "supplier" || organization.capability === "buyer_supplier")
      ) {
        candidates.push(organization);
      }
    }
    if (candidates.length !== 1) {
      throw businessError("SUPPLIER_NOT_RESOLVED");
    }
    supplierOrganizationId = candidates[0]!._id;
    relationship = await ctx.db
      .query("relationships")
      .withIndex("by_buyerOrganizationId_supplierOrganizationId", (query) =>
        query
          .eq("buyerOrganizationId", buyerOrganizationId)
          .eq("supplierOrganizationId", supplierOrganizationId),
      )
      .unique();
    if (relationship?.status === "paused") {
      throw businessError("SUPPLIER_INELIGIBLE");
    }
  }

  if (!supplierOrganizationId) {
    throw businessError("SUPPLIER_NOT_RESOLVED");
  }
  if (supplierOrganizationId === buyerOrganizationId) {
    throw businessError("SELF_DEALING_NOT_ALLOWED");
  }
  const supplier = await ctx.db.get("organizations", supplierOrganizationId);
  if (
    !supplier ||
    supplier.status !== "active" ||
    (supplier.capability !== "supplier" && supplier.capability !== "buyer_supplier")
  ) {
    throw businessError("SUPPLIER_INELIGIBLE");
  }
  const [contacts, addresses] = await Promise.all([
    ctx.db
      .query("contacts")
      .withIndex("by_organizationId", (query) => query.eq("organizationId", supplierOrganizationId))
      .take(50),
    ctx.db
      .query("addresses")
      .withIndex("by_organizationId", (query) => query.eq("organizationId", supplierOrganizationId))
      .take(50),
  ]);
  const primaryContact = contacts.find((contact) => contact.isPrimary) ?? null;
  const registeredAddress = addresses.find((address) => address.type === "registered") ?? null;
  const readiness = computeProfileReadiness({
    hasRequiredOrganizationFields: Boolean(
      supplier.registrationCountry &&
      supplier.businessEmail &&
      supplier.defaultTimezone &&
      supplier.profileAttestationVersion,
    ),
    hasPrimaryContact: Boolean(primaryContact),
    hasRegisteredAddress: Boolean(registeredAddress),
    capability: supplier.capability,
  });
  if (!readiness.supplierReady || !primaryContact || !registeredAddress) {
    throw businessError("SUPPLIER_INELIGIBLE");
  }
  return {
    supplier,
    relationship,
    walletAddress,
    primaryContact,
    registeredAddress,
  };
}

export const resolveExact = query({
  args: { target: supplierTargetValidator },
  returns: supplierSummaryValidator,
  handler: async (ctx, args) => {
    const buyer = await requireBuyerCapability(ctx, "order:draft");
    const resolved = await resolveSupplierTarget(ctx, buyer.organization._id, args.target);
    return {
      organizationId: resolved.supplier._id,
      ...(resolved.relationship ? { relationshipId: resolved.relationship._id } : {}),
      legalName: resolved.supplier.legalName,
      ...(resolved.supplier.tradingName ? { tradingName: resolved.supplier.tradingName } : {}),
      walletAddress: resolved.walletAddress,
      status: "active" as const,
    };
  },
});
