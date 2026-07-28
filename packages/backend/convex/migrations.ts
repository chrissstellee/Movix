import { Migrations } from "@convex-dev/migrations";
import { normalizeBusinessName } from "@repo/domain";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { internalQuery } from "./_generated/server";
import schema from "./schema";

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

export const run = migrations.runner();
