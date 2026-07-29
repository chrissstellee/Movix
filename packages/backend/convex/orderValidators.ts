import { v } from "convex/values";

import {
  agreementStatusValidator,
  fulfillmentStatusValidator,
  orderAssetCodeValidator,
  orderAssetKeyValidator,
  orderDiscountKindValidator,
  settlementStatusValidator,
  supplierQueueStateValidator,
  orderDecisionTypeValidator,
  orderRejectionReasonValidator,
} from "./validators";

export const supplierTargetValidator = v.union(
  v.object({ kind: v.literal("wallet"), walletAddress: v.string() }),
  v.object({ kind: v.literal("relationship"), relationshipId: v.id("relationships") }),
);

export const orderLineInputValidator = v.object({
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
  discountBaseUnits: v.optional(v.int64()),
  discountBps: v.optional(v.int64()),
  taxBps: v.int64(),
  taxCode: v.optional(v.string()),
  requiresInspection: v.boolean(),
});

export const orderTotalsValidator = v.object({
  subtotalBaseUnits: v.int64(),
  discountTotalBaseUnits: v.int64(),
  taxTotalBaseUnits: v.int64(),
  shippingTotalBaseUnits: v.int64(),
  grandTotalBaseUnits: v.int64(),
});

export const orderListItemValidator = v.object({
  orderId: v.id("orders"),
  purchaseOrderNumber: v.optional(v.string()),
  supplierName: v.optional(v.string()),
  title: v.optional(v.string()),
  issueDate: v.optional(v.string()),
  grandTotalBaseUnits: v.int64(),
  assetCode: v.optional(orderAssetCodeValidator),
  agreementStatus: agreementStatusValidator,
  fulfillmentStatus: fulfillmentStatusValidator,
  settlementStatus: settlementStatusValidator,
  sortTimestamp: v.number(),
});

export const draftMutationResultValidator = v.object({
  orderId: v.id("orders"),
  revisionId: v.id("orderRevisions"),
  version: v.int64(),
  totals: orderTotalsValidator,
});

export const orderCommandResultValidator = v.object({
  orderId: v.id("orders"),
  revisionId: v.id("orderRevisions"),
  agreementStatus: agreementStatusValidator,
  orderVersion: v.int64(),
  revisionVersion: v.int64(),
  replay: v.boolean(),
});

export const supplierSummaryValidator = v.object({
  organizationId: v.id("organizations"),
  relationshipId: v.optional(v.id("relationships")),
  legalName: v.string(),
  tradingName: v.optional(v.string()),
  walletAddress: v.string(),
  status: v.literal("active"),
});

export const orderAssetSummaryValidator = v.object({
  key: orderAssetKeyValidator,
  code: orderAssetCodeValidator,
  issuer: v.union(v.string(), v.null()),
  contractId: v.string(),
  decimals: v.int64(),
  network: v.literal("testnet"),
});

const contactSnapshotValidator = v.record(v.string(), v.union(v.string(), v.null()));
const addressSnapshotValidator = v.record(v.string(), v.union(v.string(), v.null()));

export const publicOrderLineValidator = v.object({
  id: v.id("orderLines"),
  lineNumber: v.int64(),
  name: v.string(),
  sku: v.optional(v.string()),
  supplierSku: v.optional(v.string()),
  description: v.optional(v.string()),
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
});

export const supplierOrderLineValidator = publicOrderLineValidator.extend({
  category: v.optional(v.string()),
  manufacturer: v.optional(v.string()),
  brand: v.optional(v.string()),
  origin: v.optional(v.string()),
});

export const publicDraftRevisionValidator = v.object({
  id: v.id("orderRevisions"),
  version: v.int64(),
  revisionNumber: v.int64(),
  supplierOrganizationId: v.optional(v.id("organizations")),
  buyerLegalName: v.string(),
  buyerTradingName: v.optional(v.string()),
  supplierLegalName: v.optional(v.string()),
  supplierTradingName: v.optional(v.string()),
  buyerContact: v.optional(contactSnapshotValidator),
  supplierContact: v.optional(contactSnapshotValidator),
  billingAddress: v.optional(addressSnapshotValidator),
  shippingAddress: v.optional(addressSnapshotValidator),
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
  asset: v.optional(orderAssetSummaryValidator),
  deliveryMethod: v.optional(v.string()),
  shippingResponsibility: v.optional(v.string()),
  freightChargeTreatment: v.optional(v.string()),
  inspectionPeriodHours: v.optional(v.int64()),
  refundPolicy: v.optional(v.string()),
  deliveryWindow: v.optional(v.string()),
  incoterm: v.optional(v.string()),
  namedLocation: v.optional(v.string()),
  handlingInstructions: v.optional(v.string()),
  acceptanceCriteria: v.optional(v.string()),
  warrantyText: v.optional(v.string()),
  returnTerms: v.optional(v.string()),
  sharedNotes: v.optional(v.string()),
  buyerInternalNotes: v.optional(v.string()),
  totals: orderTotalsValidator,
  frozenAt: v.optional(v.number()),
});

export const supplierRevisionValidator = v.object({
  id: v.id("orderRevisions"),
  version: v.int64(),
  revisionNumber: v.int64(),
  supplierOrganizationId: v.id("organizations"),
  buyerLegalName: v.string(),
  buyerTradingName: v.optional(v.string()),
  supplierLegalName: v.string(),
  supplierTradingName: v.optional(v.string()),
  buyerContact: contactSnapshotValidator,
  supplierContact: contactSnapshotValidator,
  billingAddress: addressSnapshotValidator,
  shippingAddress: addressSnapshotValidator,
  purchaseOrderNumber: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  buyerReference: v.optional(v.string()),
  supplierReference: v.optional(v.string()),
  timezone: v.string(),
  orderDate: v.string(),
  issueDate: v.string(),
  requestedDeliveryDate: v.string(),
  supplierAcceptanceDeadline: v.number(),
  fundingDeadline: v.number(),
  asset: orderAssetSummaryValidator,
  deliveryMethod: v.string(),
  shippingResponsibility: v.string(),
  freightChargeTreatment: v.string(),
  inspectionPeriodHours: v.int64(),
  refundPolicy: v.string(),
  deliveryWindow: v.optional(v.string()),
  incoterm: v.optional(v.string()),
  namedLocation: v.optional(v.string()),
  handlingInstructions: v.optional(v.string()),
  acceptanceCriteria: v.optional(v.string()),
  warrantyText: v.optional(v.string()),
  returnTerms: v.optional(v.string()),
  sharedNotes: v.optional(v.string()),
  totals: orderTotalsValidator,
  frozenAt: v.number(),
  termsHash: v.string(),
});

export const orderDecisionSummaryValidator = v.object({
  id: v.id("orderRevisionDecisions"),
  decision: orderDecisionTypeValidator,
  revisionId: v.id("orderRevisions"),
  revisionNumber: v.int64(),
  termsHash: v.string(),
  reasonCode: v.optional(orderRejectionReasonValidator),
  reasonNote: v.optional(v.string()),
  actorWalletAddress: v.string(),
  decidedAt: v.number(),
});

export const orderDecisionResultValidator = v.object({
  orderId: v.id("orders"),
  revisionId: v.id("orderRevisions"),
  decisionId: v.id("orderRevisionDecisions"),
  decision: orderDecisionTypeValidator,
  agreementStatus: agreementStatusValidator,
  orderVersion: v.int64(),
  revisionVersion: v.int64(),
  decidedAt: v.number(),
  replay: v.boolean(),
});

export const supplierOrderListItemValidator = v.object({
  orderId: v.id("orders"),
  purchaseOrderNumber: v.optional(v.string()),
  buyerName: v.string(),
  title: v.optional(v.string()),
  revisionNumber: v.int64(),
  grandTotalBaseUnits: v.int64(),
  assetCode: v.optional(orderAssetCodeValidator),
  agreementStatus: agreementStatusValidator,
  supplierQueueState: supplierQueueStateValidator,
  sentAt: v.optional(v.number()),
  decidedAt: v.optional(v.number()),
  supplierAcceptanceDeadline: v.optional(v.number()),
  sortTimestamp: v.number(),
});

export const supplierOrderSummaryValidator = v.object({
  counts: v.object({
    requiresDecision: v.int64(),
    expired: v.int64(),
    accepted: v.int64(),
    rejected: v.int64(),
  }),
  recentIncoming: v.array(supplierOrderListItemValidator),
  blockers: v.array(v.object({ field: v.string(), message: v.string() })),
});

const detailOrderValidator = v.object({
  id: v.id("orders"),
  agreementStatus: agreementStatusValidator,
  fulfillmentStatus: fulfillmentStatusValidator,
  settlementStatus: settlementStatusValidator,
  supplierQueueState: v.optional(supplierQueueStateValidator),
  version: v.int64(),
  fundingEligible: v.boolean(),
});

export const orderDetailValidator = v.union(
  v.object({
    viewerSide: v.literal("buyer"),
    order: detailOrderValidator,
    revision: publicDraftRevisionValidator,
    lines: v.array(publicOrderLineValidator),
    decision: v.optional(orderDecisionSummaryValidator),
  }),
  v.object({
    viewerSide: v.literal("supplier"),
    order: detailOrderValidator,
    revision: supplierRevisionValidator,
    lines: v.array(supplierOrderLineValidator),
    decision: v.optional(orderDecisionSummaryValidator),
    canDecide: v.boolean(),
    offChainNotice: v.literal(
      "Acceptance records an off-chain agreement decision and moves no funds.",
    ),
  }),
);

export const draftProjectionValidator = v.object({
  order: v.object({
    id: v.id("orders"),
    agreementStatus: agreementStatusValidator,
    fulfillmentStatus: fulfillmentStatusValidator,
    settlementStatus: settlementStatusValidator,
    version: v.int64(),
  }),
  revision: publicDraftRevisionValidator,
  lines: v.array(publicOrderLineValidator),
});

export const blockerValidator = v.object({ field: v.string(), message: v.string() });

export const reviewProjectionValidator = v.object({
  complete: v.boolean(),
  blockers: v.array(blockerValidator),
  order: v.object({
    id: v.id("orders"),
    agreementStatus: agreementStatusValidator,
  }),
  revision: publicDraftRevisionValidator,
  lines: v.array(publicOrderLineValidator),
  totals: orderTotalsValidator,
  termsHash: v.optional(v.string()),
});
