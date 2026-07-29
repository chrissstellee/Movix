import { computeProfileReadiness, roleCan, type Capability } from "@repo/domain";

import { getSingleActiveOrganizationContext } from "./authorization";
import { businessError } from "./errors";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type OrderCtx = QueryCtx | MutationCtx;

export async function getSupplierContext(ctx: OrderCtx) {
  const context = await getSingleActiveOrganizationContext(ctx);
  if (context.kind !== "single") {
    throw businessError(
      context.kind === "multiple"
        ? "MULTIPLE_ORGANIZATIONS_UNSUPPORTED"
        : "ORDER_DECISION_FORBIDDEN",
    );
  }
  if (
    !["supplier", "buyer_supplier"].includes(context.organization.capability) ||
    context.organization.verificationStatus !== "verified"
  ) {
    throw businessError("ORDER_DECISION_FORBIDDEN");
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
  const readiness = computeProfileReadiness({
    hasRequiredOrganizationFields: Boolean(
      context.organization.registrationCountry &&
      context.organization.businessEmail &&
      context.organization.defaultTimezone &&
      context.organization.profileAttestationVersion,
    ),
    hasPrimaryContact: contacts.some((contact) => contact.isPrimary),
    hasRegisteredAddress: addresses.some((address) => address.type === "registered"),
    capability: context.organization.capability,
  });
  return { ...context, readiness };
}

export async function requireSupplierOrder(
  ctx: OrderCtx,
  orderId: Id<"orders">,
  capability?: Capability,
) {
  const context = await getSupplierContext(ctx);
  if (capability && !roleCan(context.membership.role, capability)) {
    throw businessError("ORDER_DECISION_FORBIDDEN");
  }
  const order = await ctx.db.get("orders", orderId);
  if (!order || order.supplierOrganizationId !== context.organization._id) {
    throw businessError("ORDER_NOT_FOUND");
  }
  return { ...context, order };
}
