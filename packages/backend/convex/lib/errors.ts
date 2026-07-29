import { ConvexError } from "convex/values";

import type { BusinessErrorCode } from "@repo/domain";

const safeMessages: Record<BusinessErrorCode, string> = {
  UNAUTHENTICATED: "Sign in again to continue.",
  USER_INACTIVE: "This Movix account is not active.",
  ONBOARDING_ALREADY_COMPLETED: "Business onboarding is already complete.",
  DRAFT_NOT_FOUND: "No onboarding draft was found.",
  DRAFT_STALE: "A newer onboarding draft is available.",
  DRAFT_INVALID: "Review the highlighted onboarding fields.",
  ATTESTATION_REQUIRED: "Review and confirm the business-profile attestation.",
  BUSINESS_DUPLICATE: "Review the business registration details.",
  MEMBERSHIP_INACTIVE: "Your organization membership is not active.",
  ORGANIZATION_INACTIVE: "This organization is not active.",
  ORGANIZATION_FORBIDDEN: "You do not have access to this organization.",
  ORGANIZATION_VERIFICATION_REQUIRED:
    "Complete organization verification before taking this action.",
  ORGANIZATION_VERIFICATION_STALE: "A newer organization verification record is available.",
  ORGANIZATION_VERIFICATION_INVALID: "Review the organization verification information.",
  PROFILE_STALE: "A newer business profile is available.",
  FIELD_INVALID: "Review the highlighted field.",
  MULTIPLE_ORGANIZATIONS_UNSUPPORTED: "Multiple active organizations are not supported yet.",
  ORDER_NOT_FOUND: "This order is unavailable.",
  ORDER_FORBIDDEN: "This order is unavailable.",
  BUYER_NOT_READY: "Complete the required buyer profile fields.",
  SUPPLIER_NOT_RESOLVED: "Select a registered supplier before sending.",
  SUPPLIER_INELIGIBLE: "This supplier cannot receive a new order.",
  EXPORTER_INVITATION_INVALID: "This Exporter invitation is unavailable.",
  EXPORTER_INVITATION_EXPIRED: "This Exporter invitation has expired.",
  EXPORTER_INVITATION_REVOKED: "This Exporter invitation was revoked.",
  EXPORTER_INVITATION_USED: "This Exporter invitation has already been used.",
  EXPORTER_INVITATION_WRONG_ORGANIZATION:
    "This Exporter invitation belongs to a different organization.",
  EXPORTER_INVITATION_DUPLICATE: "An active invitation already exists for this Exporter.",
  SELF_DEALING_NOT_ALLOWED: "Buyer and supplier organizations must be different.",
  PO_NUMBER_DUPLICATE: "This purchase-order number is already in use.",
  ORDER_INVALID: "Review the highlighted order fields.",
  ORDER_STALE: "A newer version of this order is available.",
  ORDER_ALREADY_SENT: "This order has already been sent.",
  ORDER_IMMUTABLE: "Sent order terms cannot be changed.",
  ORDER_CANNOT_CANCEL: "This order can no longer be cancelled.",
  ORDER_DECISION_FORBIDDEN: "You cannot decide this order.",
  ORDER_NOT_AWAITING_DECISION: "This order is not awaiting a supplier decision.",
  ORDER_DECISION_EXPIRED: "The supplier decision deadline has passed.",
  ORDER_ALREADY_DECIDED: "This revision already has a supplier decision.",
  ORDER_REVISION_MISMATCH: "A newer order revision is available.",
  ORDER_TERMS_HASH_MISMATCH: "The order terms changed. Reload and review them.",
  TRADE_TERMS_INCOMPLETE: "Complete the required agricultural Trade Order terms.",
  TRADE_TERMS_INVALID: "Review the commodity, route, date, quantity, UOM, and Incoterm terms.",
  TRADE_ORDER_LEGACY_INCOMPLETE:
    "Complete this pre-pivot Trade Order before it can be issued again.",
  TRADE_ORDER_REACCEPTANCE_REQUIRED:
    "The material Trade Order terms changed and require Exporter re-acceptance.",
  ORDER_CANNOT_REVISE: "This order cannot be revised in its current state.",
  ORDER_DECISION_REASON_INVALID: "Choose a valid rejection reason and review the note.",
  AMOUNT_INVALID: "Review the highlighted amount.",
  AMOUNT_OVERFLOW: "This amount exceeds the supported range.",
  TOTAL_MISMATCH: "The order totals changed. Reload and review them.",
  ASSET_UNSUPPORTED: "Select a supported Testnet asset.",
  IDEMPOTENCY_CONFLICT: "This request key was already used for different work.",
  TRADE_DOCUMENT_FORBIDDEN: "This Trade Document is unavailable.",
  TRADE_DOCUMENT_INVALID: "Review the Trade Document metadata and scan state.",
  TRADE_DOCUMENT_STALE: "A newer Trade Document version is available.",
  SHIPMENT_INVALID: "Review the Shipment details and evidence.",
  SHIPMENT_STALE: "A newer Shipment record is available.",
  INTERNAL_ERROR: "Movix could not complete the request.",
};

export function businessError(
  code: BusinessErrorCode,
  options?: {
    correlationId?: string;
    fields?: Record<string, string>;
  },
): ConvexError<{
  code: BusinessErrorCode;
  message: string;
  correlationId?: string;
  fields?: Record<string, string>;
}> {
  return new ConvexError({
    code,
    message: safeMessages[code],
    ...(options?.correlationId ? { correlationId: options.correlationId } : {}),
    ...(options?.fields ? { fields: options.fields } : {}),
  });
}
