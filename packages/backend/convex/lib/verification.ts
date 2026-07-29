import { businessError } from "./errors";

import type { Doc } from "../_generated/dataModel";

export type CanonicalVerificationStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "action_required";

export function canonicalVerificationStatus(
  status: Doc<"organizations">["verificationStatus"],
): CanonicalVerificationStatus {
  if (status === "pending" || status === "verified" || status === "action_required") {
    return status;
  }
  return status === "rejected" ? "action_required" : "not_started";
}

export function requireVerifiedOrganization(organization: Doc<"organizations">): void {
  if (canonicalVerificationStatus(organization.verificationStatus) !== "verified") {
    throw businessError("ORGANIZATION_VERIFICATION_REQUIRED", {
      fields: { verification: "/settings/business#verification" },
    });
  }
}
