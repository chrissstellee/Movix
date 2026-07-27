import { roleCan, type Capability, type OrganizationRole } from "@repo/domain";

import { businessError } from "./errors";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type BusinessCtx = QueryCtx | MutationCtx;

export interface CurrentPrincipal {
  user: Doc<"users">;
  wallet: Doc<"wallets">;
  sessionFamily: Doc<"authSessionFamilies">;
}

export async function getCurrentPrincipal(ctx: BusinessCtx): Promise<CurrentPrincipal | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const familyPublicId = identity.session_family_id;
  if (typeof familyPublicId !== "string") {
    return null;
  }
  const [user, sessionFamily] = await Promise.all([
    ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (query) =>
        query.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique(),
    ctx.db
      .query("authSessionFamilies")
      .withIndex("by_familyId", (query) => query.eq("familyId", familyPublicId))
      .unique(),
  ]);

  if (
    !user ||
    user.status !== "active" ||
    !sessionFamily ||
    sessionFamily.revokedAt ||
    sessionFamily.userId !== user._id
  ) {
    return null;
  }
  const wallet = await ctx.db.get("wallets", sessionFamily.walletId);
  if (!wallet || wallet.userId !== user._id || wallet.network !== "testnet") {
    return null;
  }
  return { user, wallet, sessionFamily };
}

export async function requireCurrentUser(ctx: BusinessCtx): Promise<CurrentPrincipal> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw businessError("UNAUTHENTICATED");
  }
  const principal = await getCurrentPrincipal(ctx);
  if (!principal) {
    throw businessError("USER_INACTIVE");
  }
  return principal;
}

export async function requireActiveMembership(
  ctx: BusinessCtx,
  organizationId: Id<"organizations">,
): Promise<{
  principal: CurrentPrincipal;
  membership: Doc<"memberships">;
  organization: Doc<"organizations">;
}> {
  const principal = await requireCurrentUser(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_organizationId_userId", (query) =>
      query.eq("organizationId", organizationId).eq("userId", principal.user._id),
    )
    .unique();
  if (!membership || membership.status !== "active") {
    throw businessError("ORGANIZATION_FORBIDDEN");
  }
  const organization = await ctx.db.get("organizations", organizationId);
  if (!organization || organization.status !== "active") {
    throw businessError("ORGANIZATION_INACTIVE");
  }
  return { principal, membership, organization };
}

export async function requireRole(
  ctx: BusinessCtx,
  organizationId: Id<"organizations">,
  roles: readonly OrganizationRole[],
) {
  const context = await requireActiveMembership(ctx, organizationId);
  if (!roles.includes(context.membership.role)) {
    throw businessError("ORGANIZATION_FORBIDDEN");
  }
  return context;
}

export async function requireCapability(
  ctx: BusinessCtx,
  organizationId: Id<"organizations">,
  capability: Capability,
) {
  const context = await requireActiveMembership(ctx, organizationId);
  if (!roleCan(context.membership.role, capability)) {
    throw businessError("ORGANIZATION_FORBIDDEN");
  }
  return context;
}

export async function getSingleActiveOrganizationContext(ctx: BusinessCtx) {
  const principal = await requireCurrentUser(ctx);
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_status", (query) =>
      query.eq("userId", principal.user._id).eq("status", "active"),
    )
    .take(2);

  if (memberships.length === 0) {
    return { kind: "none" as const, principal };
  }
  if (memberships.length > 1) {
    return { kind: "multiple" as const, principal };
  }
  const membership = memberships[0]!;
  const organization = await ctx.db.get("organizations", membership.organizationId);
  if (!organization || organization.status !== "active") {
    throw businessError("ORGANIZATION_INACTIVE");
  }
  return { kind: "single" as const, principal, membership, organization };
}
