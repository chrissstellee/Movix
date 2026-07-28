import { computeProfileReadiness, roleCan, type Capability } from "@repo/domain";

import { getSingleActiveOrganizationContext } from "./authorization";
import { businessError } from "./errors";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type OrderCtx = QueryCtx | MutationCtx;

export async function getBuyerContext(ctx: OrderCtx) {
  const context = await getSingleActiveOrganizationContext(ctx);
  if (context.kind === "none") {
    throw businessError("ORGANIZATION_FORBIDDEN");
  }
  if (context.kind === "multiple") {
    throw businessError("MULTIPLE_ORGANIZATIONS_UNSUPPORTED");
  }
  if (
    context.organization.capability !== "buyer" &&
    context.organization.capability !== "buyer_supplier"
  ) {
    throw businessError("ORGANIZATION_FORBIDDEN");
  }
  const [contacts, addresses] = await Promise.all([
    ctx.db
      .query("contacts")
      .withIndex("by_organizationId", (query) =>
        query.eq("organizationId", context.organization._id),
      )
      .take(50),
    ctx.db
      .query("addresses")
      .withIndex("by_organizationId", (query) =>
        query.eq("organizationId", context.organization._id),
      )
      .take(50),
  ]);
  const primaryContact =
    contacts.find(
      (contact) =>
        contact.isPrimary &&
        ["general", "procurement", "accounts_payable", "sales", "shipping", "legal"].includes(
          contact.type,
        ),
    ) ?? null;
  const readiness = computeProfileReadiness({
    hasRequiredOrganizationFields: Boolean(
      context.organization.registrationCountry &&
      context.organization.businessEmail &&
      context.organization.defaultTimezone &&
      context.organization.profileAttestationVersion,
    ),
    hasPrimaryContact: Boolean(primaryContact),
    hasRegisteredAddress: addresses.some((address) => address.type === "registered"),
    capability: context.organization.capability,
  });
  return { ...context, contacts, addresses, primaryContact, readiness };
}

export async function requireBuyerCapability(ctx: OrderCtx, capability: Capability) {
  const context = await getBuyerContext(ctx);
  if (!roleCan(context.membership.role, capability)) {
    throw businessError("ORGANIZATION_FORBIDDEN");
  }
  if (!context.readiness.buyerReady) {
    throw businessError("BUYER_NOT_READY", {
      fields: Object.fromEntries(
        context.readiness.missing.map((item) => [item.code, item.settingsPath]),
      ),
    });
  }
  return context;
}

export async function requireBuyerOrder(
  ctx: OrderCtx,
  orderId: Id<"orders">,
  capability?: Capability,
) {
  const context = capability
    ? await requireBuyerCapability(ctx, capability)
    : await getBuyerContext(ctx);
  const order = await ctx.db.get("orders", orderId);
  if (!order || order.buyerOrganizationId !== context.organization._id) {
    throw businessError("ORDER_NOT_FOUND");
  }
  return { ...context, order };
}
