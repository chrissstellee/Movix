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
  orderAssetCodeValidator,
  orderAssetKeyValidator,
  orderCommandTypeValidator,
  orderDiscountKindValidator,
  orderDecisionCommandTypeValidator,
  orderDecisionTypeValidator,
  orderRejectionReasonValidator,
  organizationEntityTypeValidator,
  organizationCapabilityValidator,
  organizationStatusValidator,
  organizationVerificationStatusValidator,
  reconciliationStatusValidator,
  relationshipStatusValidator,
  settlementStatusValidator,
  supplierQueueStateValidator,
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
    supplierOrganizationId: v.optional(v.id("organizations")),
    inviteEmail: v.optional(v.string()),
    inviteWalletAddress: v.optional(v.string()),
    defaultContactId: v.optional(v.id("contacts")),
    defaultAddressId: v.optional(v.id("addresses")),
    status: relationshipStatusValidator,
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
    supplierOrganizationId: v.optional(v.id("organizations")),
    relationshipId: v.optional(v.id("relationships")),
    currentRevisionId: v.optional(v.id("orderRevisions")),
    acceptedRevisionId: v.optional(v.id("orderRevisions")),
    currentDecisionId: v.optional(v.id("orderRevisionDecisions")),
    currentRevisionNumber: v.int64(),
    purchaseOrderNumber: v.optional(v.string()),
    normalizedPurchaseOrderNumber: v.optional(v.string()),
    title: v.optional(v.string()),
    supplierNameSnapshot: v.optional(v.string()),
    assetKey: v.optional(orderAssetKeyValidator),
    assetCode: v.optional(orderAssetCodeValidator),
    issueDate: v.optional(v.string()),
    grandTotalBaseUnits: v.int64(),
    agreementStatus: agreementStatusValidator,
    fulfillmentStatus: fulfillmentStatusValidator,
    settlementStatus: settlementStatusValidator,
    cancellationReasonCode: v.optional(v.string()),
    cancellationReasonDetails: v.optional(v.string()),
    cancelledByUserId: v.optional(v.id("users")),
    cancelledAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    decidedAt: v.optional(v.number()),
    decisionSortTimestamp: v.optional(v.number()),
    decisionWindowExpiredAt: v.optional(v.number()),
    supplierQueueState: v.optional(supplierQueueStateValidator),
    sortTimestamp: v.number(),
    ...commonMutableFields,
  })
    .index("by_buyer_and_normalizedPurchaseOrderNumber", [
      "buyerOrganizationId",
      "normalizedPurchaseOrderNumber",
    ])
    .index("by_buyer_and_sortTimestamp", ["buyerOrganizationId", "sortTimestamp"])
    .index("by_supplierOrganizationId", ["supplierOrganizationId"])
    .index("by_supplier_and_sortTimestamp", ["supplierOrganizationId", "sortTimestamp"])
    .index("by_buyer_and_agreementStatus_and_sortTimestamp", [
      "buyerOrganizationId",
      "agreementStatus",
      "sortTimestamp",
    ])
    .index("by_buyer_and_assetKey_and_sortTimestamp", [
      "buyerOrganizationId",
      "assetKey",
      "sortTimestamp",
    ])
    .index("by_buyer_status_asset_sortTimestamp", [
      "buyerOrganizationId",
      "agreementStatus",
      "assetKey",
      "sortTimestamp",
    ])
    .index("by_buyer_and_issueDate", ["buyerOrganizationId", "issueDate"])
    .index("by_buyer_and_agreementStatus_and_issueDate", [
      "buyerOrganizationId",
      "agreementStatus",
      "issueDate",
    ])
    .index("by_buyer_and_assetKey_and_issueDate", ["buyerOrganizationId", "assetKey", "issueDate"])
    .index("by_buyer_status_asset_issueDate", [
      "buyerOrganizationId",
      "agreementStatus",
      "assetKey",
      "issueDate",
    ])
    .index("by_supplier_status_sortTimestamp", [
      "supplierOrganizationId",
      "agreementStatus",
      "sortTimestamp",
    ])
    .index("by_supplier_queue_sortTimestamp", [
      "supplierOrganizationId",
      "supplierQueueState",
      "sortTimestamp",
    ]),

  orderRevisions: defineTable({
    orderId: v.id("orders"),
    revisionNumber: v.int64(),
    buyerOrganizationId: v.id("organizations"),
    supplierOrganizationId: v.optional(v.id("organizations")),
    relationshipId: v.optional(v.id("relationships")),
    purchaseOrderNumber: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    buyerReference: v.optional(v.string()),
    supplierReference: v.optional(v.string()),
    costCenter: v.optional(v.string()),
    projectCode: v.optional(v.string()),
    timezone: v.optional(v.string()),
    orderDate: v.optional(v.string()),
    issueDate: v.optional(v.string()),
    requestedDeliveryDate: v.optional(v.string()),
    supplierAcceptanceDeadline: v.optional(v.number()),
    fundingDeadline: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    assetKey: v.optional(orderAssetKeyValidator),
    assetCode: v.optional(orderAssetCodeValidator),
    assetIssuer: v.optional(v.string()),
    assetContractId: v.optional(v.string()),
    assetDecimals: v.optional(v.int64()),
    buyerLegalNameSnapshot: v.string(),
    buyerTradingNameSnapshot: v.optional(v.string()),
    supplierLegalNameSnapshot: v.optional(v.string()),
    supplierTradingNameSnapshot: v.optional(v.string()),
    buyerContactSnapshot: v.optional(v.record(v.string(), v.union(v.string(), v.null()))),
    supplierContactSnapshot: v.optional(v.record(v.string(), v.union(v.string(), v.null()))),
    billingAddressSnapshot: v.optional(v.record(v.string(), v.union(v.string(), v.null()))),
    shippingAddressSnapshot: v.optional(v.record(v.string(), v.union(v.string(), v.null()))),
    subtotalBaseUnits: v.int64(),
    discountTotalBaseUnits: v.int64(),
    taxTotalBaseUnits: v.int64(),
    shippingTotalBaseUnits: v.int64(),
    grandTotalBaseUnits: v.int64(),
    paymentMode: v.literal("escrow"),
    deliveryMethod: v.optional(v.string()),
    shippingResponsibility: v.optional(v.string()),
    freightChargeTreatment: v.optional(v.string()),
    inspectionPeriodHours: v.optional(v.int64()),
    refundPolicy: v.optional(v.string()),
    autoReleasePolicy: v.literal("none"),
    deliveryWindow: v.optional(v.string()),
    incoterm: v.optional(v.string()),
    namedLocation: v.optional(v.string()),
    handlingInstructions: v.optional(v.string()),
    acceptanceCriteria: v.optional(v.string()),
    warrantyText: v.optional(v.string()),
    returnTerms: v.optional(v.string()),
    sharedNotes: v.optional(v.string()),
    buyerInternalNotes: v.optional(v.string()),
    termsHash: v.optional(v.string()),
    frozenAt: v.optional(v.number()),
    supersedesRevisionId: v.optional(v.id("orderRevisions")),
    supersededAt: v.optional(v.number()),
    createdByUserId: v.id("users"),
    ...commonMutableFields,
  })
    .index("by_orderId", ["orderId"])
    .index("by_orderId_revisionNumber", ["orderId", "revisionNumber"])
    .index("by_termsHash", ["termsHash"]),

  orderLines: defineTable({
    revisionId: v.id("orderRevisions"),
    lineNumber: v.int64(),
    name: v.string(),
    sku: v.optional(v.string()),
    supplierSku: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    brand: v.optional(v.string()),
    origin: v.optional(v.string()),
    quantityCoefficient: v.int64(),
    quantityScale: v.int64(),
    unitOfMeasure: v.string(),
    unitPriceBaseUnits: v.int64(),
    discountKind: orderDiscountKindValidator,
    discountBaseUnitsInput: v.optional(v.int64()),
    discountBps: v.optional(v.int64()),
    taxBps: v.int64(),
    taxCode: v.optional(v.string()),
    requiresInspection: v.boolean(),
    grossBaseUnits: v.int64(),
    discountBaseUnits: v.int64(),
    taxBaseUnits: v.int64(),
    lineTotalBaseUnits: v.int64(),
    ...commonMutableFields,
  })
    .index("by_revisionId", ["revisionId"])
    .index("by_revisionId_lineNumber", ["revisionId", "lineNumber"]),

  orderCommandReceipts: defineTable({
    buyerOrganizationId: v.id("organizations"),
    orderId: v.id("orders"),
    commandType: orderCommandTypeValidator,
    idempotencyKey: v.string(),
    requestFingerprint: v.string(),
    resultRevisionId: v.optional(v.id("orderRevisions")),
    resultAgreementStatus: agreementStatusValidator,
    resultOrderVersion: v.optional(v.int64()),
    resultRevisionVersion: v.optional(v.int64()),
    createdAt: v.number(),
  })
    .index("by_buyer_command_idempotencyKey", [
      "buyerOrganizationId",
      "commandType",
      "idempotencyKey",
    ])
    .index("by_orderId_and_commandType", ["orderId", "commandType"]),

  orderRevisionDecisions: defineTable({
    orderId: v.id("orders"),
    revisionId: v.id("orderRevisions"),
    revisionNumber: v.int64(),
    buyerOrganizationId: v.id("organizations"),
    supplierOrganizationId: v.id("organizations"),
    decision: orderDecisionTypeValidator,
    termsHash: v.string(),
    reasonCode: v.optional(orderRejectionReasonValidator),
    reasonNote: v.optional(v.string()),
    actorUserId: v.id("users"),
    actorWalletAddress: v.string(),
    decidedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_revisionId", ["revisionId"])
    .index("by_orderId_and_decidedAt", ["orderId", "decidedAt"])
    .index("by_supplierOrganizationId_and_decidedAt", ["supplierOrganizationId", "decidedAt"]),

  orderDecisionReceipts: defineTable({
    supplierOrganizationId: v.id("organizations"),
    orderId: v.id("orders"),
    revisionId: v.id("orderRevisions"),
    commandType: orderDecisionCommandTypeValidator,
    idempotencyKey: v.string(),
    requestFingerprint: v.string(),
    decisionId: v.id("orderRevisionDecisions"),
    resultOrderVersion: v.int64(),
    resultRevisionVersion: v.int64(),
    decidedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_supplierOrganizationId_and_idempotencyKey", [
      "supplierOrganizationId",
      "idempotencyKey",
    ])
    .index("by_supplierOrganizationId_and_commandType_and_idempotencyKey", [
      "supplierOrganizationId",
      "commandType",
      "idempotencyKey",
    ])
    .index("by_orderId_and_commandType", ["orderId", "commandType"]),

  orderDashboardCounts: defineTable({
    organizationId: v.id("organizations"),
    side: v.union(v.literal("buyer"), v.literal("supplier")),
    draftCount: v.int64(),
    sentCount: v.int64(),
    ...commonMutableFields,
  }).index("by_organizationId_and_side", ["organizationId", "side"]),

  supplierOrderCounts: defineTable({
    supplierOrganizationId: v.id("organizations"),
    requiresDecisionCount: v.int64(),
    expiredCount: v.int64(),
    acceptedCount: v.int64(),
    rejectedCount: v.int64(),
    ...commonMutableFields,
  }).index("by_supplierOrganizationId", ["supplierOrganizationId"]),

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
    recipientUserId: v.optional(v.id("users")),
    recipientOrganizationId: v.id("organizations"),
    eventType: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    actionUrl: v.string(),
    idempotencyKey: v.string(),
    status: v.union(v.literal("unread"), v.literal("read")),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_recipientUserId", ["recipientUserId"])
    .index("by_recipientUserId_status", ["recipientUserId", "status"])
    .index("by_eventType_recipientUserId", ["eventType", "recipientUserId"])
    .index("by_recipientOrganizationId_and_status", ["recipientOrganizationId", "status"])
    .index("by_recipientOrganizationId_and_createdAt", ["recipientOrganizationId", "createdAt"])
    .index("by_recipientOrganizationId_and_idempotencyKey", [
      "recipientOrganizationId",
      "idempotencyKey",
    ]),

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
