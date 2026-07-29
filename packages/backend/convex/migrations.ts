import { Migrations } from "@convex-dev/migrations";
import { normalizeBusinessName } from "@repo/domain";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { internalQuery } from "./_generated/server";
import { transitionSupplierCounts } from "./lib/orderCounts";
import schema from "./schema";
import { agreementStatusValidator, supplierQueueStateValidator } from "./validators";

export const migrations = new Migrations(components.migrations, { schema });

export const normalizeLegacyOrganizations = migrations.define({
  table: "organizations",
  migrateOne: (_ctx, organization) => {
    const patch: Record<string, unknown> = {};

    if (organization.normalizedLegalName === undefined) {
      patch.normalizedLegalName = normalizeBusinessName(organization.legalName).comparison;
    }
    if (organization.verificationStatus === undefined) {
      patch.verificationStatus = "unverified";
    }
    if (organization.version === undefined) {
      patch.version = 1n;
    }

    return patch;
  },
});

export const normalizeLegacyMemberships = migrations.define({
  table: "memberships",
  migrateOne: (_ctx, membership) => ({
    acceptedAt: membership.acceptedAt ?? membership.createdAt,
  }),
});

export const normalizeLegacyContacts = migrations.define({
  table: "contacts",
  migrateOne: (_ctx, contact) => {
    const canonicalTypes = {
      primary: "general",
      billing: "accounts_payable",
      dispatch: "shipping",
      sales: "sales",
    } as const;

    return {
      type:
        contact.type in canonicalTypes
          ? canonicalTypes[contact.type as keyof typeof canonicalTypes]
          : contact.type,
      version: contact.version ?? 1n,
    };
  },
});

export const normalizeLegacyAddresses = migrations.define({
  table: "addresses",
  migrateOne: (_ctx, address) => ({
    type: address.type === "business" ? "registered" : address.type,
    version: address.version ?? 1n,
  }),
});

export const backfillSprint6Orders = migrations.define({
  table: "orders",
  migrateOne: (_ctx, order) => {
    if (order.migrationState !== undefined) return {};
    return {
      migrationState:
        order.agreementStatus === "draft" ? ("legacy_incomplete" as const) : ("current" as const),
    };
  },
});

export const backfillSprint6OrderRevisions = migrations.define({
  table: "orderRevisions",
  migrateOne: async (ctx, revision) => {
    const order = await ctx.db.get("orders", revision.orderId);
    if (!order) {
      const existingReports = await ctx.db
        .query("migrationFailureReports")
        .withIndex("by_documentId", (index) => index.eq("documentId", revision._id))
        .take(10);
      if (
        !existingReports.some(
          (report) =>
            report.migration === "backfillSprint6OrderRevisions" &&
            report.code === "ORPHAN_REVISION",
        )
      ) {
        await ctx.db.insert("migrationFailureReports", {
          migration: "backfillSprint6OrderRevisions",
          tableName: "orderRevisions",
          documentId: revision._id,
          code: "ORPHAN_REVISION",
          occurredAt: Date.now(),
        });
      }
      return {};
    }
    const patch: Record<string, unknown> = {};
    if (revision.termsHashVersion === undefined) {
      patch.termsHashVersion = "order-terms-v1";
    }
    if (revision.migrationState === undefined) {
      patch.migrationState =
        order.agreementStatus === "draft" && order.currentRevisionId === revision._id
          ? "legacy_incomplete"
          : "current";
    }
    return patch;
  },
});

export const sprint6MigrationInventory = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      orderId: v.id("orders"),
      revisionId: v.optional(v.id("orderRevisions")),
      agreementStatus: agreementStatusValidator,
      migrationState: v.optional(v.union(v.literal("current"), v.literal("legacy_incomplete"))),
      projectedMigrationState: v.union(v.literal("current"), v.literal("legacy_incomplete")),
      wouldWrite: v.boolean(),
      termsHashVersion: v.optional(
        v.union(v.literal("order-terms-v1"), v.literal("order-terms-v2")),
      ),
      termsHash: v.optional(v.string()),
      actionableFailure: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("orders").paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map(async (order) => {
        const revision = order.currentRevisionId
          ? await ctx.db.get("orderRevisions", order.currentRevisionId)
          : null;
        return {
          orderId: order._id,
          ...(revision ? { revisionId: revision._id } : {}),
          agreementStatus: order.agreementStatus,
          ...(order.migrationState ? { migrationState: order.migrationState } : {}),
          projectedMigrationState:
            order.migrationState ??
            (order.agreementStatus === "draft" ? "legacy_incomplete" : "current"),
          wouldWrite: order.migrationState === undefined,
          ...(revision?.termsHashVersion ? { termsHashVersion: revision.termsHashVersion } : {}),
          ...(revision?.termsHash ? { termsHash: revision.termsHash } : {}),
          ...(!revision && order.agreementStatus !== "cancelled"
            ? { actionableFailure: "MISSING_CURRENT_REVISION" }
            : {}),
        };
      }),
    );
    return { ...result, page };
  },
});

export const sprint6RevisionMigrationInventory = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      revisionId: v.id("orderRevisions"),
      orderId: v.id("orders"),
      orderExists: v.boolean(),
      termsHashVersion: v.optional(
        v.union(v.literal("order-terms-v1"), v.literal("order-terms-v2")),
      ),
      projectedTermsHashVersion: v.union(v.literal("order-terms-v1"), v.literal("order-terms-v2")),
      migrationState: v.optional(v.union(v.literal("current"), v.literal("legacy_incomplete"))),
      projectedMigrationState: v.optional(
        v.union(v.literal("current"), v.literal("legacy_incomplete")),
      ),
      wouldWrite: v.boolean(),
      actionableFailure: v.optional(v.literal("ORPHAN_REVISION")),
    }),
  ),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("orderRevisions").paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map(async (revision) => {
        const order = await ctx.db.get("orders", revision.orderId);
        const projectedMigrationState = order
          ? (revision.migrationState ??
            (order.agreementStatus === "draft" && order.currentRevisionId === revision._id
              ? ("legacy_incomplete" as const)
              : ("current" as const)))
          : undefined;
        return {
          revisionId: revision._id,
          orderId: revision.orderId,
          orderExists: Boolean(order),
          ...(revision.termsHashVersion ? { termsHashVersion: revision.termsHashVersion } : {}),
          projectedTermsHashVersion: revision.termsHashVersion ?? ("order-terms-v1" as const),
          ...(revision.migrationState ? { migrationState: revision.migrationState } : {}),
          ...(projectedMigrationState ? { projectedMigrationState } : {}),
          wouldWrite:
            Boolean(order) &&
            (revision.termsHashVersion === undefined || revision.migrationState === undefined),
          ...(!order ? { actionableFailure: "ORPHAN_REVISION" as const } : {}),
        };
      }),
    );
    return { ...result, page };
  },
});

export const sprint4OrderInventory = internalQuery({
  args: {},
  returns: v.object({
    relationshipsPresent: v.boolean(),
    ordersPresent: v.boolean(),
    orderRevisionsPresent: v.boolean(),
    orderLinesPresent: v.boolean(),
    canonicalReplacementSafe: v.boolean(),
  }),
  handler: async (ctx) => {
    const [relationships, orders, orderRevisions, orderLines] = await Promise.all([
      ctx.db.query("relationships").take(1),
      ctx.db.query("orders").take(1),
      ctx.db.query("orderRevisions").take(1),
      ctx.db.query("orderLines").take(1),
    ]);
    const result = {
      relationshipsPresent: relationships.length > 0,
      ordersPresent: orders.length > 0,
      orderRevisionsPresent: orderRevisions.length > 0,
      orderLinesPresent: orderLines.length > 0,
    };
    return {
      ...result,
      canonicalReplacementSafe: !Object.values(result).some(Boolean),
    };
  },
});

export const backfillSupplierQueueState = migrations.define({
  table: "orders",
  migrateOne: async (ctx, order) => {
    if (order.supplierQueueState) return {};
    const revision = order.currentRevisionId
      ? await ctx.db.get("orderRevisions", order.currentRevisionId)
      : null;
    if (!revision && order.agreementStatus !== "cancelled") {
      throw new Error(`SPRINT5_MIGRATION_ABORT_ORPHAN_REVISION:${order._id}`);
    }

    let supplierQueueState:
      | "not_queued"
      | "requires_decision"
      | "expired"
      | "accepted"
      | "rejected" = "not_queued";
    let decisionPatch: Record<string, unknown> = {};
    if (order.agreementStatus === "sent") {
      if (!order.supplierOrganizationId || !revision?.frozenAt || !revision.termsHash) {
        throw new Error(`SPRINT5_MIGRATION_ABORT_INCOMPLETE_SENT_ORDER:${order._id}`);
      }
      supplierQueueState =
        revision.supplierAcceptanceDeadline !== undefined &&
        Date.now() > revision.supplierAcceptanceDeadline
          ? "expired"
          : "requires_decision";
      if (supplierQueueState === "expired") {
        decisionPatch = {
          decisionWindowExpiredAt:
            order.decisionWindowExpiredAt ?? revision.supplierAcceptanceDeadline! + 1,
        };
      }
    }
    if (order.agreementStatus === "accepted" || order.agreementStatus === "rejected") {
      if (!order.supplierOrganizationId || !revision?.termsHash) {
        throw new Error(`SPRINT5_MIGRATION_ABORT_INCOMPLETE_DECIDED_ORDER:${order._id}`);
      }
      const decisions = await ctx.db
        .query("orderRevisionDecisions")
        .withIndex("by_orderId_and_decidedAt", (index) => index.eq("orderId", order._id))
        .take(2);
      const decision = decisions[0];
      if (
        decisions.length !== 1 ||
        !decision ||
        decision.decision !== order.agreementStatus ||
        decision.revisionId !== revision._id ||
        decision.revisionNumber !== revision.revisionNumber ||
        decision.buyerOrganizationId !== order.buyerOrganizationId ||
        decision.supplierOrganizationId !== order.supplierOrganizationId ||
        decision.termsHash !== revision.termsHash
      ) {
        throw new Error(`SPRINT5_MIGRATION_ABORT_MISSING_DECISION_IDENTITY:${order._id}`);
      }
      supplierQueueState = decision.decision;
      decisionPatch = {
        currentDecisionId: decision._id,
        ...(decision.decision === "accepted" ? { acceptedRevisionId: revision._id } : {}),
        decidedAt: decision.decidedAt,
        decisionSortTimestamp: decision.decidedAt,
      };
    }
    if (order.supplierOrganizationId) {
      await transitionSupplierCounts(
        ctx,
        order.supplierOrganizationId,
        undefined,
        supplierQueueState,
      );
    }
    return {
      supplierQueueState,
      ...decisionPatch,
      updatedAt: Date.now(),
    };
  },
});

export const sprint5OrderInventory = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      orderId: v.id("orders"),
      agreementStatus: agreementStatusValidator,
      supplierOrganizationId: v.optional(v.id("organizations")),
      currentRevisionId: v.optional(v.id("orderRevisions")),
      acceptedRevisionId: v.optional(v.id("orderRevisions")),
      currentDecisionId: v.optional(v.id("orderRevisionDecisions")),
      supplierQueueState: v.optional(supplierQueueStateValidator),
      revisionNumber: v.int64(),
      termsHash: v.optional(v.string()),
      supplierAcceptanceDeadline: v.optional(v.number()),
      missingCurrentRevision: v.boolean(),
      missingFrozenIdentity: v.boolean(),
      missingDecisionIdentity: v.boolean(),
      orphanDecisionReference: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("orders").paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map(async (order) => {
        const [revision, decision] = await Promise.all([
          order.currentRevisionId
            ? ctx.db.get("orderRevisions", order.currentRevisionId)
            : Promise.resolve(null),
          order.currentDecisionId
            ? ctx.db.get("orderRevisionDecisions", order.currentDecisionId)
            : Promise.resolve(null),
        ]);
        const decided =
          order.agreementStatus === "accepted" || order.agreementStatus === "rejected";
        return {
          orderId: order._id,
          agreementStatus: order.agreementStatus,
          ...(order.supplierOrganizationId
            ? { supplierOrganizationId: order.supplierOrganizationId }
            : {}),
          ...(order.currentRevisionId ? { currentRevisionId: order.currentRevisionId } : {}),
          ...(order.acceptedRevisionId ? { acceptedRevisionId: order.acceptedRevisionId } : {}),
          ...(order.currentDecisionId ? { currentDecisionId: order.currentDecisionId } : {}),
          ...(order.supplierQueueState ? { supplierQueueState: order.supplierQueueState } : {}),
          revisionNumber: order.currentRevisionNumber,
          ...(revision?.termsHash ? { termsHash: revision.termsHash } : {}),
          ...(revision?.supplierAcceptanceDeadline !== undefined
            ? { supplierAcceptanceDeadline: revision.supplierAcceptanceDeadline }
            : {}),
          missingCurrentRevision: !revision,
          missingFrozenIdentity:
            ["sent", "accepted", "rejected"].includes(order.agreementStatus) &&
            (!revision?.frozenAt || !revision.termsHash),
          missingDecisionIdentity: decided && !decision,
          orphanDecisionReference: Boolean(
            decision &&
            (decision.orderId !== order._id ||
              decision.revisionId !== order.currentRevisionId ||
              decision.decision !== order.agreementStatus),
          ),
        };
      }),
    );
    return { ...result, page };
  },
});

export const reconcileSupplierOrderCounts = internalQuery({
  args: { supplierOrganizationId: v.id("organizations") },
  returns: v.object({
    projected: v.object({
      requiresDecision: v.int64(),
      expired: v.int64(),
      accepted: v.int64(),
      rejected: v.int64(),
    }),
    actual: v.object({
      requiresDecision: v.int64(),
      expired: v.int64(),
      accepted: v.int64(),
      rejected: v.int64(),
    }),
    exact: v.boolean(),
    matches: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const states = ["requires_decision", "expired", "accepted", "rejected"] as const;
    const pages = await Promise.all(
      states.map((state) =>
        ctx.db
          .query("orders")
          .withIndex("by_supplier_queue_sortTimestamp", (index) =>
            index
              .eq("supplierOrganizationId", args.supplierOrganizationId)
              .eq("supplierQueueState", state),
          )
          .take(10_001),
      ),
    );
    const projected = await ctx.db
      .query("supplierOrderCounts")
      .withIndex("by_supplierOrganizationId", (index) =>
        index.eq("supplierOrganizationId", args.supplierOrganizationId),
      )
      .unique();
    const [
      requiresDecisionOrders = [],
      expiredOrders = [],
      acceptedOrders = [],
      rejectedOrders = [],
    ] = pages;
    const actual = {
      requiresDecision: BigInt(requiresDecisionOrders.length),
      expired: BigInt(expiredOrders.length),
      accepted: BigInt(acceptedOrders.length),
      rejected: BigInt(rejectedOrders.length),
    };
    const expected = {
      requiresDecision: projected?.requiresDecisionCount ?? 0n,
      expired: projected?.expiredCount ?? 0n,
      accepted: projected?.acceptedCount ?? 0n,
      rejected: projected?.rejectedCount ?? 0n,
    };
    const exact = pages.every((page) => page.length <= 10_000);
    return {
      projected: expected,
      actual,
      exact,
      matches:
        exact &&
        expected.requiresDecision === actual.requiresDecision &&
        expected.expired === actual.expired &&
        expected.accepted === actual.accepted &&
        expected.rejected === actual.rejected,
    };
  },
});

export const run = migrations.runner();
