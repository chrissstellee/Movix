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
  PROFILE_STALE: "A newer business profile is available.",
  FIELD_INVALID: "Review the highlighted field.",
  MULTIPLE_ORGANIZATIONS_UNSUPPORTED: "Multiple active organizations are not supported yet.",
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
