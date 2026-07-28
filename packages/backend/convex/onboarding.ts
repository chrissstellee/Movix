import {
  BUSINESS_ATTESTATION_VERSION,
  collapseBusinessWhitespace,
  destinationForCapability,
  normalizeBusinessEmail,
  normalizeBusinessName,
  normalizeCountryCode,
  normalizePhone,
  validateAddress,
  validateBusinessUrl,
  validateTimezone,
  type OnboardingStep,
} from "@repo/domain";
import { v } from "convex/values";

import { env, mutation, query } from "./_generated/server";
import {
  completionResultValidator,
  draftResultValidator,
  saveDraftPatchValidator,
} from "./businessValidators";
import { requireCurrentUser } from "./lib/authorization";
import { businessError } from "./lib/errors";
import { onboardingStepValidator } from "./validators";

import type { Doc } from "./_generated/dataModel";

const stepOrder: readonly OnboardingStep[] = [
  "identity",
  "contact",
  "address",
  "preferences",
  "review",
];

function optionalText(value: string | null, maximum: number): string | undefined {
  if (value == null || value.trim() === "") {
    return undefined;
  }
  const normalized = collapseBusinessWhitespace(value);
  if (normalized.length > maximum) {
    throw businessError("FIELD_INVALID");
  }
  return normalized;
}

function normalizeIdentity(values: {
  legalName: string;
  tradingName: string | null;
  entityType:
    | "sole_proprietor"
    | "partnership"
    | "corporation"
    | "limited_company"
    | "nonprofit"
    | "government"
    | "other"
    | null;
  registrationNumber: string | null;
  taxId: string | null;
  industry: string | null;
  website: string | null;
  businessPhone: string | null;
  registrationCountry: string;
  businessEmail: string;
  capability: "buyer" | "supplier" | "buyer_supplier";
  defaultTimezone: string;
}) {
  const field = <T>(name: string, message: string, normalize: () => T): T => {
    try {
      return normalize();
    } catch {
      throw businessError("DRAFT_INVALID", { fields: { [name]: message } });
    }
  };
  const legalName = field(
    "legalName",
    "Enter a legal business name between 2 and 160 characters.",
    () => normalizeBusinessName(values.legalName).display,
  );
  const country = field("registrationCountry", "Select a valid registration country.", () =>
    normalizeCountryCode(values.registrationCountry),
  );
  const tradingName = field("tradingName", "Use 160 characters or fewer.", () =>
    optionalText(values.tradingName, 160),
  );
  const registrationNumber = field("registrationNumber", "Use 64 characters or fewer.", () =>
    optionalText(values.registrationNumber, 64),
  );
  const taxId = field("taxId", "Use 64 characters or fewer.", () => optionalText(values.taxId, 64));
  const industry = field("industry", "Use 120 characters or fewer.", () =>
    optionalText(values.industry, 120),
  );
  const website = values.website
    ? field("website", "Enter a complete http:// or https:// website URL.", () =>
        validateBusinessUrl(values.website!),
      )
    : undefined;
  const businessPhone = values.businessPhone
    ? field("businessPhone", "Enter a valid phone number for the registration country.", () =>
        normalizePhone(values.businessPhone!, country),
      )
    : undefined;
  return {
    legalName,
    ...(tradingName ? { tradingName } : {}),
    ...(values.entityType ? { entityType: values.entityType } : {}),
    ...(registrationNumber ? { registrationNumber } : {}),
    ...(taxId ? { taxId } : {}),
    ...(industry ? { industry } : {}),
    ...(website ? { website } : {}),
    ...(businessPhone ? { businessPhone } : {}),
    registrationCountry: country,
    businessEmail: field("businessEmail", "Enter a valid business email address.", () =>
      normalizeBusinessEmail(values.businessEmail),
    ),
    capability: values.capability,
    defaultTimezone: field(
      "defaultTimezone",
      "Enter a valid IANA timezone such as Asia/Manila.",
      () => validateTimezone(values.defaultTimezone),
    ),
  };
}

function normalizeContact(
  values: {
    type: "general" | "procurement" | "accounts_payable" | "sales" | "shipping" | "legal";
    name: string;
    email: string;
    phone: string | null;
    jobTitle: string | null;
    department: string | null;
  },
  countryCode?: string,
) {
  const invalidField = (field: string, message: string): never => {
    throw businessError("DRAFT_INVALID", {
      fields: { [field]: message },
    });
  };

  const name = collapseBusinessWhitespace(values.name);
  if (name.length < 2 || name.length > 120) {
    invalidField("contactName", "Enter a contact name between 2 and 120 characters.");
  }

  const email = (() => {
    try {
      return normalizeBusinessEmail(values.email);
    } catch {
      return invalidField("contactEmail", "Enter a valid contact email address.");
    }
  })();

  let phone: string | undefined;
  if (values.phone) {
    try {
      phone = countryCode
        ? normalizePhone(values.phone, countryCode)
        : optionalText(values.phone, 32);
    } catch {
      invalidField(
        "contactPhone",
        countryCode
          ? `Enter a valid phone number for ${countryCode}.`
          : "Enter a valid phone number.",
      );
    }
  }

  let jobTitle: string | undefined;
  let department: string | undefined;
  try {
    jobTitle = optionalText(values.jobTitle, 120);
  } catch {
    invalidField("jobTitle", "Job title must be 120 characters or fewer.");
  }
  try {
    department = optionalText(values.department, 120);
  } catch {
    invalidField("department", "Department must be 120 characters or fewer.");
  }

  return {
    type: values.type,
    name,
    email,
    ...(phone ? { phone } : {}),
    ...(jobTitle ? { jobTitle } : {}),
    ...(department ? { department } : {}),
  };
}

function publicDraft(draft: Doc<"businessOnboardingDrafts">) {
  if (draft.status === "completed" && draft.completedOrganizationId) {
    return {
      kind: "completed" as const,
      version: draft.version,
      organizationId: draft.completedOrganizationId,
    };
  }
  return {
    kind: "draft" as const,
    version: draft.version,
    updatedAt: draft.updatedAt,
    currentStep: draft.currentStep,
    completedSteps: draft.completedSteps,
    sameBillingAsRegistered: draft.sameBillingAsRegistered,
    sameShippingAsRegistered: draft.sameShippingAsRegistered,
    ...(draft.identity ? { identity: draft.identity } : {}),
    ...(draft.contact ? { contact: draft.contact } : {}),
    ...(draft.registeredAddress ? { registeredAddress: draft.registeredAddress } : {}),
    ...(draft.billingAddress ? { billingAddress: draft.billingAddress } : {}),
    ...(draft.shippingAddress ? { shippingAddress: draft.shippingAddress } : {}),
  };
}

function nextStep(completedSteps: readonly OnboardingStep[]): OnboardingStep {
  return stepOrder.find((step) => !completedSteps.includes(step)) ?? "review";
}

export const getDraft = query({
  args: {},
  returns: draftResultValidator,
  handler: async (ctx) => {
    const { user } = await requireCurrentUser(ctx);
    const draft = await ctx.db
      .query("businessOnboardingDrafts")
      .withIndex("by_userId", (builder) => builder.eq("userId", user._id))
      .unique();
    if (!draft) {
      return {
        kind: "blank" as const,
        version: 0n,
        currentStep: "identity" as const,
        completedSteps: [],
      };
    }
    return publicDraft(draft);
  },
});

export const saveDraft = mutation({
  args: {
    expectedVersion: v.int64(),
    step: onboardingStepValidator,
    patch: saveDraftPatchValidator,
  },
  returns: draftResultValidator,
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUser(ctx);
    const existing = await ctx.db
      .query("businessOnboardingDrafts")
      .withIndex("by_userId", (builder) => builder.eq("userId", user._id))
      .unique();
    if (existing?.status === "completed") {
      throw businessError("ONBOARDING_ALREADY_COMPLETED");
    }
    const currentVersion = existing?.version ?? 0n;
    if (args.expectedVersion !== currentVersion) {
      throw businessError("DRAFT_STALE");
    }

    const patch: Partial<Doc<"businessOnboardingDrafts">> = {};
    switch (args.step) {
      case "identity":
        if (!("identity" in args.patch)) throw businessError("DRAFT_INVALID");
        patch.identity = normalizeIdentity(args.patch.identity);
        break;
      case "contact":
        if (!("contact" in args.patch)) throw businessError("DRAFT_INVALID");
        patch.contact = normalizeContact(
          args.patch.contact,
          existing?.identity?.registrationCountry,
        );
        break;
      case "address": {
        if (!("address" in args.patch)) throw businessError("DRAFT_INVALID");
        try {
          patch.registeredAddress = validateAddress(args.patch.address.registeredAddress);
          patch.sameBillingAsRegistered = args.patch.address.sameBillingAsRegistered;
          patch.sameShippingAsRegistered = args.patch.address.sameShippingAsRegistered;
          if (!args.patch.address.sameBillingAsRegistered) {
            if (!args.patch.address.billingAddress) {
              throw new Error("billing required");
            }
            patch.billingAddress = validateAddress(args.patch.address.billingAddress);
          } else {
            patch.billingAddress = undefined;
          }
          if (!args.patch.address.sameShippingAsRegistered) {
            if (!args.patch.address.shippingAddress) {
              throw new Error("shipping required");
            }
            patch.shippingAddress = validateAddress(args.patch.address.shippingAddress);
          } else {
            patch.shippingAddress = undefined;
          }
        } catch {
          throw businessError("DRAFT_INVALID");
        }
        break;
      }
      case "preferences":
        if (!("preferences" in args.patch)) throw businessError("DRAFT_INVALID");
        if (!existing?.identity) {
          throw businessError("DRAFT_INVALID");
        }
        try {
          patch.identity = {
            ...existing.identity,
            capability: args.patch.preferences.capability,
            defaultTimezone: validateTimezone(args.patch.preferences.defaultTimezone),
          };
        } catch {
          throw businessError("DRAFT_INVALID");
        }
        break;
      case "review":
        throw businessError("DRAFT_INVALID");
    }

    const completedSteps = Array.from(
      new Set([...(existing?.completedSteps ?? []), args.step]),
    ).sort((left, right) => stepOrder.indexOf(left) - stepOrder.indexOf(right));
    const now = Date.now();
    const nextVersion = currentVersion + 1n;
    if (!existing) {
      const draftId = await ctx.db.insert("businessOnboardingDrafts", {
        userId: user._id,
        currentStep: nextStep(completedSteps),
        completedSteps,
        sameBillingAsRegistered: false,
        sameShippingAsRegistered: false,
        status: "draft",
        ...patch,
        createdAt: now,
        updatedAt: now,
        version: nextVersion,
      });
      return publicDraft((await ctx.db.get("businessOnboardingDrafts", draftId))!);
    }
    await ctx.db.patch("businessOnboardingDrafts", existing._id, {
      ...patch,
      currentStep: nextStep(completedSteps),
      completedSteps,
      updatedAt: now,
      version: nextVersion,
    });
    return publicDraft((await ctx.db.get("businessOnboardingDrafts", existing._id))!);
  },
});

async function registrationFingerprint(country: string, registrationNumber?: string) {
  const configuredEnv = env as unknown as {
    BUSINESS_REGISTRATION_FINGERPRINT_KEY?: string;
  };
  if (!registrationNumber || !configuredEnv.BUSINESS_REGISTRATION_FINGERPRINT_KEY) {
    return undefined;
  }
  const keyBytes = new TextEncoder().encode(configuredEnv.BUSINESS_REGISTRATION_FINGERPRINT_KEY);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const messageBytes = new TextEncoder().encode(
    `${country}:${registrationNumber.toLocaleLowerCase("und")}`,
  );
  const signature = await crypto.subtle.sign("HMAC", key, messageBytes.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export const complete = mutation({
  args: {
    expectedDraftVersion: v.int64(),
    completionKey: v.string(),
    attestationVersion: v.string(),
  },
  returns: completionResultValidator,
  handler: async (ctx, args) => {
    const principal = await requireCurrentUser(ctx);
    const draft = await ctx.db
      .query("businessOnboardingDrafts")
      .withIndex("by_userId", (builder) => builder.eq("userId", principal.user._id))
      .unique();
    if (!draft) {
      throw businessError("DRAFT_NOT_FOUND");
    }
    if (draft.status === "completed") {
      if (draft.completionKey !== args.completionKey || !draft.completedOrganizationId) {
        throw businessError("ONBOARDING_ALREADY_COMPLETED");
      }
      const organization = await ctx.db.get("organizations", draft.completedOrganizationId);
      if (!organization) {
        throw businessError("INTERNAL_ERROR");
      }
      return {
        kind: "completed" as const,
        organizationId: organization._id,
        capability: organization.capability,
        role: "owner" as const,
        destination: destinationForCapability(organization.capability),
        replay: false,
      };
    }
    if (draft.version !== args.expectedDraftVersion) {
      throw businessError("DRAFT_STALE");
    }
    if (args.attestationVersion !== BUSINESS_ATTESTATION_VERSION) {
      throw businessError("ATTESTATION_REQUIRED");
    }
    if (
      !draft.identity ||
      !draft.contact ||
      !draft.registeredAddress ||
      !["identity", "contact", "address", "preferences"].every((step) =>
        draft.completedSteps.includes(step as OnboardingStep),
      )
    ) {
      throw businessError("DRAFT_INVALID");
    }
    if (!draft.sameBillingAsRegistered && !draft.billingAddress) {
      throw businessError("DRAFT_INVALID");
    }
    if (!draft.sameShippingAsRegistered && !draft.shippingAddress) {
      throw businessError("DRAFT_INVALID");
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_status", (builder) =>
        builder.eq("userId", principal.user._id).eq("status", "active"),
      )
      .first();
    if (membership) {
      throw businessError("ONBOARDING_ALREADY_COMPLETED");
    }

    const normalizedLegalName = normalizeBusinessName(draft.identity.legalName).comparison;
    const fingerprint = await registrationFingerprint(
      draft.identity.registrationCountry,
      draft.identity.registrationNumber,
    );
    if (fingerprint) {
      const duplicate = await ctx.db
        .query("organizations")
        .withIndex("by_registrationFingerprint", (builder) =>
          builder.eq("registrationFingerprint", fingerprint),
        )
        .first();
      if (duplicate?.status === "active") {
        throw businessError("BUSINESS_DUPLICATE");
      }
    }

    const now = Date.now();
    const organizationId = await ctx.db.insert("organizations", {
      legalName: draft.identity.legalName,
      normalizedLegalName,
      registrationCountry: draft.identity.registrationCountry,
      businessEmail: draft.identity.businessEmail,
      capability: draft.identity.capability,
      defaultTimezone: draft.identity.defaultTimezone,
      status: "active",
      verificationStatus: "unverified",
      ...(draft.identity.tradingName ? { tradingName: draft.identity.tradingName } : {}),
      ...(draft.identity.entityType ? { entityType: draft.identity.entityType } : {}),
      ...(draft.identity.registrationNumber
        ? { registrationNumber: draft.identity.registrationNumber }
        : {}),
      ...(fingerprint ? { registrationFingerprint: fingerprint } : {}),
      ...(draft.identity.taxId ? { taxId: draft.identity.taxId } : {}),
      ...(draft.identity.industry ? { industry: draft.identity.industry } : {}),
      ...(draft.identity.website ? { website: draft.identity.website } : {}),
      ...(draft.identity.businessPhone ? { businessPhone: draft.identity.businessPhone } : {}),
      createdByUserId: principal.user._id,
      profileAttestationVersion: BUSINESS_ATTESTATION_VERSION,
      profileAttestedByUserId: principal.user._id,
      profileAttestedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    await ctx.db.insert("memberships", {
      userId: principal.user._id,
      organizationId,
      role: "owner",
      status: "active",
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });
    await ctx.db.insert("contacts", {
      organizationId,
      ...draft.contact,
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
      version: 1n,
    });

    const addressRows = [
      {
        type: "registered" as const,
        label: "Registered",
        value: draft.registeredAddress,
      },
      {
        type: "billing" as const,
        label: "Billing",
        value: draft.sameBillingAsRegistered ? draft.registeredAddress : draft.billingAddress!,
      },
      {
        type: "shipping" as const,
        label: "Shipping",
        value: draft.sameShippingAsRegistered ? draft.registeredAddress : draft.shippingAddress!,
      },
    ];
    for (const row of addressRows) {
      await ctx.db.insert("addresses", {
        organizationId,
        type: row.type,
        label: row.label,
        ...row.value,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    }

    for (const event of [
      { entityType: "organization", entityId: organizationId, action: "organization.created" },
      {
        entityType: "membership",
        entityId: principal.user._id,
        action: "membership.owner_created",
      },
    ]) {
      await ctx.db.insert("auditEvents", {
        entityType: event.entityType,
        entityId: event.entityId,
        organizationId,
        actorUserId: principal.user._id,
        actorWalletAddress: principal.wallet.address,
        action: event.action,
        correlationId: args.completionKey,
        occurredAt: now,
      });
    }
    await ctx.db.patch("businessOnboardingDrafts", draft._id, {
      currentStep: "review",
      completedSteps: [...stepOrder],
      status: "completed",
      completionKey: args.completionKey,
      completedOrganizationId: organizationId,
      attestationVersion: BUSINESS_ATTESTATION_VERSION,
      updatedAt: now,
      version: draft.version + 1n,
    });
    return {
      kind: "completed" as const,
      organizationId,
      capability: draft.identity.capability,
      role: "owner" as const,
      destination: destinationForCapability(draft.identity.capability),
      replay: false,
    };
  },
});
