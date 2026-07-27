import { v } from "convex/values";

import {
  addressTypeValidator,
  contactTypeValidator,
  membershipRoleValidator,
  membershipStatusValidator,
  organizationCapabilityValidator,
  organizationEntityTypeValidator,
  organizationStatusValidator,
  organizationVerificationStatusValidator,
} from "./validators";

const requiredForValidator = v.array(
  v.union(v.literal("organization"), v.literal("buyer"), v.literal("supplier")),
);

export const profileReadinessValidator = v.object({
  organizationUsable: v.boolean(),
  buyerReady: v.boolean(),
  supplierReady: v.boolean(),
  missing: v.array(
    v.object({
      code: v.union(
        v.literal("ORGANIZATION_FIELDS_REQUIRED"),
        v.literal("PRIMARY_CONTACT_REQUIRED"),
        v.literal("REGISTERED_ADDRESS_REQUIRED"),
      ),
      label: v.string(),
      settingsPath: v.string(),
      requiredFor: requiredForValidator,
    }),
  ),
});

export const currentContextValidator = v.union(
  v.null(),
  v.object({
    kind: v.literal("multiple"),
    user: v.object({ id: v.id("users") }),
    wallet: v.object({
      address: v.string(),
      network: v.literal("testnet"),
      verifiedAt: v.number(),
    }),
  }),
  v.object({
    kind: v.literal("ready"),
    user: v.object({ id: v.id("users") }),
    wallet: v.object({
      address: v.string(),
      network: v.literal("testnet"),
      verifiedAt: v.number(),
    }),
    organization: v.object({
      id: v.id("organizations"),
      legalName: v.string(),
      tradingName: v.optional(v.string()),
      capability: organizationCapabilityValidator,
      status: organizationStatusValidator,
      verificationStatus: organizationVerificationStatusValidator,
      version: v.int64(),
    }),
    membership: v.object({
      role: membershipRoleValidator,
      status: membershipStatusValidator,
    }),
    allowedViews: v.array(v.union(v.literal("buyer"), v.literal("supplier"))),
    profileReadiness: profileReadinessValidator,
  }),
);

export const businessSettingsValidator = v.object({
  organization: v.object({
    id: v.id("organizations"),
    legalName: v.string(),
    tradingName: v.optional(v.string()),
    registrationCountry: v.optional(v.string()),
    businessEmail: v.optional(v.string()),
    capability: organizationCapabilityValidator,
    defaultTimezone: v.optional(v.string()),
    status: organizationStatusValidator,
    verificationStatus: v.optional(organizationVerificationStatusValidator),
    entityType: v.optional(organizationEntityTypeValidator),
    registrationNumber: v.optional(v.string()),
    taxId: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    businessPhone: v.optional(v.string()),
    version: v.int64(),
  }),
  primaryContact: v.union(
    v.null(),
    v.object({
      id: v.id("contacts"),
      type: contactTypeValidator,
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      jobTitle: v.optional(v.string()),
      department: v.optional(v.string()),
      version: v.int64(),
    }),
  ),
  addresses: v.array(
    v.object({
      id: v.id("addresses"),
      type: addressTypeValidator,
      label: v.string(),
      recipientName: v.string(),
      line1: v.string(),
      line2: v.optional(v.string()),
      city: v.string(),
      region: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      countryCode: v.string(),
      deliveryInstructions: v.optional(v.string()),
      isDefault: v.boolean(),
      version: v.int64(),
    }),
  ),
  profileReadiness: profileReadinessValidator,
});

export const updateResultValidator = v.object({
  updated: v.boolean(),
  version: v.int64(),
});
