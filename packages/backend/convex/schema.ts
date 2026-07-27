import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  addressTypeValidator,
  agreementStatusValidator,
  authChallengeStateValidator,
  authSessionStateValidator,
  commonMutableFields,
  contactTypeValidator,
  fulfillmentStatusValidator,
  membershipRoleValidator,
  membershipStatusValidator,
  networkValidator,
  onboardingDraftStatusValidator,
  onboardingStepValidator,
  organizationEntityTypeValidator,
  organizationCapabilityValidator,
  organizationStatusValidator,
  organizationVerificationStatusValidator,
  reconciliationStatusValidator,
  settlementStatusValidator,
  transactionStatusValidator,
  userStatusValidator,
} from "./validators";

export default defineSchema({
  users: defineTable({
    primaryWallet: v.string(),
    status: userStatusValidator,
    timezone: v.string(),
    tokenIdentifier: v.optional(v.string()),
    lastLoginAt: v.optional(v.number()),
    ...commonMutableFields,
  })
    .index("by_primaryWallet", ["primaryWallet"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_status", ["status"]),

  wallets: defineTable({
    userId: v.id("users"),
    address: v.string(),
    network: networkValidator,
    verifiedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_address", ["address"])
    .index("by_address_and_network", ["address", "network"])
    .index("by_userId", ["userId"]),

  authChallenges: defineTable({
    challengeHash: v.string(),
    intentHash: v.string(),
    account: v.string(),
    homeDomain: v.string(),
    webAuthDomain: v.string(),
    network: networkValidator,
    state: authChallengeStateValidator,
    issuedAt: v.number(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    supersededAt: v.optional(v.number()),
    outcome: v.optional(v.string()),
    correlationId: v.string(),
  })
    .index("by_challengeHash", ["challengeHash"])
    .index("by_intentHash_and_state", ["intentHash", "state"])
    .index("by_expiresAt", ["expiresAt"]),

  authSessionFamilies: defineTable({
    familyId: v.string(),
    userId: v.id("users"),
    walletId: v.id("wallets"),
    network: networkValidator,
    currentCredentialHash: v.string(),
    absoluteExpiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    revocationReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_familyId", ["familyId"])
    .index("by_userId", ["userId"])
    .index("by_absoluteExpiresAt", ["absoluteExpiresAt"]),

  authSessions: defineTable({
    credentialHash: v.string(),
    familyId: v.id("authSessionFamilies"),
    userId: v.id("users"),
    walletId: v.id("wallets"),
    network: networkValidator,
    predecessorId: v.optional(v.id("authSessions")),
    successorId: v.optional(v.id("authSessions")),
    jwtKeyId: v.string(),
    state: authSessionStateValidator,
    createdAt: v.number(),
    expiresAt: v.number(),
    rotatedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_credentialHash", ["credentialHash"])
    .index("by_familyId", ["familyId"])
    .index("by_userId", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),

  authSecurityEvents: defineTable({
    category: v.string(),
    outcome: v.string(),
    correlationId: v.string(),
    network: networkValidator,
    walletFingerprint: v.optional(v.string()),
    occurredAt: v.number(),
  })
    .index("by_category_and_occurredAt", ["category", "occurredAt"])
    .index("by_correlationId", ["correlationId"])
    .index("by_occurredAt", ["occurredAt"]),

  organizations: defineTable({
    legalName: v.string(),
    normalizedLegalName: v.optional(v.string()),
    registrationCountry: v.optional(v.string()),
    businessEmail: v.optional(v.string()),
    capability: organizationCapabilityValidator,
    defaultTimezone: v.optional(v.string()),
    status: organizationStatusValidator,
    verificationStatus: v.optional(organizationVerificationStatusValidator),
    tradingName: v.optional(v.string()),
    entityType: v.optional(organizationEntityTypeValidator),
    registrationNumber: v.optional(v.string()),
    registrationFingerprint: v.optional(v.string()),
    taxId: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    businessPhone: v.optional(v.string()),
    createdByUserId: v.id("users"),
    profileAttestationVersion: v.optional(v.string()),
    profileAttestedByUserId: v.optional(v.id("users")),
    profileAttestedAt: v.optional(v.number()),
    ...commonMutableFields,
  })
    .index("by_status", ["status"])
    .index("by_createdByUserId", ["createdByUserId"])
    .index("by_registrationFingerprint", ["registrationFingerprint"]),

  businessOnboardingDrafts: defineTable({
    userId: v.id("users"),
    identity: v.optional(
      v.object({
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
      }),
    ),
    contact: v.optional(
      v.object({
        type: contactTypeValidator,
        name: v.string(),
        email: v.string(),
        phone: v.optional(v.string()),
        jobTitle: v.optional(v.string()),
        department: v.optional(v.string()),
      }),
    ),
    registeredAddress: v.optional(
      v.object({
        recipientName: v.string(),
        line1: v.string(),
        line2: v.optional(v.string()),
        city: v.string(),
        region: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        countryCode: v.string(),
        deliveryInstructions: v.optional(v.string()),
      }),
    ),
    billingAddress: v.optional(
      v.object({
        recipientName: v.string(),
        line1: v.string(),
        line2: v.optional(v.string()),
        city: v.string(),
        region: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        countryCode: v.string(),
        deliveryInstructions: v.optional(v.string()),
      }),
    ),
    shippingAddress: v.optional(
      v.object({
        recipientName: v.string(),
        line1: v.string(),
        line2: v.optional(v.string()),
        city: v.string(),
        region: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        countryCode: v.string(),
        deliveryInstructions: v.optional(v.string()),
      }),
    ),
    currentStep: onboardingStepValidator,
    completedSteps: v.array(onboardingStepValidator),
    sameBillingAsRegistered: v.boolean(),
    sameShippingAsRegistered: v.boolean(),
    status: onboardingDraftStatusValidator,
    completionKey: v.optional(v.string()),
    completedOrganizationId: v.optional(v.id("organizations")),
    attestationVersion: v.optional(v.string()),
    ...commonMutableFields,
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_status", ["userId", "status"]),

  memberships: defineTable({
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    role: membershipRoleValidator,
    status: membershipStatusValidator,
    acceptedAt: v.optional(v.number()),
    ...commonMutableFields,
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_userId", ["organizationId", "userId"])
    .index("by_organizationId_status", ["organizationId", "status"]),

  contacts: defineTable({
    organizationId: v.id("organizations"),
    type: v.union(
      contactTypeValidator,
      v.literal("primary"),
      v.literal("billing"),
      v.literal("dispatch"),
    ),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    department: v.optional(v.string()),
    isPrimary: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    version: v.optional(v.int64()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_type", ["organizationId", "type"]),

  addresses: defineTable({
    organizationId: v.id("organizations"),
    type: v.union(addressTypeValidator, v.literal("business")),
    label: v.string(),
    recipientName: v.optional(v.string()),
    line1: v.string(),
    line2: v.optional(v.string()),
    city: v.string(),
    region: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    countryCode: v.string(),
    deliveryInstructions: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
    version: v.optional(v.int64()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_type", ["organizationId", "type"]),

  relationships: defineTable({
    buyerOrganizationId: v.id("organizations"),
    supplierOrganizationId: v.id("organizations"),
    status: v.union(v.literal("active"), v.literal("inactive")),
    defaultTermsHash: v.optional(v.string()),
    ...commonMutableFields,
  })
    .index("by_buyerOrganizationId", ["buyerOrganizationId"])
    .index("by_supplierOrganizationId", ["supplierOrganizationId"])
    .index("by_buyerOrganizationId_supplierOrganizationId", [
      "buyerOrganizationId",
      "supplierOrganizationId",
    ])
    .index("by_status", ["status"]),

  orders: defineTable({
    buyerOrganizationId: v.id("organizations"),
    supplierOrganizationId: v.id("organizations"),
    currentRevisionId: v.optional(v.id("orderRevisions")),
    purchaseOrderNumber: v.string(),
    agreementStatus: agreementStatusValidator,
    fulfillmentStatus: fulfillmentStatusValidator,
    settlementStatus: settlementStatusValidator,
    ...commonMutableFields,
  })
    .index("by_buyerOrganizationId", ["buyerOrganizationId"])
    .index("by_supplierOrganizationId", ["supplierOrganizationId"])
    .index("by_buyerOrganizationId_agreementStatus", ["buyerOrganizationId", "agreementStatus"])
    .index("by_supplierOrganizationId_agreementStatus", [
      "supplierOrganizationId",
      "agreementStatus",
    ])
    .index("by_purchaseOrderNumber", ["purchaseOrderNumber"]),

  orderRevisions: defineTable({
    orderId: v.id("orders"),
    revisionNumber: v.int64(),
    agreementStatus: agreementStatusValidator,
    termsHash: v.string(),
    assetCode: v.string(),
    assetContractId: v.string(),
    totalBaseUnits: v.int64(),
    buyerLegalNameSnapshot: v.string(),
    supplierLegalNameSnapshot: v.string(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    decidedAt: v.optional(v.number()),
  })
    .index("by_orderId", ["orderId"])
    .index("by_orderId_revisionNumber", ["orderId", "revisionNumber"])
    .index("by_termsHash", ["termsHash"]),

  orderLines: defineTable({
    revisionId: v.id("orderRevisions"),
    lineNumber: v.int64(),
    sku: v.string(),
    description: v.string(),
    quantity: v.int64(),
    unitPriceBaseUnits: v.int64(),
    amountBaseUnits: v.int64(),
  })
    .index("by_revisionId", ["revisionId"])
    .index("by_revisionId_lineNumber", ["revisionId", "lineNumber"]),

  shipments: defineTable({
    orderId: v.id("orders"),
    supplierOrganizationId: v.id("organizations"),
    status: v.union(v.literal("draft"), v.literal("shipped")),
    shipmentHash: v.string(),
    carrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    shippedAt: v.optional(v.number()),
    ...commonMutableFields,
  })
    .index("by_orderId", ["orderId"])
    .index("by_supplierOrganizationId", ["supplierOrganizationId"])
    .index("by_status", ["status"]),

  shipmentLines: defineTable({
    shipmentId: v.id("shipments"),
    orderLineId: v.id("orderLines"),
    quantity: v.int64(),
  })
    .index("by_shipmentId", ["shipmentId"])
    .index("by_orderLineId", ["orderLineId"]),

  escrows: defineTable({
    orderId: v.id("orders"),
    escrowKey: v.string(),
    buyerOrganizationId: v.id("organizations"),
    supplierOrganizationId: v.id("organizations"),
    network: networkValidator,
    contractId: v.string(),
    tokenContractId: v.string(),
    amountBaseUnits: v.int64(),
    status: settlementStatusValidator,
    reconciliationStatus: reconciliationStatusValidator,
    submittedTransactionHash: v.optional(v.string()),
    confirmedLedger: v.optional(v.int64()),
    ...commonMutableFields,
  })
    .index("by_orderId", ["orderId"])
    .index("by_escrowKey", ["escrowKey"])
    .index("by_buyerOrganizationId", ["buyerOrganizationId"])
    .index("by_supplierOrganizationId", ["supplierOrganizationId"])
    .index("by_status", ["status"])
    .index("by_reconciliationStatus", ["reconciliationStatus"]),

  transactionRecords: defineTable({
    hash: v.string(),
    network: networkValidator,
    orderId: v.optional(v.id("orders")),
    escrowId: v.optional(v.id("escrows")),
    organizationId: v.id("organizations"),
    action: v.string(),
    status: transactionStatusValidator,
    ledger: v.optional(v.int64()),
    submittedAt: v.number(),
    confirmedAt: v.optional(v.number()),
  })
    .index("by_hash_network", ["hash", "network"])
    .index("by_orderId", ["orderId"])
    .index("by_escrowId", ["escrowId"])
    .index("by_organizationId", ["organizationId"])
    .index("by_status", ["status"]),

  refundRequests: defineTable({
    escrowId: v.id("escrows"),
    requestedByOrganizationId: v.id("organizations"),
    counterpartyOrganizationId: v.id("organizations"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("withdrawn"),
    ),
    reasonCode: v.string(),
    termsHash: v.string(),
    ...commonMutableFields,
  })
    .index("by_escrowId", ["escrowId"])
    .index("by_status", ["status"])
    .index("by_counterpartyOrganizationId_status", ["counterpartyOrganizationId", "status"]),

  notifications: defineTable({
    recipientUserId: v.id("users"),
    recipientOrganizationId: v.id("organizations"),
    eventType: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    status: v.union(v.literal("unread"), v.literal("read")),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_recipientUserId", ["recipientUserId"])
    .index("by_recipientUserId_status", ["recipientUserId", "status"])
    .index("by_eventType_recipientUserId", ["eventType", "recipientUserId"]),

  auditEvents: defineTable({
    entityType: v.string(),
    entityId: v.string(),
    organizationId: v.id("organizations"),
    actorUserId: v.optional(v.id("users")),
    actorWalletAddress: v.optional(v.string()),
    action: v.string(),
    correlationId: v.string(),
    changedFields: v.optional(v.array(v.string())),
    occurredAt: v.number(),
  })
    .index("by_entityType_entityId", ["entityType", "entityId"])
    .index("by_organizationId", ["organizationId"])
    .index("by_actorUserId", ["actorUserId"])
    .index("by_correlationId", ["correlationId"]),

  reconciliationCursors: defineTable({
    network: networkValidator,
    contractId: v.string(),
    lastLedger: v.int64(),
    ...commonMutableFields,
  }).index("by_network_contractId", ["network", "contractId"]),
});
