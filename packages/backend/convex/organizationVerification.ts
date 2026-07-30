import { v } from "convex/values";

import { env, internalMutation, mutation, query } from "./_generated/server";
import { getSingleActiveOrganizationContext, requireCapability } from "./lib/authorization";
import { businessError } from "./lib/errors";
import { canonicalVerificationStatus } from "./lib/verification";
import {
  canonicalOrganizationVerificationStatusValidator,
  organizationVerificationStatusValidator,
} from "./validators";

const publicCaseValidator = v.object({
  status: canonicalOrganizationVerificationStatusValidator,
  evidenceDigest: v.optional(v.string()),
  reasonCode: v.optional(v.string()),
  recoveryUrl: v.optional(v.string()),
  submittedAt: v.optional(v.number()),
  reviewedAt: v.optional(v.number()),
  version: v.optional(v.int64()),
});

function validDigest(value: string) {
  return /^[a-f0-9]{64}$/u.test(value);
}

function developmentSelfVerificationEnabled() {
  return env.MOVIX_ENABLE_DEVELOPMENT_SELF_VERIFICATION === "enabled";
}

export const developmentOptions = query({
  args: {},
  returns: v.object({ selfVerificationAvailable: v.boolean() }),
  handler: async (ctx) => {
    const context = await getSingleActiveOrganizationContext(ctx);
    if (context.kind !== "single") {
      throw businessError("ORGANIZATION_FORBIDDEN");
    }
    return { selfVerificationAvailable: developmentSelfVerificationEnabled() };
  },
});

export const current = query({
  args: {},
  returns: publicCaseValidator,
  handler: async (ctx) => {
    const context = await getSingleActiveOrganizationContext(ctx);
    if (context.kind !== "single") {
      throw businessError("ORGANIZATION_FORBIDDEN");
    }
    const verificationCase = context.organization.verificationCaseId
      ? await ctx.db.get("organizationVerificationCases", context.organization.verificationCaseId)
      : null;
    return {
      status: canonicalVerificationStatus(context.organization.verificationStatus),
      ...(verificationCase?.evidenceDigest
        ? { evidenceDigest: verificationCase.evidenceDigest }
        : {}),
      ...(verificationCase?.reasonCode ? { reasonCode: verificationCase.reasonCode } : {}),
      ...(verificationCase?.recoveryUrl ? { recoveryUrl: verificationCase.recoveryUrl } : {}),
      ...(verificationCase?.submittedAt ? { submittedAt: verificationCase.submittedAt } : {}),
      ...(verificationCase?.reviewedAt ? { reviewedAt: verificationCase.reviewedAt } : {}),
      ...(verificationCase?.version ? { version: verificationCase.version } : {}),
    };
  },
});

export const verifyForDevelopment = mutation({
  args: {
    organizationId: v.id("organizations"),
    expectedOrganizationVersion: v.int64(),
  },
  returns: v.object({
    status: v.literal("verified"),
    caseId: v.id("organizationVerificationCases"),
    organizationVersion: v.int64(),
  }),
  handler: async (ctx, args) => {
    if (!developmentSelfVerificationEnabled()) {
      throw businessError("ORGANIZATION_VERIFICATION_INVALID");
    }
    const context = await requireCapability(ctx, args.organizationId, "organization:edit");
    if (context.organization.version !== args.expectedOrganizationVersion) {
      throw businessError("ORGANIZATION_VERIFICATION_STALE");
    }
    const status = canonicalVerificationStatus(context.organization.verificationStatus);
    if (status === "verified" || status === "pending") {
      throw businessError("ORGANIZATION_VERIFICATION_INVALID");
    }
    const now = Date.now();
    const referenceId = crypto.randomUUID();
    const evidenceDigest = `${crypto.randomUUID().replaceAll("-", "")}${crypto
      .randomUUID()
      .replaceAll("-", "")}`;
    const caseId = await ctx.db.insert("organizationVerificationCases", {
      organizationId: context.organization._id,
      status: "verified",
      evidenceDigest,
      evidenceReference: `development://self-verification/${referenceId}`,
      submittedByUserId: context.principal.user._id,
      submittedAt: now,
      reviewedBy: "Movix development self-verification",
      reviewedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const organizationVersion = context.organization.version + 1n;
    await ctx.db.patch("organizations", context.organization._id, {
      verificationStatus: "verified",
      verificationCaseId: caseId,
      updatedAt: now,
      version: organizationVersion,
    });
    await ctx.db.insert("auditEvents", {
      entityType: "organization_verification",
      entityId: caseId,
      organizationId: context.organization._id,
      actorUserId: context.principal.user._id,
      actorWalletAddress: context.principal.wallet.address,
      action: "organization.verification_development_verified",
      correlationId: crypto.randomUUID(),
      changedFields: ["verificationStatus", "verificationCaseId", "reviewedBy", "reviewedAt"],
      occurredAt: now,
    });
    return { status: "verified" as const, caseId, organizationVersion };
  },
});

export const submit = mutation({
  args: {
    organizationId: v.id("organizations"),
    evidenceDigest: v.string(),
    evidenceReference: v.optional(v.string()),
    expectedOrganizationVersion: v.int64(),
  },
  returns: v.object({
    status: v.literal("pending"),
    caseId: v.id("organizationVerificationCases"),
    organizationVersion: v.int64(),
  }),
  handler: async (ctx, args) => {
    const context = await requireCapability(ctx, args.organizationId, "organization:edit");
    if (context.organization.version !== args.expectedOrganizationVersion) {
      throw businessError("ORGANIZATION_VERIFICATION_STALE");
    }
    if (
      !validDigest(args.evidenceDigest) ||
      (args.evidenceReference && args.evidenceReference.length > 500)
    ) {
      throw businessError("ORGANIZATION_VERIFICATION_INVALID");
    }
    if (canonicalVerificationStatus(context.organization.verificationStatus) === "pending") {
      throw businessError("ORGANIZATION_VERIFICATION_STALE");
    }
    const now = Date.now();
    const caseId = await ctx.db.insert("organizationVerificationCases", {
      organizationId: context.organization._id,
      status: "pending",
      evidenceDigest: args.evidenceDigest,
      ...(args.evidenceReference ? { evidenceReference: args.evidenceReference } : {}),
      submittedByUserId: context.principal.user._id,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    const organizationVersion = context.organization.version + 1n;
    await ctx.db.patch("organizations", context.organization._id, {
      verificationStatus: "pending",
      verificationCaseId: caseId,
      updatedAt: now,
      version: organizationVersion,
    });
    await ctx.db.insert("auditEvents", {
      entityType: "organization_verification",
      entityId: caseId,
      organizationId: context.organization._id,
      actorUserId: context.principal.user._id,
      actorWalletAddress: context.principal.wallet.address,
      action: "organization.verification_submitted",
      correlationId: crypto.randomUUID(),
      changedFields: ["verificationStatus", "verificationCaseId"],
      occurredAt: now,
    });
    return { status: "pending" as const, caseId, organizationVersion };
  },
});

export const review = internalMutation({
  args: {
    caseId: v.id("organizationVerificationCases"),
    expectedVersion: v.int64(),
    status: v.union(v.literal("verified"), v.literal("action_required")),
    reviewer: v.string(),
    reasonCode: v.optional(v.string()),
    recoveryUrl: v.optional(v.string()),
    correlationId: v.string(),
  },
  returns: v.object({
    status: organizationVerificationStatusValidator,
    caseVersion: v.int64(),
  }),
  handler: async (ctx, args) => {
    const verificationCase = await ctx.db.get("organizationVerificationCases", args.caseId);
    if (!verificationCase || verificationCase.status !== "pending") {
      throw businessError("ORGANIZATION_VERIFICATION_INVALID");
    }
    if (verificationCase.version !== args.expectedVersion) {
      throw businessError("ORGANIZATION_VERIFICATION_STALE");
    }
    if (
      args.reviewer.trim().length < 2 ||
      args.reviewer.length > 160 ||
      (args.status === "action_required" && !args.reasonCode)
    ) {
      throw businessError("ORGANIZATION_VERIFICATION_INVALID");
    }
    const organization = await ctx.db.get("organizations", verificationCase.organizationId);
    if (!organization || organization.verificationCaseId !== verificationCase._id) {
      throw businessError("ORGANIZATION_VERIFICATION_STALE");
    }
    const now = Date.now();
    const caseVersion = verificationCase.version + 1n;
    await ctx.db.patch("organizationVerificationCases", verificationCase._id, {
      status: args.status,
      reviewedBy: args.reviewer.trim(),
      ...(args.reasonCode ? { reasonCode: args.reasonCode } : {}),
      ...(args.recoveryUrl ? { recoveryUrl: args.recoveryUrl } : {}),
      reviewedAt: now,
      updatedAt: now,
      version: caseVersion,
    });
    await ctx.db.patch("organizations", organization._id, {
      verificationStatus: args.status,
      updatedAt: now,
      version: organization.version + 1n,
    });
    await ctx.db.insert("auditEvents", {
      entityType: "organization_verification",
      entityId: verificationCase._id,
      organizationId: organization._id,
      action: `organization.verification_${args.status}`,
      correlationId: args.correlationId,
      changedFields: ["verificationStatus", "reviewedBy", "reviewedAt"],
      occurredAt: now,
    });
    return { status: args.status, caseVersion };
  },
});
