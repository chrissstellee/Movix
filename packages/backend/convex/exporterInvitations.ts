import { normalizeBusinessEmail } from "@repo/domain";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getSingleActiveOrganizationContext } from "./lib/authorization";
import { businessError } from "./lib/errors";
import { requireBuyerCapability } from "./lib/orderAuthorization";
import { requireVerifiedOrganization } from "./lib/verification";
import { exporterInvitationStatusValidator } from "./validators";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeWallet(value: string | undefined) {
  if (!value) return undefined;
  const wallet = value.normalize("NFKC").trim().toUpperCase();
  if (!/^G[A-D2-7][A-Z2-7]{54}$/u.test(wallet)) {
    throw businessError("EXPORTER_INVITATION_INVALID");
  }
  return wallet;
}

function publicInvitation(invitation: Doc<"exporterInvitations">) {
  const status =
    invitation.status === "issued" && invitation.expiresAt <= Date.now()
      ? ("expired" as const)
      : invitation.status;
  return {
    invitationId: invitation._id,
    importerOrganizationId: invitation.importerOrganizationId,
    status,
    expiresAt: invitation.expiresAt,
    ...(invitation.targetEmail ? { targetEmail: invitation.targetEmail } : {}),
    ...(invitation.targetWalletAddress
      ? { targetWalletAddress: invitation.targetWalletAddress }
      : {}),
    ...(invitation.intendedExporterOrganizationId
      ? { intendedExporterOrganizationId: invitation.intendedExporterOrganizationId }
      : {}),
    ...(invitation.relationshipId ? { relationshipId: invitation.relationshipId } : {}),
  };
}

const publicInvitationValidator = v.object({
  invitationId: v.id("exporterInvitations"),
  importerOrganizationId: v.id("organizations"),
  status: exporterInvitationStatusValidator,
  expiresAt: v.number(),
  targetEmail: v.optional(v.string()),
  targetWalletAddress: v.optional(v.string()),
  intendedExporterOrganizationId: v.optional(v.id("organizations")),
  relationshipId: v.optional(v.id("relationships")),
});

async function activeDuplicate(
  ctx: MutationCtx,
  importerOrganizationId: Id<"organizations">,
  target: {
    intendedExporterOrganizationId?: Id<"organizations">;
    targetWalletAddress?: string;
    targetEmail?: string;
  },
) {
  const invitations = await ctx.db
    .query("exporterInvitations")
    .withIndex("by_importerOrganizationId_and_status", (index) =>
      index.eq("importerOrganizationId", importerOrganizationId).eq("status", "issued"),
    )
    .take(100);
  const now = Date.now();
  return invitations.find(
    (invitation) =>
      invitation.expiresAt > now &&
      ((target.intendedExporterOrganizationId &&
        invitation.intendedExporterOrganizationId === target.intendedExporterOrganizationId) ||
        (target.targetWalletAddress &&
          invitation.targetWalletAddress === target.targetWalletAddress) ||
        (target.targetEmail && invitation.targetEmail === target.targetEmail)),
  );
}

export const issue = mutation({
  args: {
    intendedExporterOrganizationId: v.optional(v.id("organizations")),
    targetEmail: v.optional(v.string()),
    targetWalletAddress: v.optional(v.string()),
    expiresAt: v.number(),
  },
  returns: v.object({
    invitation: publicInvitationValidator,
    token: v.string(),
  }),
  handler: async (ctx, args) => {
    const importer = await requireBuyerCapability(ctx, "order:send");
    requireVerifiedOrganization(importer.organization);
    if (
      args.expiresAt <= Date.now() + 60_000 ||
      args.expiresAt > Date.now() + 30 * 24 * 60 * 60 * 1_000
    ) {
      throw businessError("EXPORTER_INVITATION_INVALID");
    }
    const targetWalletAddress = normalizeWallet(args.targetWalletAddress);
    let targetEmail: string | undefined;
    try {
      targetEmail = args.targetEmail ? normalizeBusinessEmail(args.targetEmail) : undefined;
    } catch {
      throw businessError("EXPORTER_INVITATION_INVALID");
    }
    if (!args.intendedExporterOrganizationId && !targetEmail && !targetWalletAddress) {
      throw businessError("EXPORTER_INVITATION_INVALID");
    }
    if (
      args.intendedExporterOrganizationId === importer.organization._id ||
      targetWalletAddress === importer.principal.wallet.address ||
      (targetEmail !== undefined &&
        targetEmail === importer.organization.businessEmail?.toLocaleLowerCase("und"))
    ) {
      throw businessError("SELF_DEALING_NOT_ALLOWED");
    }
    if (
      await activeDuplicate(ctx, importer.organization._id, {
        ...(args.intendedExporterOrganizationId
          ? { intendedExporterOrganizationId: args.intendedExporterOrganizationId }
          : {}),
        ...(targetWalletAddress ? { targetWalletAddress } : {}),
        ...(targetEmail ? { targetEmail } : {}),
      })
    ) {
      throw businessError("EXPORTER_INVITATION_DUPLICATE");
    }

    const token = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
    const tokenHash = await sha256(token);
    const now = Date.now();
    const invitationId = await ctx.db.insert("exporterInvitations", {
      importerOrganizationId: importer.organization._id,
      ...(args.intendedExporterOrganizationId
        ? { intendedExporterOrganizationId: args.intendedExporterOrganizationId }
        : {}),
      ...(targetEmail ? { targetEmail } : {}),
      ...(targetWalletAddress ? { targetWalletAddress } : {}),
      tokenHash,
      status: "issued",
      createdByUserId: importer.principal.user._id,
      expiresAt: args.expiresAt,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const invitation = (await ctx.db.get("exporterInvitations", invitationId))!;
    await ctx.db.insert("auditEvents", {
      entityType: "exporter_invitation",
      entityId: invitationId,
      organizationId: importer.organization._id,
      actorUserId: importer.principal.user._id,
      actorWalletAddress: importer.principal.wallet.address,
      action: "exporter.invitation_issued",
      correlationId: crypto.randomUUID(),
      changedFields: ["status", "expiresAt"],
      occurredAt: now,
    });
    return { invitation: publicInvitation(invitation), token };
  },
});

export const getByToken = query({
  args: { token: v.string() },
  returns: publicInvitationValidator,
  handler: async (ctx, args) => {
    const tokenHash = await sha256(args.token);
    const invitation = await ctx.db
      .query("exporterInvitations")
      .withIndex("by_tokenHash", (index) => index.eq("tokenHash", tokenHash))
      .unique();
    if (!invitation) throw businessError("EXPORTER_INVITATION_INVALID");
    return publicInvitation(invitation);
  },
});

export const accept = mutation({
  args: { token: v.string() },
  returns: publicInvitationValidator,
  handler: async (ctx, args) => {
    const context = await getSingleActiveOrganizationContext(ctx);
    if (context.kind !== "single") throw businessError("EXPORTER_INVITATION_WRONG_ORGANIZATION");
    if (!["supplier", "buyer_supplier"].includes(context.organization.capability)) {
      throw businessError("EXPORTER_INVITATION_WRONG_ORGANIZATION");
    }
    requireVerifiedOrganization(context.organization);
    const tokenHash = await sha256(args.token);
    const invitation = await ctx.db
      .query("exporterInvitations")
      .withIndex("by_tokenHash", (index) => index.eq("tokenHash", tokenHash))
      .unique();
    if (!invitation) throw businessError("EXPORTER_INVITATION_INVALID");
    if (invitation.status === "accepted") throw businessError("EXPORTER_INVITATION_USED");
    if (invitation.status === "revoked") throw businessError("EXPORTER_INVITATION_REVOKED");
    const now = Date.now();
    if (invitation.status === "expired" || invitation.expiresAt <= now) {
      throw businessError("EXPORTER_INVITATION_EXPIRED");
    }
    const emailMatches =
      !invitation.targetEmail ||
      invitation.targetEmail.toLocaleLowerCase("und") ===
        context.organization.businessEmail?.toLocaleLowerCase("und");
    const walletMatches =
      !invitation.targetWalletAddress ||
      invitation.targetWalletAddress === context.principal.wallet.address;
    const organizationMatches =
      !invitation.intendedExporterOrganizationId ||
      invitation.intendedExporterOrganizationId === context.organization._id;
    if (!emailMatches || !walletMatches || !organizationMatches) {
      throw businessError("EXPORTER_INVITATION_WRONG_ORGANIZATION");
    }
    if (invitation.importerOrganizationId === context.organization._id) {
      throw businessError("SELF_DEALING_NOT_ALLOWED");
    }
    let relationship = await ctx.db
      .query("relationships")
      .withIndex("by_buyerOrganizationId_supplierOrganizationId", (index) =>
        index
          .eq("buyerOrganizationId", invitation.importerOrganizationId)
          .eq("supplierOrganizationId", context.organization._id),
      )
      .unique();
    let relationshipId = relationship?._id;
    if (!relationship) {
      relationshipId = await ctx.db.insert("relationships", {
        buyerOrganizationId: invitation.importerOrganizationId,
        supplierOrganizationId: context.organization._id,
        ...(invitation.targetEmail ? { inviteEmail: invitation.targetEmail } : {}),
        ...(invitation.targetWalletAddress
          ? { inviteWalletAddress: invitation.targetWalletAddress }
          : {}),
        status: "active",
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    } else if (relationship.status !== "active") {
      await ctx.db.patch("relationships", relationship._id, {
        status: "active",
        updatedAt: now,
        version: relationship.version + 1n,
      });
    }
    await ctx.db.patch("exporterInvitations", invitation._id, {
      status: "accepted",
      acceptedByOrganizationId: context.organization._id,
      acceptedByUserId: context.principal.user._id,
      relationshipId,
      acceptedAt: now,
      updatedAt: now,
      version: invitation.version + 1n,
    });
    await ctx.db.insert("auditEvents", {
      entityType: "exporter_invitation",
      entityId: invitation._id,
      organizationId: context.organization._id,
      actorUserId: context.principal.user._id,
      actorWalletAddress: context.principal.wallet.address,
      action: "exporter.invitation_accepted",
      correlationId: crypto.randomUUID(),
      changedFields: ["status", "relationshipId", "acceptedAt"],
      occurredAt: now,
    });
    return publicInvitation((await ctx.db.get("exporterInvitations", invitation._id))!);
  },
});

export const revoke = mutation({
  args: {
    invitationId: v.id("exporterInvitations"),
    expectedVersion: v.int64(),
  },
  returns: publicInvitationValidator,
  handler: async (ctx, args) => {
    const importer = await requireBuyerCapability(ctx, "organization:edit");
    const invitation = await ctx.db.get("exporterInvitations", args.invitationId);
    if (
      !invitation ||
      invitation.importerOrganizationId !== importer.organization._id ||
      invitation.status !== "issued"
    ) {
      throw businessError("EXPORTER_INVITATION_INVALID");
    }
    if (invitation.version !== args.expectedVersion) {
      throw businessError("EXPORTER_INVITATION_INVALID");
    }
    const now = Date.now();
    await ctx.db.patch("exporterInvitations", invitation._id, {
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
      version: invitation.version + 1n,
    });
    return publicInvitation((await ctx.db.get("exporterInvitations", invitation._id))!);
  },
});
