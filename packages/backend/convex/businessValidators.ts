import { v } from "convex/values";

import {
  contactTypeValidator,
  onboardingStepValidator,
  organizationCapabilityValidator,
  organizationEntityTypeValidator,
} from "./validators";

export const nullableStringValidator = v.union(v.string(), v.null());

export const identityValuesValidator = v.object({
  legalName: v.string(),
  tradingName: nullableStringValidator,
  entityType: v.union(organizationEntityTypeValidator, v.null()),
  registrationNumber: nullableStringValidator,
  taxId: nullableStringValidator,
  industry: nullableStringValidator,
  website: nullableStringValidator,
  businessPhone: nullableStringValidator,
  registrationCountry: v.string(),
  businessEmail: v.string(),
  capability: organizationCapabilityValidator,
  defaultTimezone: v.string(),
});

export const contactValuesValidator = v.object({
  type: contactTypeValidator,
  name: v.string(),
  email: v.string(),
  phone: nullableStringValidator,
  jobTitle: nullableStringValidator,
  department: nullableStringValidator,
});

export const addressValuesValidator = v.object({
  recipientName: v.string(),
  line1: v.string(),
  line2: nullableStringValidator,
  city: v.string(),
  region: nullableStringValidator,
  postalCode: nullableStringValidator,
  countryCode: v.string(),
  deliveryInstructions: nullableStringValidator,
});

export const saveDraftPatchValidator = v.union(
  v.object({ identity: identityValuesValidator }),
  v.object({ contact: contactValuesValidator }),
  v.object({
    address: v.object({
      registeredAddress: addressValuesValidator,
      sameBillingAsRegistered: v.boolean(),
      sameShippingAsRegistered: v.boolean(),
      billingAddress: v.union(addressValuesValidator, v.null()),
      shippingAddress: v.union(addressValuesValidator, v.null()),
    }),
  }),
  v.object({
    preferences: v.object({
      capability: organizationCapabilityValidator,
      defaultTimezone: v.string(),
    }),
  }),
);

export const publicAddressValidator = v.object({
  recipientName: v.string(),
  line1: v.string(),
  line2: v.optional(v.string()),
  city: v.string(),
  region: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  countryCode: v.string(),
  deliveryInstructions: v.optional(v.string()),
});

export const publicIdentityValidator = v.object({
  legalName: v.string(),
  tradingName: v.optional(v.string()),
  entityType: v.optional(organizationEntityTypeValidator),
  registrationNumber: v.optional(v.string()),
  taxId: v.optional(v.string()),
  industry: v.optional(v.string()),
  website: v.optional(v.string()),
  businessPhone: v.optional(v.string()),
  registrationCountry: v.string(),
  businessEmail: v.string(),
  capability: organizationCapabilityValidator,
  defaultTimezone: v.string(),
});

export const publicContactValidator = v.object({
  type: contactTypeValidator,
  name: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
  jobTitle: v.optional(v.string()),
  department: v.optional(v.string()),
});

export const draftResultValidator = v.union(
  v.object({
    kind: v.literal("blank"),
    version: v.int64(),
    currentStep: v.literal("identity"),
    completedSteps: v.array(onboardingStepValidator),
  }),
  v.object({
    kind: v.literal("draft"),
    version: v.int64(),
    updatedAt: v.number(),
    currentStep: onboardingStepValidator,
    completedSteps: v.array(onboardingStepValidator),
    sameBillingAsRegistered: v.boolean(),
    sameShippingAsRegistered: v.boolean(),
    identity: v.optional(publicIdentityValidator),
    contact: v.optional(publicContactValidator),
    registeredAddress: v.optional(publicAddressValidator),
    billingAddress: v.optional(publicAddressValidator),
    shippingAddress: v.optional(publicAddressValidator),
  }),
  v.object({
    kind: v.literal("completed"),
    version: v.int64(),
    organizationId: v.id("organizations"),
  }),
);

export const completionResultValidator = v.object({
  kind: v.literal("completed"),
  organizationId: v.id("organizations"),
  capability: organizationCapabilityValidator,
  role: v.literal("owner"),
  destination: v.union(v.literal("/buyer"), v.literal("/supplier")),
  replay: v.boolean(),
});
