import {
  collapseBusinessWhitespace,
  computeProfileReadiness,
  normalizeBusinessEmail,
  normalizeBusinessName,
  normalizeCountryCode,
  normalizePhone,
  validateAddress,
  validateBusinessUrl,
  validateTimezone,
} from "@repo/domain";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireActiveMembership, requireCapability } from "./lib/authorization";
import { getSingleActiveOrganizationContext } from "./lib/authorization";
import { businessError } from "./lib/errors";
import {
  businessSettingsValidator,
  currentContextValidator,
  updateResultValidator,
} from "./organizationValidators";
import {
  addressTypeValidator,
  contactTypeValidator,
  organizationCapabilityValidator,
  organizationEntityTypeValidator,
} from "./validators";

import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const nullableString = v.union(v.string(), v.null());

function readiness(
  organization: Doc<"organizations">,
  contact: Doc<"contacts"> | null,
  addresses: readonly Doc<"addresses">[],
) {
  return computeProfileReadiness({
    hasRequiredOrganizationFields: Boolean(
      organization.legalName &&
      organization.registrationCountry &&
      organization.businessEmail &&
      organization.defaultTimezone &&
      organization.profileAttestationVersion,
    ),
    hasPrimaryContact: Boolean(contact?.isPrimary && contact.email),
    hasRegisteredAddress: addresses.some(
      (address) =>
        address.type === "registered" &&
        Boolean(address.recipientName && address.line1 && address.city && address.countryCode),
    ),
    capability: organization.capability,
  });
}

async function loadProfileChildren(
  ctx: Parameters<typeof requireActiveMembership>[0],
  organizationId: Doc<"organizations">["_id"],
) {
  const [contacts, addresses] = await Promise.all([
    ctx.db
      .query("contacts")
      .withIndex("by_organizationId", (builder) => builder.eq("organizationId", organizationId))
      .take(20),
    ctx.db
      .query("addresses")
      .withIndex("by_organizationId", (builder) => builder.eq("organizationId", organizationId))
      .take(20),
  ]);
  const primaryContact =
    contacts.find(
      (contact) =>
        contact.isPrimary &&
        ["general", "procurement", "accounts_payable", "sales", "shipping", "legal"].includes(
          contact.type,
        ),
    ) ?? null;
  const canonicalAddresses = addresses.filter((address) =>
    ["registered", "billing", "shipping"].includes(address.type),
  );
  return { primaryContact, addresses: canonicalAddresses };
}

export const currentContext = query({
  args: {},
  returns: currentContextValidator,
  handler: async (ctx) => {
    const context = await getSingleActiveOrganizationContext(ctx);
    if (context.kind === "none") {
      return null;
    }
    const user = { id: context.principal.user._id };
    const wallet = {
      address: context.principal.wallet.address,
      network: "testnet" as const,
      verifiedAt: context.principal.wallet.verifiedAt,
    };
    if (context.kind === "multiple") {
      return { kind: "multiple" as const, user, wallet };
    }
    const children = await loadProfileChildren(ctx, context.organization._id);
    const allowedViews =
      context.organization.capability === "buyer_supplier"
        ? (["buyer", "supplier"] as const)
        : ([context.organization.capability] as const);
    return {
      kind: "ready" as const,
      user,
      wallet,
      organization: {
        id: context.organization._id,
        legalName: context.organization.legalName,
        ...(context.organization.tradingName
          ? { tradingName: context.organization.tradingName }
          : {}),
        capability: context.organization.capability,
        status: context.organization.status,
        verificationStatus: context.organization.verificationStatus ?? "unverified",
        version: context.organization.version,
      },
      membership: {
        role: context.membership.role,
        status: context.membership.status,
      },
      allowedViews: [...allowedViews],
      profileReadiness: readiness(
        context.organization,
        children.primaryContact,
        children.addresses,
      ),
    };
  },
});

export const getBusinessSettings = query({
  args: { organizationId: v.id("organizations") },
  returns: businessSettingsValidator,
  handler: async (ctx, args) => {
    const { organization } = await requireActiveMembership(ctx, args.organizationId);
    const children = await loadProfileChildren(ctx, organization._id);
    return {
      organization: {
        id: organization._id,
        legalName: organization.legalName,
        ...(organization.tradingName ? { tradingName: organization.tradingName } : {}),
        ...(organization.registrationCountry
          ? { registrationCountry: organization.registrationCountry }
          : {}),
        ...(organization.businessEmail ? { businessEmail: organization.businessEmail } : {}),
        capability: organization.capability,
        ...(organization.defaultTimezone ? { defaultTimezone: organization.defaultTimezone } : {}),
        status: organization.status,
        ...(organization.verificationStatus
          ? { verificationStatus: organization.verificationStatus }
          : {}),
        ...(organization.entityType ? { entityType: organization.entityType } : {}),
        ...(organization.registrationNumber
          ? { registrationNumber: organization.registrationNumber }
          : {}),
        ...(organization.taxId ? { taxId: organization.taxId } : {}),
        ...(organization.industry ? { industry: organization.industry } : {}),
        ...(organization.website ? { website: organization.website } : {}),
        ...(organization.businessPhone ? { businessPhone: organization.businessPhone } : {}),
        version: organization.version,
      },
      primaryContact: children.primaryContact
        ? {
            id: children.primaryContact._id,
            type:
              children.primaryContact.type === "primary"
                ? ("general" as const)
                : children.primaryContact.type === "billing"
                  ? ("accounts_payable" as const)
                  : children.primaryContact.type === "dispatch"
                    ? ("shipping" as const)
                    : children.primaryContact.type,
            name: children.primaryContact.name,
            email: children.primaryContact.email ?? "",
            ...(children.primaryContact.phone ? { phone: children.primaryContact.phone } : {}),
            ...(children.primaryContact.jobTitle
              ? { jobTitle: children.primaryContact.jobTitle }
              : {}),
            ...(children.primaryContact.department
              ? { department: children.primaryContact.department }
              : {}),
            version: children.primaryContact.version ?? 0n,
          }
        : null,
      addresses: children.addresses.map((address) => ({
        id: address._id,
        type: address.type as "registered" | "billing" | "shipping",
        label: address.label,
        recipientName: address.recipientName ?? address.label,
        line1: address.line1,
        ...(address.line2 ? { line2: address.line2 } : {}),
        city: address.city,
        ...(address.region ? { region: address.region } : {}),
        ...(address.postalCode ? { postalCode: address.postalCode } : {}),
        countryCode: address.countryCode,
        ...(address.deliveryInstructions
          ? { deliveryInstructions: address.deliveryInstructions }
          : {}),
        isDefault: address.isDefault ?? true,
        version: address.version ?? 0n,
      })),
      profileReadiness: readiness(organization, children.primaryContact, children.addresses),
    };
  },
});

async function auditChange(
  ctx: MutationCtx,
  input: {
    organizationId: Doc<"organizations">["_id"];
    entityType: string;
    entityId: string;
    action: string;
    changedFields: string[];
    requestId?: string;
    principal: Awaited<ReturnType<typeof requireCapability>>["principal"];
  },
) {
  await ctx.db.insert("auditEvents", {
    entityType: input.entityType,
    entityId: input.entityId,
    organizationId: input.organizationId,
    actorUserId: input.principal.user._id,
    actorWalletAddress: input.principal.wallet.address,
    action: input.action,
    correlationId: input.requestId ?? crypto.randomUUID(),
    changedFields: input.changedFields.slice(0, 32),
    occurredAt: Date.now(),
  });
}

function cleanOptional(value: string | null, maximum: number) {
  if (value === null || value.trim() === "") {
    return undefined;
  }
  const normalized = collapseBusinessWhitespace(value);
  if (normalized.length > maximum) {
    throw businessError("FIELD_INVALID");
  }
  return normalized;
}

export const updateProfile = mutation({
  args: {
    organizationId: v.id("organizations"),
    expectedVersion: v.int64(),
    patch: v.object({
      legalName: v.optional(v.string()),
      tradingName: v.optional(nullableString),
      registrationCountry: v.optional(v.string()),
      businessEmail: v.optional(v.string()),
      capability: v.optional(organizationCapabilityValidator),
      defaultTimezone: v.optional(v.string()),
      entityType: v.optional(v.union(organizationEntityTypeValidator, v.null())),
      registrationNumber: v.optional(nullableString),
      taxId: v.optional(nullableString),
      industry: v.optional(nullableString),
      website: v.optional(nullableString),
      businessPhone: v.optional(nullableString),
    }),
    requestId: v.optional(v.string()),
  },
  returns: updateResultValidator,
  handler: async (ctx, args) => {
    const context = await requireCapability(ctx, args.organizationId, "organization:edit");
    if (context.organization.version !== args.expectedVersion) {
      throw businessError("PROFILE_STALE");
    }
    const patch: Partial<Doc<"organizations">> = {};
    try {
      if (args.patch.legalName !== undefined) {
        const name = normalizeBusinessName(args.patch.legalName);
        patch.legalName = name.display;
        patch.normalizedLegalName = name.comparison;
      }
      if (args.patch.tradingName !== undefined) {
        patch.tradingName = cleanOptional(args.patch.tradingName, 160);
      }
      if (args.patch.registrationCountry !== undefined) {
        patch.registrationCountry = normalizeCountryCode(args.patch.registrationCountry);
      }
      if (args.patch.businessEmail !== undefined) {
        patch.businessEmail = normalizeBusinessEmail(args.patch.businessEmail);
      }
      if (args.patch.capability !== undefined) {
        patch.capability = args.patch.capability;
      }
      if (args.patch.defaultTimezone !== undefined) {
        patch.defaultTimezone = validateTimezone(args.patch.defaultTimezone);
      }
      if (args.patch.entityType !== undefined) {
        patch.entityType = args.patch.entityType ?? undefined;
      }
      for (const [field, maximum] of [
        ["registrationNumber", 64],
        ["taxId", 64],
        ["industry", 120],
      ] as const) {
        const value = args.patch[field];
        if (value !== undefined) {
          patch[field] = cleanOptional(value, maximum);
        }
      }
      if (args.patch.website !== undefined) {
        patch.website = args.patch.website ? validateBusinessUrl(args.patch.website) : undefined;
      }
      if (args.patch.businessPhone !== undefined) {
        const country = patch.registrationCountry ?? context.organization.registrationCountry;
        patch.businessPhone =
          args.patch.businessPhone && country
            ? normalizePhone(args.patch.businessPhone, country)
            : undefined;
      }
    } catch {
      throw businessError("FIELD_INVALID");
    }
    const changedFields = Object.keys(patch).filter(
      (field) =>
        context.organization[field as keyof Doc<"organizations">] !==
        patch[field as keyof typeof patch],
    );
    if (changedFields.length === 0) {
      return { updated: false, version: context.organization.version };
    }
    const version = context.organization.version + 1n;
    await ctx.db.patch("organizations", context.organization._id, {
      ...patch,
      updatedAt: Date.now(),
      version,
    });
    await auditChange(ctx, {
      organizationId: context.organization._id,
      entityType: "organization",
      entityId: context.organization._id,
      action: patch.capability ? "organization.capability_updated" : "organization.profile_updated",
      changedFields,
      ...(args.requestId ? { requestId: args.requestId } : {}),
      principal: context.principal,
    });
    return { updated: true, version };
  },
});

export const updatePrimaryContact = mutation({
  args: {
    organizationId: v.id("organizations"),
    contactId: v.id("contacts"),
    expectedVersion: v.int64(),
    patch: v.object({
      type: v.optional(contactTypeValidator),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(nullableString),
      jobTitle: v.optional(nullableString),
      department: v.optional(nullableString),
    }),
    requestId: v.optional(v.string()),
  },
  returns: updateResultValidator,
  handler: async (ctx, args) => {
    const context = await requireCapability(ctx, args.organizationId, "organization:edit");
    const contact = await ctx.db.get("contacts", args.contactId);
    if (!contact || contact.organizationId !== args.organizationId || !contact.isPrimary) {
      throw businessError("ORGANIZATION_FORBIDDEN");
    }
    const version = contact.version ?? 0n;
    if (version !== args.expectedVersion) {
      throw businessError("PROFILE_STALE");
    }
    const patch: Partial<Doc<"contacts">> = {};
    try {
      if (args.patch.type !== undefined) patch.type = args.patch.type;
      if (args.patch.name !== undefined) {
        const name = collapseBusinessWhitespace(args.patch.name);
        if (name.length < 2 || name.length > 120) throw new Error("invalid");
        patch.name = name;
      }
      if (args.patch.email !== undefined) {
        patch.email = normalizeBusinessEmail(args.patch.email);
      }
      if (args.patch.phone !== undefined) {
        patch.phone =
          args.patch.phone && context.organization.registrationCountry
            ? normalizePhone(args.patch.phone, context.organization.registrationCountry)
            : undefined;
      }
      if (args.patch.jobTitle !== undefined) {
        patch.jobTitle = cleanOptional(args.patch.jobTitle, 120);
      }
      if (args.patch.department !== undefined) {
        patch.department = cleanOptional(args.patch.department, 120);
      }
    } catch {
      throw businessError("FIELD_INVALID");
    }
    const changedFields = Object.keys(patch).filter(
      (field) => contact[field as keyof Doc<"contacts">] !== patch[field as keyof typeof patch],
    );
    if (changedFields.length === 0) return { updated: false, version };
    const nextVersion = version + 1n;
    await ctx.db.patch("contacts", contact._id, {
      ...patch,
      updatedAt: Date.now(),
      version: nextVersion,
    });
    await auditChange(ctx, {
      organizationId: args.organizationId,
      entityType: "contact",
      entityId: contact._id,
      action: "organization.primary_contact_updated",
      changedFields,
      ...(args.requestId ? { requestId: args.requestId } : {}),
      principal: context.principal,
    });
    return { updated: true, version: nextVersion };
  },
});

export const updateAddress = mutation({
  args: {
    organizationId: v.id("organizations"),
    addressId: v.id("addresses"),
    expectedVersion: v.int64(),
    patch: v.object({
      type: v.optional(addressTypeValidator),
      label: v.optional(v.string()),
      recipientName: v.optional(v.string()),
      line1: v.optional(v.string()),
      line2: v.optional(nullableString),
      city: v.optional(v.string()),
      region: v.optional(nullableString),
      postalCode: v.optional(nullableString),
      countryCode: v.optional(v.string()),
      deliveryInstructions: v.optional(nullableString),
    }),
    requestId: v.optional(v.string()),
  },
  returns: updateResultValidator,
  handler: async (ctx, args) => {
    const context = await requireCapability(ctx, args.organizationId, "organization:edit");
    const address = await ctx.db.get("addresses", args.addressId);
    if (!address || address.organizationId !== args.organizationId) {
      throw businessError("ORGANIZATION_FORBIDDEN");
    }
    const version = address.version ?? 0n;
    if (version !== args.expectedVersion) {
      throw businessError("PROFILE_STALE");
    }
    try {
      const normalized = validateAddress({
        recipientName: args.patch.recipientName ?? address.recipientName ?? address.label,
        line1: args.patch.line1 ?? address.line1,
        line2: args.patch.line2 === undefined ? address.line2 : args.patch.line2,
        city: args.patch.city ?? address.city,
        region: args.patch.region === undefined ? address.region : args.patch.region,
        postalCode:
          args.patch.postalCode === undefined ? address.postalCode : args.patch.postalCode,
        countryCode: args.patch.countryCode ?? address.countryCode,
        deliveryInstructions:
          args.patch.deliveryInstructions === undefined
            ? address.deliveryInstructions
            : args.patch.deliveryInstructions,
      });
      const patch = {
        ...normalized,
        ...(args.patch.type ? { type: args.patch.type } : {}),
        ...(args.patch.label ? { label: collapseBusinessWhitespace(args.patch.label) } : {}),
      };
      const changedFields = Object.keys(patch).filter(
        (field) => address[field as keyof Doc<"addresses">] !== patch[field as keyof typeof patch],
      );
      if (changedFields.length === 0) return { updated: false, version };
      const nextVersion = version + 1n;
      await ctx.db.patch("addresses", address._id, {
        ...patch,
        updatedAt: Date.now(),
        version: nextVersion,
      });
      await auditChange(ctx, {
        organizationId: args.organizationId,
        entityType: "address",
        entityId: address._id,
        action: "organization.address_updated",
        changedFields,
        ...(args.requestId ? { requestId: args.requestId } : {}),
        principal: context.principal,
      });
      return { updated: true, version: nextVersion };
    } catch (error) {
      if (error instanceof Error && error.message === "FIELD_INVALID") {
        throw businessError("FIELD_INVALID");
      }
      throw error;
    }
  },
});
